const http = require('http');
const { createId, tokensMatch } = require('./ids');

const DEFAULT_PORT = 17321;

function isLoopback(address) {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}

function createBridge(options = {}) {
  const token = options.token || '';
  const port = options.port == null ? DEFAULT_PORT : options.port;
  const pending = [];
  const waiters = [];
  const inflight = new Map();
  let lastSeen = 0;
  let server = null;

  function extensionConnected() {
    return waiters.length > 0 || Date.now() - lastSeen < 40000;
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) {
          reject(new Error('Request body is larger than 5 MB.'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`Body is not JSON: ${error.message}`));
        }
      });
      req.on('error', reject);
    });
  }

  function authorized(req) {
    if (!token) return false;
    const url = new URL(req.url, 'http://127.0.0.1');
    const presented =
      url.searchParams.get('token') || req.headers['x-automa-token'] || '';
    return tokensMatch(token, String(presented));
  }

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  function takeCommands() {
    return pending.splice(0, 5);
  }

  function deliver(commands) {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(commands);
      return;
    }
    commands.forEach((command) => pending.push(command));
  }

  function call(method, params, timeout = 20000) {
    if (!token) {
      return Promise.reject(
        new Error(
          'AUTOMA_AGENT_TOKEN is empty. Set it to the token shown in Automa settings → Agent bridge.'
        )
      );
    }
    if (!extensionConnected()) {
      return Promise.reject(
        new Error(
          'Automa is not connected. In the extension, open Settings → Agent bridge, enable it, and use the same token and port. Then reload the extension.'
        )
      );
    }

    const id = createId(16);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        inflight.delete(id);
        reject(
          new Error(
            `Automa did not answer "${method}" within ${timeout}ms. Confirm the agent bridge is enabled.`
          )
        );
      }, timeout);
      inflight.set(id, { resolve, reject, timer });
      deliver([{ id, method, params: params || {} }]);
    });
  }

  function finishCommand(body) {
    const job = inflight.get(body.id);
    if (!job) return false;
    clearTimeout(job.timer);
    inflight.delete(body.id);
    if (body.ok) job.resolve(body.result);
    else
      job.reject(
        new Error((body.error && body.error.message) || 'Extension error')
      );
    return true;
  }

  async function handle(req, res) {
    if (!isLoopback(req.socket.remoteAddress)) {
      sendJson(res, 403, {
        ok: false,
        error: 'Only loopback clients are allowed.',
      });
      return;
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/automa/v1/health') {
      sendJson(res, 200, {
        ok: true,
        extensionConnected: extensionConnected(),
        port,
      });
      return;
    }

    if (!authorized(req)) {
      sendJson(res, 401, {
        ok: false,
        error: 'Token does not match AUTOMA_AGENT_TOKEN.',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/automa/v1/commands') {
      lastSeen = Date.now();
      const ready = takeCommands();
      if (ready.length) {
        sendJson(res, 200, { commands: ready });
        return;
      }

      let settled = false;
      let timer = null;
      const deliverWaiting = (commands) => {
        if (settled) {
          commands.forEach((command) => pending.push(command));
          return;
        }
        settled = true;
        clearTimeout(timer);
        sendJson(res, 200, { commands });
      };
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const index = waiters.findIndex((item) => item === deliverWaiting);
        if (index !== -1) waiters.splice(index, 1);
        sendJson(res, 200, { commands: [] });
      }, 25000);

      waiters.push(deliverWaiting);
      res.on('close', () => {
        if (settled || res.writableEnded) return;
        settled = true;
        clearTimeout(timer);
        const index = waiters.indexOf(deliverWaiting);
        if (index !== -1) waiters.splice(index, 1);
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/automa/v1/rpc') {
      const body = await readBody(req);
      if (!body || typeof body.method !== 'string' || !body.method) {
        sendJson(res, 200, {
          ok: false,
          error: 'Body must be { "method": "<tool>", "params": {} }.',
        });
        return;
      }
      if (typeof options.handleRpc !== 'function') {
        sendJson(res, 200, {
          ok: false,
          error:
            'This bridge has no RPC handler. Start it with `pnpm agent:mcp`.',
        });
        return;
      }
      try {
        const result = await options.handleRpc(body.method, body.params || {});
        sendJson(res, 200, { ok: true, result });
      } catch (error) {
        sendJson(res, 200, { ok: false, error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/automa/v1/results') {
      lastSeen = Date.now();
      const body = await readBody(req);
      const found = finishCommand(body);
      sendJson(res, found ? 200 : 404, { ok: found });
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Unknown bridge route.' });
  }

  function start() {
    server = http.createServer((req, res) => {
      handle(req, res).catch((error) => {
        if (res.headersSent) return;
        sendJson(res, 400, { ok: false, error: error.message });
      });
    });

    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        resolve(address && address.port);
      });
    });
  }

  function stop() {
    waiters.splice(0).forEach((waiter) => waiter([]));
    inflight.forEach((job) => {
      clearTimeout(job.timer);
      job.reject(new Error('Bridge stopped.'));
    });
    inflight.clear();
    if (!server) return Promise.resolve();
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  return {
    start,
    stop,
    call,
    extensionConnected,
    get port() {
      return server && server.address() ? server.address().port : port;
    },
  };
}

module.exports = {
  DEFAULT_PORT,
  createBridge,
};

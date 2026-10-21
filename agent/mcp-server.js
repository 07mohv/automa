#!/usr/bin/env node
const { createBridge, DEFAULT_PORT } = require('./bridge');
const { extensionVersion } = require('./create-workflow');
const { TOOLS, handleTool } = require('./tools');

const PROTOCOL = '2024-11-05';

function writeMessage(message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function respond(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
}

function consume(buffer, emit) {
  let rest = buffer;
  while (rest.length) {
    const asText = rest.toString('utf8');
    const trimmed = asText.trimStart();
    if (trimmed.startsWith('{')) {
      const newlineAt = rest.indexOf(0x0a);
      if (newlineAt === -1) return rest;
      const line = rest.slice(0, newlineAt).toString('utf8').replace(/\r$/, '');
      rest = rest.slice(newlineAt + 1);
      if (line.trim()) emit(JSON.parse(line));
    } else {
      const separator = '\r\n\r\n';
      const headerEnd = rest.indexOf(separator);
      if (headerEnd === -1) return rest;
      const header = rest.slice(0, headerEnd).toString('utf8');
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) throw new Error('MCP frame is missing Content-Length.');
      const length = Number(match[1]);
      const start = headerEnd + separator.length;
      if (rest.length < start + length) return rest;
      const body = rest.slice(start, start + length).toString('utf8');
      rest = rest.slice(start + length);
      emit(JSON.parse(body));
    }
  }
  return rest;
}

async function onMessage(message, bridge) {
  const { id, method, params } = message;
  if (id == null) return;

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: (params && params.protocolVersion) || PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'automa-agent', version: extensionVersion() },
      instructions:
        'Read AGENTS.md first. Discover blocks, build a workflow, validate_workflow, and apply every error and warning fix before import. Warnings flag fixed delays, missing waits, fragile selectors, loops without a breakpoint, and missing retries. The same tools are HTTP POST http://127.0.0.1:<port>/automa/v1/rpc with header x-automa-token and body {"method","params"}. Reference variables with {{variables@name}} and the current loop item with {{loopData@loopId}}.',
    });
    return;
  }

  if (method === 'ping') {
    respond(id, {});
    return;
  }

  if (method === 'tools/list') {
    respond(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    try {
      const value = await handleTool(name, args, bridge);
      respond(id, {
        content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        isError: false,
      });
    } catch (error) {
      respond(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: false, error: error.message }),
          },
        ],
        isError: true,
      });
    }
    return;
  }

  fail(id, -32601, `Method not found: ${method}`);
}

async function main() {
  const token = process.env.AUTOMA_AGENT_TOKEN || '';
  const port = process.env.AUTOMA_AGENT_PORT
    ? Number(process.env.AUTOMA_AGENT_PORT)
    : DEFAULT_PORT;
  const bridge = createBridge({
    token,
    port,
    handleRpc: (method, params) => handleTool(method, params, bridge),
  });

  try {
    const bound = await bridge.start();
    process.stderr.write(
      `Automa agent bridge listening on 127.0.0.1:${bound}. Extension connections require AUTOMA_AGENT_TOKEN.\n`
    );
  } catch (error) {
    process.stderr.write(
      `Agent bridge did not start (${error.message}). Schema tools still work. Import and run need the bridge.\n`
    );
  }

  let buffer = Buffer.alloc(0);
  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    try {
      buffer = consume(buffer, (message) => {
        onMessage(message, bridge).catch((error) => {
          process.stderr.write(`${error.message}\n`);
        });
      });
    } catch (error) {
      process.stderr.write(`Invalid MCP message: ${error.message}\n`);
    }
  });
  process.stdin.on('end', () => {
    bridge.stop().finally(() => process.exit(0));
  });
  process.stdin.resume();
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  consume,
  writeMessage,
  onMessage,
  main,
};

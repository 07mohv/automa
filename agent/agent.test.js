const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const { createBridge } = require('./bridge');
const { createWorkflow } = require('./create-workflow');
const { buildExamples } = require('./examples');
const { loadBlocks } = require('./load-blocks');
const { consume } = require('./mcp-server');
const { buildSchema, CATALOG_PATH, WORKFLOW_SCHEMA_PATH } = require('./schema');
const { handleTool } = require('./tools');
const { validateWorkflow } = require('./validate');

function minimalSpec(extraNodes = [], extraEdges = []) {
  return {
    name: 'Minimal',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      ...extraNodes,
    ],
    edges: extraEdges,
  };
}

test('schema lists every built-in block from the editor definitions', () => {
  const { tasks } = loadBlocks();
  const schema = buildSchema();
  assert.deepEqual(schema['x-blockIds'].sort(), Object.keys(tasks).sort());
  const tab = schema.$defs.blocks['new-tab'];
  assert.equal(tab['x-component'], 'BlockBasic');
  assert.equal(tab.properties.data.properties.url.type, 'string');
  assert.equal(tab.properties.data.properties.url['x-templated'], true);
  assert.ok(
    tab.properties.data.properties.onError.properties.toDo.enum.includes(
      'fallback'
    )
  );
  assert.deepEqual(
    schema.$defs.blocks.trigger.properties.data.properties.type.enum.includes(
      'manual'
    ),
    true
  );
});

test('committed schema and catalog stay in sync with block definitions', () => {
  const schema = buildSchema();
  const committed = fs.readFileSync(WORKFLOW_SCHEMA_PATH, 'utf8');
  assert.equal(committed, `${JSON.stringify(schema, null, 2)}\n`);
  const catalog = fs.readFileSync(CATALOG_PATH, 'utf8');
  schema['x-blockIds'].forEach((blockId) => {
    assert.match(catalog, new RegExp(`### \`${blockId}\``));
  });
});

test('example workflows are valid, efficient, and use the editor graph', () => {
  const examples = buildExamples();
  assert.equal(examples.length, 6);
  examples.forEach((example) => {
    assert.equal(
      example.validation.ok,
      true,
      JSON.stringify(example.validation.errors, null, 2)
    );
    assert.equal(
      example.validation.warnings.length,
      0,
      `${example.file}\n${JSON.stringify(example.validation.warnings, null, 2)}`
    );
    const file = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'examples', example.file), 'utf8')
    );
    assert.deepEqual(file, example.workflow);
    const again = validateWorkflow(file);
    assert.equal(again.ok, true, JSON.stringify(again.errors, null, 2));
    assert.equal(again.warnings.length, 0);
  });

  const heading = examples[0].workflow;
  const read = heading.drawflow.nodes.find((node) => node.id === 'read');
  assert.equal(read.label, 'get-text');
  assert.equal(read.data.selector, 'h1');
  assert.equal(read.data.variableName, 'heading');
  const edge = heading.drawflow.edges[0];
  assert.equal(edge.sourceHandle, 'trigger-output-1');
  assert.equal(edge.targetHandle, 'open-input-1');
});

test('validator reports an empty new-tab URL with a fix', () => {
  const built = createWorkflow({
    name: 'Missing URL',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      { id: 'open', block: 'new-tab', data: { url: '   ' } },
    ],
    edges: [{ source: 'trigger', target: 'open' }],
  });
  assert.equal(built.validation.ok, false);
  const error = built.validation.errors.find((item) =>
    item.path.endsWith('data.url')
  );
  assert.ok(error);
  assert.match(error.fix, /https:\/\/example.com/);
});

test('validator accepts editor metadata and warns on unknown blocks', () => {
  const built = createWorkflow(minimalSpec());
  built.workflow.drawflow.nodes[0].dimensions = { width: 192, height: 72 };
  built.workflow.drawflow.nodes[0].selected = false;
  const validation = validateWorkflow(built.workflow);
  assert.equal(validation.ok, true);

  const custom = createWorkflow({
    name: 'Custom',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      { id: 'open', block: 'new-tab', data: { url: 'https://example.com' } },
    ],
    edges: [{ source: 'trigger', target: 'open' }],
  });
  custom.workflow.drawflow.nodes[1].label = 'my-package-block';
  const warned = validateWorkflow(custom.workflow);
  assert.equal(warned.ok, true);
  assert.ok(warned.warnings.some((item) => item.code === 'unknown-block'));
});

test('duplicate ids, dangling edges, and bad handles are errors', () => {
  const duplicate = createWorkflow({
    name: 'Duplicate',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      { id: 'trigger', block: 'delay', data: { time: 10 } },
    ],
    edges: [],
  });
  assert.ok(
    duplicate.validation.errors.some(
      (item) => item.code === 'duplicate-node-id'
    )
  );

  const dangling = createWorkflow(
    minimalSpec(
      [{ id: 'open', block: 'new-tab', data: { url: 'https://example.com' } }],
      [{ source: 'trigger', target: 'missing' }]
    )
  );
  assert.ok(
    dangling.validation.errors.some((item) => item.code === 'dangling-edge')
  );

  const handle = createWorkflow(
    minimalSpec(
      [{ id: 'wait', block: 'delay', data: { time: 10 } }],
      [{ source: 'trigger', target: 'wait', sourceOutput: 4 }]
    )
  );
  assert.ok(
    handle.validation.errors.some((item) => item.code === 'invalid-handle')
  );
});

test('legacy Drawflow documents are accepted with a warning', () => {
  const workflow = {
    name: 'Legacy',
    drawflow: {
      drawflow: {
        Home: {
          data: {
            1: {
              id: '1',
              name: 'trigger',
              html: 'BlockBasic',
              pos_x: 10,
              pos_y: 20,
              data: { disableBlock: false, type: 'manual' },
              outputs: {
                output_1: { connections: [{ node: '2', output: 'input_1' }] },
              },
            },
            2: {
              id: '2',
              name: 'delay',
              html: 'BlockDelay',
              pos_x: 200,
              pos_y: 20,
              data: { disableBlock: false, time: 25 },
              outputs: { output_1: { connections: [] } },
            },
          },
        },
      },
    },
  };
  const validation = validateWorkflow(workflow);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(
    validation.warnings.some((item) => item.code === 'legacy-drawflow')
  );
});

test('element-exists output 2 is a valid fallback path', () => {
  const built = createWorkflow({
    name: 'Branch',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      { id: 'check', block: 'element-exists', data: { selector: 'h1' } },
      { id: 'yes', block: 'delay', data: { time: 1 } },
      { id: 'no', block: 'delay', data: { time: 2 } },
    ],
    edges: [
      { source: 'trigger', target: 'check' },
      { source: 'check', target: 'yes', sourceOutput: 1 },
      { source: 'check', target: 'no', sourceOutput: 2 },
    ],
  });
  assert.equal(
    built.validation.ok,
    true,
    JSON.stringify(built.validation.errors, null, 2)
  );
  assert.equal(built.workflow.drawflow.edges[2].sourceHandle, 'check-output-2');
});

test('a workflow without a trigger is rejected and create_workflow can add one', () => {
  const missing = {
    name: 'No trigger',
    drawflow: {
      nodes: [
        {
          id: 'open',
          label: 'new-tab',
          type: 'BlockBasic',
          data: { url: 'https://example.com', disableBlock: false },
        },
      ],
      edges: [],
    },
  };
  const validation = validateWorkflow(missing);
  assert.ok(validation.errors.some((item) => item.code === 'missing-trigger'));

  const built = createWorkflow({
    name: 'Auto trigger',
    nodes: [
      { id: 'open', block: 'new-tab', data: { url: 'https://example.com' } },
    ],
    edges: [{ source: 'trigger', target: 'open' }],
  });
  assert.ok(built.notes.length);
  assert.equal(
    built.validation.ok,
    true,
    JSON.stringify(built.validation.errors, null, 2)
  );
});

test('linter warns about fragile patterns and keeps the workflow valid', () => {
  const built = createWorkflow({
    name: 'Fragile',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      {
        id: 'open',
        block: 'new-tab',
        data: { url: 'https://example.com', waitTabLoaded: false },
      },
      { id: 'pause', block: 'delay', data: { time: 2000 } },
      {
        id: 'read',
        block: 'get-text',
        data: {
          selector: 'html > body > div:nth-child(1) > div:nth-child(2) > span',
          waitForSelector: false,
          saveData: false,
          assignVariable: false,
        },
      },
      {
        id: 'loop',
        block: 'loop-data',
        data: {
          loopId: 'rows',
          loopThrough: 'numbers',
          fromNumber: 1,
          toNumber: 3,
        },
      },
    ],
    edges: [
      { source: 'trigger', target: 'open' },
      { source: 'open', target: 'pause' },
      { source: 'pause', target: 'read' },
      { source: 'read', target: 'loop' },
    ],
  });
  const codes = built.validation.warnings.map((item) => item.code);
  [
    'prefer-wait',
    'enable-wait-tab',
    'enable-wait-selector',
    'fragile-selector',
    'missing-retry',
    'discarded-read',
    'loop-without-breakpoint',
  ].forEach((code) => assert.ok(codes.includes(code), code));
  built.validation.warnings.forEach((item) => {
    assert.equal(typeof item.fix, 'string');
    assert.ok(item.fix.length > 20);
  });
  assert.equal(built.validation.ok, true);

  const branch = createWorkflow({
    name: 'Short check',
    settings: { blockDelay: 100, saveLog: false },
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      {
        id: 'check',
        block: 'element-exists',
        data: { selector: '*', tryCount: 1, timeout: 200 },
      },
    ],
    edges: [{ source: 'trigger', target: 'check' }],
  });
  const branchCodes = branch.validation.warnings.map((item) => item.code);
  [
    'short-existence-check',
    'broad-selector',
    'unhandled-branch',
    'high-block-delay',
    'save-log-disabled',
  ].forEach((code) => assert.ok(branchCodes.includes(code), code));
  assert.equal(branch.validation.ok, true);
});

test('handleTool returns block schemas and validation without the extension', async () => {
  const listed = await handleTool('list_blocks', { category: 'browser' });
  assert.ok(listed.blocks.some((block) => block.id === 'new-tab'));
  assert.ok(listed.blocks.every((block) => block.category === 'browser'));

  const schema = await handleTool('get_block_schema', { blockId: 'delay' });
  assert.equal(schema['x-blockId'], 'delay');

  const built = await handleTool('create_workflow', {
    name: 'Delay only',
    nodes: [
      { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
      { id: 'wait', block: 'delay', data: { time: 5 } },
    ],
    edges: [{ source: 'trigger', target: 'wait' }],
  });
  assert.equal(built.validation.ok, true);

  await assert.rejects(
    () => handleTool('get_block_schema', { blockId: 'not-a-block' }),
    /Unknown block/
  );
});

test('HTTP RPC lists blocks without an extension connection', async () => {
  const holder = {};
  const bridge = createBridge({
    token: 'rpc-token',
    port: 0,
    handleRpc: (method, params) => handleTool(method, params, holder.bridge),
  });
  holder.bridge = bridge;
  const port = await bridge.start();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/automa/v1/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-automa-token': 'rpc-token',
      },
      body: JSON.stringify({
        method: 'list_blocks',
        params: { category: 'general' },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.ok(body.result.blocks.some((block) => block.id === 'trigger'));

    const denied = await fetch(`http://127.0.0.1:${port}/automa/v1/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-automa-token': 'wrong',
      },
      body: JSON.stringify({ method: 'list_blocks', params: {} }),
    });
    assert.equal(denied.status, 401);

    const unknown = await fetch(`http://127.0.0.1:${port}/automa/v1/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-automa-token': 'rpc-token',
      },
      body: JSON.stringify({ method: 'not-a-tool', params: {} }),
    });
    const unknownBody = await unknown.json();
    assert.equal(unknown.status, 200);
    assert.equal(unknownBody.ok, false);
    assert.match(unknownBody.error, /Unknown tool/);
  } finally {
    await bridge.stop();
  }
});

test('local bridge exchanges a command with a loopback client', async () => {
  const bridge = createBridge({ token: 'secret-token', port: 0 });
  const port = await bridge.start();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/automa/v1/health`);
    assert.equal(health.status, 200);

    const denied = await fetch(`http://127.0.0.1:${port}/automa/v1/commands`, {
      headers: { 'x-automa-token': 'wrong' },
    });
    assert.equal(denied.status, 401);

    const poll = fetch(`http://127.0.0.1:${port}/automa/v1/commands`, {
      headers: { 'x-automa-token': 'secret-token' },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    const pending = bridge.call('ping', { hello: true });
    const commandsResponse = await poll;
    const { commands } = await commandsResponse.json();
    assert.equal(commands.length, 1);
    assert.equal(commands[0].method, 'ping');
    assert.equal(commands[0].params.hello, true);

    const posted = await fetch(`http://127.0.0.1:${port}/automa/v1/results`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-automa-token': 'secret-token',
      },
      body: JSON.stringify({
        id: commands[0].id,
        ok: true,
        result: { pong: true },
      }),
    });
    assert.equal(posted.status, 200);
    assert.deepEqual(await pending, { pong: true });
  } finally {
    await bridge.stop();
  }
});

test('MCP stdio initialize and tools/list', async () => {
  const child = spawn(
    process.execPath,
    [path.join(__dirname, 'mcp-server.js')],
    {
      env: {
        ...process.env,
        AUTOMA_AGENT_TOKEN: 'mcp-test-token',
        AUTOMA_AGENT_PORT: '0',
      },
    }
  );
  let buffer = Buffer.alloc(0);
  let stderr = '';
  const messages = [];
  let waiters = [];
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  function push(message) {
    if (waiters.length) waiters.shift()(message);
    else messages.push(message);
  }

  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    buffer = consume(buffer, push);
  });

  function nextMessage() {
    if (messages.length) return Promise.resolve(messages.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for MCP. stderr: ${stderr}`));
      }, 15000);
      waiters.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  function send(message) {
    const payload = Buffer.from(JSON.stringify(message), 'utf8');
    child.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
    child.stdin.write(payload);
  }

  try {
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
    });
    const initialized = await nextMessage();
    assert.equal(initialized.id, 1);
    assert.equal(initialized.result.serverInfo.name, 'automa-agent');

    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = await nextMessage();
    const names = tools.result.tools.map((tool) => tool.name);
    [
      'list_blocks',
      'get_block_schema',
      'create_workflow',
      'validate_workflow',
      'import_workflow',
      'run_workflow',
      'get_run_logs',
    ].forEach((name) => assert.ok(names.includes(name), name));

    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_blocks', arguments: { category: 'general' } },
    });
    const called = await nextMessage();
    const payload = JSON.parse(called.result.content[0].text);
    assert.equal(called.result.isError, false);
    assert.ok(payload.blocks.some((block) => block.id === 'trigger'));
  } finally {
    child.kill();
    waiters = [];
  }
});

test('MCP frame parser reads Content-Length and newline JSON', () => {
  const seen = [];
  const payload = JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 7 });
  const framed = Buffer.from(
    `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`
  );
  const rest = consume(framed, (message) => seen.push(message));
  assert.equal(rest.length, 0);
  assert.equal(seen[0].id, 7);

  const line = Buffer.from('{"jsonrpc":"2.0","id":8,"method":"ping"}\n');
  consume(line, (message) => seen.push(message));
  assert.equal(seen[1].id, 8);
});

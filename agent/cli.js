#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { DEFAULT_PORT } = require('./bridge');
const { loadBlocks } = require('./load-blocks');
const { writeSchemaFiles, buildSchema } = require('./schema');
const { validateWorkflow, parseDrawflow } = require('./validate');
const { createWorkflow } = require('./create-workflow');
const { buildExamples } = require('./examples');
const { judgeSelector } = require('./selectors');

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function usage() {
  process.stderr.write(`Usage:
  node agent/cli.js schema
  node agent/cli.js blocks [--category <id>]
  node agent/cli.js block <blockId>
  node agent/cli.js validate <workflow.json>
  node agent/cli.js normalize <workflow.json> [--out <file>]
  node agent/cli.js create --spec <spec.json> [--out <file>]
  node agent/cli.js examples [--out <directory>]
  node agent/cli.js selector <css-or-xpath>
  node agent/cli.js rpc <method> [--file <params.json>]

validate exits 1 when the workflow has errors.
rpc POSTs {"method","params"} to http://127.0.0.1:\${AUTOMA_AGENT_PORT}/automa/v1/rpc
(default port 17321) with the x-automa-token header. Start \`pnpm agent:mcp\` first.
A workflow file can be the params for validate_workflow because it has drawflow.
`);
}

function flag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

function commandSchema() {
  const written = writeSchemaFiles();
  print(written);
}

function commandBlocks(argv) {
  const { tasks, categories } = loadBlocks();
  const category = flag(argv, '--category');
  const blocks = Object.keys(tasks)
    .filter((id) => !category || tasks[id].category === category)
    .map((id) => ({
      id,
      name: tasks[id].name,
      description: tasks[id].description || '',
      category: tasks[id].category,
      categoryName: categories[tasks[id].category]
        ? categories[tasks[id].category].name
        : tasks[id].category,
      inputs: tasks[id].inputs || 0,
      outputs: tasks[id].outputs || 0,
      component: tasks[id].component,
    }));
  print({ blocks });
}

function commandBlock(argv) {
  const blockId = argv[1];
  if (!blockId) {
    usage();
    process.exitCode = 1;
    return;
  }
  const schema = buildSchema();
  const block = schema.$defs.blocks[blockId];
  if (!block) {
    print({
      ok: false,
      error: `Unknown block "${blockId}".`,
    });
    process.exitCode = 1;
    return;
  }
  print(block);
}

function commandValidate(argv) {
  const filePath = argv[1];
  if (!filePath) {
    usage();
    process.exitCode = 1;
    return;
  }
  const workflow = readJson(filePath);
  const validation = validateWorkflow(workflow);
  print(validation);
  if (!validation.ok) process.exitCode = 1;
}

function commandNormalize(argv) {
  const filePath = argv[1];
  if (!filePath) {
    usage();
    process.exitCode = 1;
    return;
  }
  const workflow = readJson(filePath);
  const warnings = [];
  const parsed = parseDrawflow(workflow, warnings);
  if (parsed.error) {
    print({ ok: false, error: parsed.error });
    process.exitCode = 1;
    return;
  }
  const normalized = { ...workflow, drawflow: parsed.drawflow };
  const validation = validateWorkflow(normalized);
  const out = flag(argv, '--out');
  if (out)
    fs.writeFileSync(
      path.resolve(out),
      `${JSON.stringify(normalized, null, 2)}\n`
    );
  print({
    ok: validation.ok,
    warnings,
    validation,
    workflow: out ? undefined : normalized,
  });
  if (!validation.ok) process.exitCode = 1;
}

function commandCreate(argv) {
  const specPath = flag(argv, '--spec');
  if (!specPath) {
    usage();
    process.exitCode = 1;
    return;
  }
  const built = createWorkflow(readJson(specPath));
  const out = flag(argv, '--out');
  if (out) {
    fs.writeFileSync(
      path.resolve(out),
      `${JSON.stringify(built.workflow, null, 2)}\n`
    );
  }
  print(built);
  if (!built.validation.ok) process.exitCode = 1;
}

function commandExamples(argv) {
  const outDir = path.resolve(
    flag(argv, '--out') || path.join(__dirname, 'examples')
  );
  fs.mkdirSync(outDir, { recursive: true });
  const written = buildExamples().map((example) => {
    const filePath = path.join(outDir, example.file);
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(example.workflow, null, 2)}\n`
    );
    return {
      file: filePath,
      ok: example.validation.ok,
      errors: example.validation.errors,
      warnings: example.validation.warnings,
    };
  });
  print({ written });
  if (
    written.some(
      (item) => !item.ok || (item.warnings && item.warnings.length > 0)
    )
  ) {
    process.exitCode = 1;
  }
}

function commandSelector(argv) {
  const selector = argv.slice(1).join(' ').trim();
  if (!selector) {
    usage();
    process.exitCode = 1;
    return;
  }
  print(judgeSelector(selector));
}

async function commandRpc(argv) {
  const method = argv[1];
  if (!method) {
    usage();
    process.exitCode = 1;
    return;
  }
  const filePath = flag(argv, '--file');
  const params = filePath ? readJson(filePath) : {};
  const port = process.env.AUTOMA_AGENT_PORT || DEFAULT_PORT;
  const token = process.env.AUTOMA_AGENT_TOKEN || '';
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${port}/automa/v1/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-automa-token': token,
      },
      body: JSON.stringify({ method, params }),
    });
  } catch (error) {
    print({
      ok: false,
      error: `Could not reach the agent bridge on 127.0.0.1:${port} (${error.message}). Start \`pnpm agent:mcp\` with AUTOMA_AGENT_TOKEN, or use \`node agent/cli.js validate\` for a local check.`,
    });
    process.exitCode = 1;
    return;
  }
  const body = await response.json();
  print(body);
  if (!response.ok || body.ok === false) process.exitCode = 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const commands = {
    schema: () => commandSchema(),
    blocks: () => commandBlocks(argv),
    block: () => commandBlock(argv),
    validate: () => commandValidate(argv),
    normalize: () => commandNormalize(argv),
    create: () => commandCreate(argv),
    examples: () => commandExamples(argv),
    selector: () => commandSelector(argv),
    rpc: () => commandRpc(argv),
  };

  if (!commands[command]) {
    usage();
    process.exitCode = command ? 1 : 0;
    return;
  }

  try {
    await commands[command]();
  } catch (error) {
    print({ ok: false, error: error.message });
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    print({ ok: false, error: error.message });
    process.exitCode = 1;
  });
}

module.exports = { main };

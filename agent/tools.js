const { loadBlocks } = require('./load-blocks');
const { buildSchema } = require('./schema');
const { validateWorkflow, isStructuralError } = require('./validate');
const { createWorkflow } = require('./create-workflow');

const TOOLS = [
  {
    name: 'list_blocks',
    description:
      'List built-in Automa blocks. Use the id as the node label and as nodes[].block in create_workflow. Optional category: interaction, browser, general, onlineServices, data, conditions, package.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: { type: 'string' },
      },
    },
  },
  {
    name: 'get_block_schema',
    description:
      'Return the JSON Schema for one block, including parameter types, defaults, templated fields, and output handles. blockId is the id from list_blocks, for example "new-tab".',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['blockId'],
      properties: {
        blockId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_workflow',
    description:
      'Build an Automa workflow from a compact graph. Include a trigger node or one is added. Connect nodes with edges. sourceOutput defaults to 1. element-exists uses 1 when the element exists and 2 otherwise. conditions use the condition id or "fallback". The result is the JSON the editor imports. It is not stored in the browser until import_workflow.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'nodes'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        globalData: {
          description: 'Object or JSON string stored as workflow.globalData.',
        },
        settings: {
          type: 'object',
          description:
            'Workflow settings such as saveLog, blockDelay, and onError.',
        },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'block'],
            properties: {
              id: { type: 'string' },
              block: { type: 'string' },
              data: { type: 'object' },
              position: { type: 'object' },
            },
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['source', 'target'],
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
              sourceOutput: {
                description: 'Output name or number. Defaults to 1.',
              },
              sourceHandle: { type: 'string' },
              targetHandle: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'validate_workflow',
    description:
      'Validate an Automa workflow. errors must be fixed before the workflow can run. warnings describe legacy files, unknown package blocks, and suspicious values; the editor can still open the file. Each issue has path, message, and fix.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['workflow'],
      properties: {
        workflow: { type: 'object' },
      },
    },
  },
  {
    name: 'import_workflow',
    description:
      'Store a workflow in the connected Automa extension. Requires the agent bridge. Structural errors are rejected unless force is true. strict also rejects parameter errors such as an empty selector. overwrite replaces a workflow with the same id. run starts it after a successful import and skips the parameter prompt unless checkParams is true.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['workflow'],
      properties: {
        workflow: { type: 'object' },
        overwrite: { type: 'boolean' },
        force: { type: 'boolean' },
        strict: { type: 'boolean' },
        run: { type: 'boolean' },
        variables: { type: 'object' },
        globalData: {},
      },
    },
  },
  {
    name: 'list_workflows',
    description:
      'List workflows stored in the connected Automa extension. Set full to true to include the drawflow graph.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        full: { type: 'boolean' },
      },
    },
  },
  {
    name: 'run_workflow',
    description:
      'Run a stored workflow in the connected Automa extension. variables and globalData are passed into the run. The parameter prompt is skipped unless checkParams is true. Poll get_run_logs until the run leaves the running state. Finished step history is available after the run ends.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['workflowId'],
      properties: {
        workflowId: { type: 'string' },
        variables: { type: 'object' },
        globalData: {},
        checkParams: { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_run_logs',
    description:
      'Read running states and finished logs for a workflow from the connected extension. history on a finished log lists the blocks that ran. Live step history is not streamed while a run is still in progress.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['workflowId'],
      properties: {
        workflowId: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'stop_workflow',
    description:
      'Stop a running workflow. Pass stateId from get_run_logs, or workflowId to stop its current run.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workflowId: { type: 'string' },
        stateId: { type: 'string' },
      },
    },
  },
];

function asWorkflow(args) {
  if (args && args.workflow && typeof args.workflow === 'object')
    return args.workflow;
  if (args && args.drawflow) return args;
  throw new Error('Pass { workflow } with the Automa workflow object.');
}

async function handleTool(name, args, bridge) {
  if (!args) args = {};
  if (name === 'list_blocks') {
    const { tasks, categories } = loadBlocks();
    const blocks = Object.keys(tasks)
      .filter((id) => !args.category || tasks[id].category === args.category)
      .map((id) => ({
        id,
        name: tasks[id].name,
        description: tasks[id].description || '',
        category: tasks[id].category,
        categoryName: categories[tasks[id].category]
          ? categories[tasks[id].category].name
          : tasks[id].category,
        component: tasks[id].component,
        inputs: tasks[id].inputs || 0,
        outputs: tasks[id].outputs || 0,
      }));
    return { blocks };
  }

  if (name === 'get_block_schema') {
    const schema = buildSchema();
    const block = schema.$defs.blocks[args.blockId];
    if (!block) {
      throw new Error(
        `Unknown block "${args.blockId}". Call list_blocks and use one of those ids.`
      );
    }
    return block;
  }

  if (name === 'create_workflow') {
    return createWorkflow(args);
  }

  if (name === 'validate_workflow') {
    return validateWorkflow(asWorkflow(args));
  }

  if (name === 'import_workflow') {
    const workflow = asWorkflow(args);
    const validation = validateWorkflow(workflow);
    const structural = validation.errors.filter(isStructuralError);
    if (!args.force && structural.length) {
      return {
        imported: false,
        validation,
        message:
          'Import was rejected because the graph is not safe to store. Fix the errors, or pass force: true.',
      };
    }
    if (args.strict && !validation.ok) {
      return {
        imported: false,
        validation,
        message:
          'Import was rejected because strict mode is on and validation failed.',
      };
    }
    const imported = await bridge.call('import_workflow', {
      workflow,
      overwrite: Boolean(args.overwrite),
    });
    let run = null;
    if (args.run) {
      run = await bridge.call('run_workflow', {
        workflowId: imported.workflowId,
        variables: args.variables || {},
        globalData: args.globalData,
        checkParams: false,
      });
    }
    return { imported: true, validation, ...imported, run };
  }

  if (!bridge) throw new Error('Agent bridge is not running.');

  if (name === 'list_workflows') {
    return bridge.call('list_workflows', { full: Boolean(args.full) });
  }
  if (name === 'run_workflow') return bridge.call('run_workflow', args);
  if (name === 'get_run_logs') return bridge.call('get_run_logs', args);
  if (name === 'stop_workflow') return bridge.call('stop_workflow', args);

  throw new Error(`Unknown tool "${name}".`);
}

module.exports = {
  TOOLS,
  handleTool,
};

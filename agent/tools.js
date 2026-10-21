const { loadBlocks } = require('./load-blocks');
const { judgeSelector } = require('./selectors');
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
  {
    name: 'judge_selector',
    description:
      'Score one CSS or XPath selector without a browser. verdict is stable, ok, or fragile. Do not put a fragile selector in a workflow. This does not check that the selector matches; call test_selector on the live page for that.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['selector'],
      properties: {
        selector: { type: 'string' },
      },
    },
  },
  {
    name: 'list_tabs',
    description:
      'List the browser tabs Automa can see. inspectable is false for chrome:// and extension pages. Use tabId with the page tools. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'open_tab',
    description:
      'Open an http(s) URL in a new tab and wait for it to finish loading. Then call page_snapshot with the returned tabId. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string' },
        active: { type: 'boolean' },
      },
    },
  },
  {
    name: 'page_snapshot',
    description:
      'Read the visible interactive elements of a real tab. Each element has text, role, and up to four candidate selectors ranked by robustness (stable, ok, fragile). Pass tabId from list_tabs or open_tab; omit it to use the active tab. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tabId: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'test_selector',
    description:
      'Run a selector in a real tab the same way a workflow block does. Check matchCount, visibleCount, and samples before using it. highlight true outlines the matches for about 2 seconds. Set waitMs (max 8000) when the element appears after a load. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['selector'],
      properties: {
        selector: { type: 'string' },
        findBy: { type: 'string', enum: ['cssSelector', 'xpath'] },
        tabId: { type: 'number' },
        highlight: { type: 'boolean' },
        waitMs: { type: 'number' },
      },
    },
  },
  {
    name: 'evaluate_in_tab',
    description:
      'Run JavaScript in a real tab and return the value. code is the body of an async function: use return. world isolated (default) can read and edit the DOM and is not blocked by the page CSP. world page runs in the page and can see page JavaScript, but the page CSP may block it. Do not read cookies or storage unless the task asks for that. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['code'],
      properties: {
        code: { type: 'string' },
        tabId: { type: 'number' },
        world: { type: 'string', enum: ['isolated', 'page'] },
        timeoutMs: { type: 'number' },
      },
    },
  },
  {
    name: 'capture_screenshot',
    description:
      'Capture a JPEG of the visible area of a tab. The tab is activated first. Prefer page_snapshot for selectors. The image is omitted when it is too large. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tabId: { type: 'number' },
      },
    },
  },
  {
    name: 'preview_block',
    description:
      'Run one block against a real tab before saving a workflow. new-tab opens the URL. get-text, forms, event-click, element-exists, and the other interaction blocks really click or type. javascript-code is previewed against the DOM and understands automaNextBlock and automaSetVariable. A null result means the block finished without a value. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['block'],
      properties: {
        block: { type: 'string' },
        data: { type: 'object' },
        tabId: { type: 'number' },
      },
    },
  },
  {
    name: 'preview_workflow',
    description:
      'Run a whole workflow once and return its log, then delete the temporary copy. Pass keep true to leave it stored. timeoutMs defaults to 20000 and caps at 50000. Read logs[0].history to see which block failed. Requires the agent bridge.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['workflow'],
      properties: {
        workflow: { type: 'object' },
        variables: { type: 'object' },
        globalData: {},
        timeoutMs: { type: 'number' },
        keep: { type: 'boolean' },
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

  if (name === 'judge_selector') {
    if (!args.selector || !String(args.selector).trim()) {
      throw new Error(
        'selector is required. Copy a candidate from page_snapshot, or pass the selector you plan to use.'
      );
    }
    return judgeSelector(args.selector);
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
  if (name === 'list_tabs') return bridge.call('list_tabs', args);
  if (name === 'open_tab') return bridge.call('open_tab', args, 20000);
  if (name === 'page_snapshot') return bridge.call('page_snapshot', args);
  if (name === 'test_selector') return bridge.call('test_selector', args);
  if (name === 'evaluate_in_tab') return bridge.call('evaluate_in_tab', args);
  if (name === 'capture_screenshot')
    return bridge.call('capture_screenshot', args);
  if (name === 'preview_block')
    return bridge.call('preview_block', args, 25000);
  if (name === 'preview_workflow') {
    const timeout = Math.min(
      Math.max(Number(args.timeoutMs) || 20000, 1000),
      50000
    );
    return bridge.call('preview_workflow', args, timeout + 8000);
  }

  throw new Error(`Unknown tool "${name}".`);
}

module.exports = {
  TOOLS,
  handleTool,
};

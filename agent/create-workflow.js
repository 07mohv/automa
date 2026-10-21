const packageJson = require('../package.json');
const { loadBlocks } = require('./load-blocks');
const { validateWorkflow } = require('./validate');

const DEFAULT_SETTINGS = {
  publicId: '',
  aipowerToken: '',
  blockDelay: 0,
  saveLog: true,
  debugMode: false,
  restartTimes: 3,
  notification: true,
  execContext: 'popup',
  reuseLastState: false,
  inputAutocomplete: true,
  onError: 'stop-workflow',
  executedBlockOnWeb: false,
  insertDefaultColumn: false,
  defaultColumnName: 'column',
};

function extensionVersion() {
  return packageJson.version;
}

function mergeDefaults(defaults, overrides) {
  const output = JSON.parse(JSON.stringify(defaults || {}));
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return output;
  }

  Object.keys(overrides).forEach((key) => {
    const value = overrides[key];
    const current = output[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      output[key] = mergeDefaults(current, value);
      return;
    }
    output[key] = value;
  });

  return output;
}

function blockIdOf(node) {
  return node.block || node.label;
}

function createWorkflow(spec = {}, options = {}) {
  const shared = options.shared || loadBlocks();
  const notes = [];
  const nodesInput = Array.isArray(spec.nodes) ? spec.nodes.slice() : [];

  const hasTrigger = nodesInput.some(
    (node) => node && blockIdOf(node) === 'trigger'
  );
  if (!hasTrigger) {
    nodesInput.unshift({
      id: 'trigger',
      block: 'trigger',
      data: { type: 'manual' },
    });
    notes.push('Added a manual trigger because the graph did not include one.');
  }

  const nodes = nodesInput.map((node, index) => {
    if (!node || typeof node !== 'object') {
      throw new Error(`nodes[${index}] must be an object with a block id.`);
    }
    const blockId = blockIdOf(node);
    const definition = shared.tasks[blockId];
    if (!definition) {
      throw new Error(
        `Unknown block "${blockId}". Call list_blocks and use one of those ids.`
      );
    }

    return {
      id: node.id || `${blockId}-${index + 1}`,
      label: blockId,
      type: definition.component,
      position: node.position || { x: 96 + index * 280, y: 120 },
      data: mergeDefaults(definition.data, node.data || {}),
    };
  });

  const edges = (Array.isArray(spec.edges) ? spec.edges : []).map(
    (edge, index) => {
      const sourceOutput = edge.sourceOutput == null ? 1 : edge.sourceOutput;
      const sourceHandle =
        edge.sourceHandle || `${edge.source}-output-${sourceOutput}`;
      const targetHandle = edge.targetHandle || `${edge.target}-input-1`;
      return {
        id: edge.id || `edge-${index + 1}`,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        class: `source-${sourceHandle} target-${targetHandle}`,
      };
    }
  );

  let { globalData } = spec;
  if (globalData == null) globalData = '{}';
  else if (typeof globalData !== 'string')
    globalData = JSON.stringify(globalData);

  const version = extensionVersion();
  const workflow = {
    extVersion: version,
    name: spec.name || 'Untitled workflow',
    icon: spec.icon || 'riGlobalLine',
    version,
    table: Array.isArray(spec.table) ? spec.table : [],
    settings: mergeDefaults(DEFAULT_SETTINGS, spec.settings || {}),
    globalData,
    description: spec.description || '',
    drawflow: {
      nodes,
      edges,
      zoom: typeof spec.zoom === 'number' ? spec.zoom : 1,
      x: 0,
      y: 0,
    },
  };

  if (spec.includedWorkflows) {
    workflow.includedWorkflows = spec.includedWorkflows;
  }

  return {
    workflow,
    validation: validateWorkflow(workflow, { shared }),
    notes,
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  createWorkflow,
  mergeDefaults,
  extensionVersion,
};

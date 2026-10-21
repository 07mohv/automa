const fs = require('fs');
const path = require('path');
const { loadBlocks } = require('./load-blocks');
const { FIELD_ENUMS, OUTPUT_NOTES } = require('./field-hints');

const SCHEMA_DIR = path.join(__dirname, 'schema');
const WORKFLOW_SCHEMA_PATH = path.join(SCHEMA_DIR, 'workflow.schema.json');
const CATALOG_PATH = path.join(__dirname, 'BLOCK_CATALOG.md');

const ON_ERROR = {
  type: 'object',
  additionalProperties: true,
  description:
    'Optional error policy for this block. Enable it and set toDo to "fallback" to use the output-fallback handle.',
  properties: {
    enable: { type: 'boolean', default: false },
    retry: { type: 'boolean', default: false },
    retryTimes: { type: 'number', default: 1 },
    retryInterval: { type: 'number', default: 2 },
    toDo: {
      type: 'string',
      enum: ['error', 'continue', 'fallback', 'restart'],
      default: 'error',
    },
    errorMessage: { type: 'string', default: '' },
    insertData: { type: 'boolean', default: false },
    dataToInsert: { type: 'array', items: {} },
  },
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function enumFor(blockId, key) {
  const specific = FIELD_ENUMS[blockId] && FIELD_ENUMS[blockId][key];
  if (specific) return specific;
  const shared = FIELD_ENUMS['*'][key];
  return shared || null;
}

function inferSchema(value, blockId, key, applyEnum) {
  if (value === null) {
    return {
      description: 'Null until the editor fills this value.',
    };
  }

  if (Array.isArray(value)) {
    const schema = { type: 'array' };
    if (value.length > 0)
      schema.items = inferSchema(value[0], blockId, key, false);
    else schema.items = {};
    return schema;
  }

  const valueType = typeof value;
  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean'
  ) {
    const schema = { type: valueType, default: value };
    if (applyEnum) {
      const options = enumFor(blockId, key);
      if (options) schema.enum = options;
    }
    return schema;
  }

  if (valueType === 'object') {
    const properties = {};
    Object.keys(value).forEach((childKey) => {
      properties[childKey] = inferSchema(
        value[childKey],
        blockId,
        childKey,
        false
      );
    });
    return {
      type: 'object',
      additionalProperties: true,
      properties,
    };
  }

  return {};
}

function outputHandles(blockId, definition) {
  if (blockId === 'conditions') {
    return ['output-{condition.id}', 'output-fallback'];
  }
  if (definition.component === 'BlockBasicWithFallback') {
    return ['output-1', 'output-fallback'];
  }
  const count = definition.outputs || 0;
  const handles = [];
  for (let index = 1; index <= count; index += 1) {
    handles.push(`output-${index}`);
  }
  if (
    count <= 1 &&
    definition.component === 'BlockBasic' &&
    definition.outputs !== 0
  ) {
    handles.push(
      'output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")'
    );
  }
  return handles;
}

function blockSchema(blockId, definition, categories, excludeOnError) {
  const data = inferSchema(definition.data || {}, blockId, '', false);
  if (data.properties) {
    Object.keys(data.properties).forEach((key) => {
      const options = enumFor(blockId, key);
      if (options && data.properties[key].type === 'string') {
        data.properties[key].enum = options;
      }
    });
  }
  if (!excludeOnError.includes(blockId)) {
    data.properties = data.properties || {};
    data.properties.onError = JSON.parse(JSON.stringify(ON_ERROR));
    data.properties.settings = {
      type: 'object',
      additionalProperties: true,
      properties: {
        debugMode: { type: 'boolean', default: false },
      },
    };
  }

  const refDataKeys = definition.refDataKeys || [];
  refDataKeys.forEach((key) => {
    const rootKey = key.split('.')[0];
    if (data.properties && data.properties[rootKey]) {
      const property = data.properties[rootKey];
      property.description = [
        property.description,
        'Supports Automa templating such as {{variables@name}} or {{globalData@key}}.',
      ]
        .filter(Boolean)
        .join(' ');
      property['x-templated'] = true;
    }
  });

  return {
    title: definition.name,
    description: definition.description || definition.name,
    'x-blockId': blockId,
    'x-category': definition.category,
    'x-categoryName': categories[definition.category]
      ? categories[definition.category].name
      : definition.category,
    'x-component': definition.component,
    'x-inputs': definition.inputs || 0,
    'x-outputs': definition.outputs || 0,
    'x-outputHandles': outputHandles(blockId, definition),
    'x-outputNote': OUTPUT_NOTES[blockId] || '',
    'x-refDataKeys': refDataKeys,
    'x-disableEdit': Boolean(definition.disableEdit),
    type: 'object',
    additionalProperties: true,
    properties: {
      data,
    },
  };
}

function buildSchema(shared = loadBlocks()) {
  const { tasks, categories, excludeOnError } = shared;
  const blockIds = Object.keys(tasks);
  const blocks = {};

  blockIds.forEach((blockId) => {
    blocks[blockId] = blockSchema(
      blockId,
      tasks[blockId],
      categories,
      excludeOnError
    );
  });

  const workflow = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://automa.local/schema/workflow.schema.json',
    title: 'Automa workflow',
    description:
      'Workflow file imported and exported by Automa (.automa.json). drawflow.nodes and drawflow.edges are the Vue Flow graph used by the editor and the runner. A legacy Drawflow document is still accepted by the runner and by the Automa validator.',
    type: 'object',
    additionalProperties: true,
    required: ['name', 'drawflow'],
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      icon: { type: 'string', default: 'riGlobalLine' },
      version: { type: 'string' },
      extVersion: { type: 'string' },
      globalData: {
        type: 'string',
        description:
          'JSON text. The runner parses it into globalData. Reference a key with {{globalData@key}}.',
        default: '{}',
      },
      table: {
        type: 'array',
        description: 'Column definitions for the workflow table.',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
          },
        },
      },
      settings: {
        type: 'object',
        additionalProperties: true,
        properties: {
          blockDelay: { type: 'number', default: 0 },
          saveLog: { type: 'boolean', default: true },
          debugMode: { type: 'boolean', default: false },
          restartTimes: { type: 'number', default: 3 },
          notification: { type: 'boolean', default: true },
          execContext: { type: 'string', default: 'popup' },
          reuseLastState: { type: 'boolean', default: false },
          inputAutocomplete: { type: 'boolean', default: true },
          onError: {
            type: 'string',
            enum: ['keep-running', 'stop-workflow', 'restart-workflow'],
            default: 'stop-workflow',
          },
          executedBlockOnWeb: { type: 'boolean', default: false },
          insertDefaultColumn: { type: 'boolean', default: false },
          defaultColumnName: { type: 'string', default: 'column' },
        },
      },
      includedWorkflows: {
        type: 'object',
        additionalProperties: { $ref: '#' },
        description:
          'Workflows referenced by execute-workflow blocks, keyed by workflow id. Present only in an export.',
      },
      drawflow: {
        description:
          'Vue Flow graph. nodes[].label is the block id. edges connect {sourceId}-output-N to {targetId}-input-1.',
        type: 'object',
        additionalProperties: true,
        properties: {
          nodes: {
            type: 'array',
            items: { $ref: '#/$defs/node' },
          },
          edges: {
            type: 'array',
            items: { $ref: '#/$defs/edge' },
          },
          zoom: { type: 'number' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
      },
    },
    $defs: {
      edge: {
        type: 'object',
        additionalProperties: true,
        required: ['source', 'target', 'sourceHandle', 'targetHandle'],
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          target: { type: 'string' },
          sourceHandle: {
            type: 'string',
            description:
              '{sourceNodeId}-output-1, or output-fallback, or output-{conditionId}.',
          },
          targetHandle: {
            type: 'string',
            description:
              '{targetNodeId}-input-1. The trigger block has no input.',
          },
        },
      },
      node: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'label', 'data'],
        properties: {
          id: { type: 'string', minLength: 1 },
          label: {
            type: 'string',
            description:
              'Built-in block id. Custom package blocks are not in this enum; the Automa validator reports them as warnings.',
            enum: blockIds,
          },
          type: {
            type: 'string',
            description:
              'Vue component used by the editor. Use the x-component value from the block definition.',
          },
          position: {
            type: 'object',
            additionalProperties: true,
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
          },
          data: {
            type: 'object',
            additionalProperties: true,
            description: 'Block parameters. See $defs/blocks for each label.',
          },
        },
        allOf: blockIds.map((blockId) => ({
          if: {
            properties: { label: { const: blockId } },
            required: ['label'],
          },
          then: {
            properties: {
              data: {
                $ref: `#/$defs/blocks/${blockId}/properties/data`,
              },
            },
          },
        })),
      },
      blocks,
    },
    'x-blockIds': blockIds,
    'x-categories': Object.keys(categories).map((id) => ({
      id,
      name: categories[id].name,
    })),
  };

  return workflow;
}

function parameterLines(schema, indent) {
  const properties = (schema && schema.properties) || {};
  return Object.keys(properties)
    .map((key) => {
      const property = properties[key];
      const typeName = property.type || 'any';
      const extra = [];
      if (property.enum) extra.push(`one of ${property.enum.join(', ')}`);
      if (Object.prototype.hasOwnProperty.call(property, 'default')) {
        extra.push(`default ${JSON.stringify(property.default)}`);
      }
      if (property['x-templated']) extra.push('templated');
      const suffix = extra.length ? ` — ${extra.join('; ')}` : '';
      return `${indent}- \`${key}\` (${typeName})${suffix}`;
    })
    .join('\n');
}

function buildCatalog(schema = buildSchema()) {
  const { blocks } = schema.$defs;
  const lines = [
    '# Automa block catalog',
    '',
    'Generated from `src/utils/shared.js`. Do not edit by hand.',
    'Regenerate with `pnpm agent:schema`.',
    '',
    'Block parameters live on `drawflow.nodes[].data`.',
    'Connect blocks with `sourceHandle: "{sourceId}-output-1"` and `targetHandle: "{targetId}-input-1"` unless a block documents another handle.',
    'Templated fields accept `{{variables@name}}`, `{{globalData@key}}`, `{{loopData@loopId}}`, and `{{table@column}}`.',
    '',
  ];

  schema['x-categories'].forEach((category) => {
    const ids = Object.keys(blocks).filter(
      (blockId) => blocks[blockId]['x-category'] === category.id
    );
    lines.push(`## ${category.name}`);
    lines.push('');
    ids.forEach((blockId) => {
      const block = blocks[blockId];
      lines.push(`### \`${blockId}\``);
      lines.push('');
      lines.push(block.description || block.title);
      lines.push('');
      lines.push(`- Component: \`${block['x-component']}\``);
      lines.push(
        `- Handles: inputs \`${
          block['x-inputs'] ? 'input-1' : '(none)'
        }\`, outputs \`${block['x-outputHandles'].join('`, `') || '(none)'}\``
      );
      if (block['x-outputNote']) lines.push(`- ${block['x-outputNote']}`);
      if (block['x-refDataKeys'].length) {
        lines.push(
          `- Templated fields: ${block['x-refDataKeys']
            .map((key) => `\`${key}\``)
            .join(', ')}`
        );
      }
      lines.push('- Parameters:');
      lines.push(parameterLines(block.properties.data, '  ') || '  - (none)');
      lines.push('');
    });
  });

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function writeSchemaFiles(shared) {
  const schema = buildSchema(shared);
  fs.mkdirSync(SCHEMA_DIR, { recursive: true });
  fs.writeFileSync(
    WORKFLOW_SCHEMA_PATH,
    `${JSON.stringify(schema, null, 2)}\n`
  );
  fs.writeFileSync(CATALOG_PATH, buildCatalog(schema));
  return {
    schemaPath: WORKFLOW_SCHEMA_PATH,
    catalogPath: CATALOG_PATH,
    blockCount: schema['x-blockIds'].length,
  };
}

function readWorkflowSchema() {
  return JSON.parse(fs.readFileSync(WORKFLOW_SCHEMA_PATH, 'utf8'));
}

module.exports = {
  SCHEMA_DIR,
  WORKFLOW_SCHEMA_PATH,
  CATALOG_PATH,
  ON_ERROR,
  buildSchema,
  buildCatalog,
  writeSchemaFiles,
  readWorkflowSchema,
  cloneJson,
  inferSchema,
  outputHandles,
};

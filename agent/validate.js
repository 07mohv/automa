const { loadBlocks } = require('./load-blocks');
const { buildSchema } = require('./schema');
const { SELECTOR_BLOCKS } = require('./field-hints');
const { lintPatterns } = require('./lint-patterns');

function isBlank(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function issue(severity, code, issuePath, message, fix) {
  return {
    severity,
    code,
    path: issuePath,
    message,
    fix,
  };
}

function nodePath(index, suffix) {
  return suffix
    ? `drawflow.nodes[${index}].${suffix}`
    : `drawflow.nodes[${index}]`;
}

function parseDrawflow(workflow, warnings) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return { error: 'Workflow must be a JSON object.' };
  }

  let { drawflow } = workflow;
  if (typeof drawflow === 'string') {
    try {
      drawflow = JSON.parse(drawflow);
      warnings.push(
        issue(
          'warning',
          'string-drawflow',
          'drawflow',
          'drawflow is a JSON string. The editor stores an object.',
          'Parse the string and save drawflow as an object before importing.'
        )
      );
    } catch (error) {
      return { error: `drawflow is not valid JSON: ${error.message}` };
    }
  }

  if (!drawflow || typeof drawflow !== 'object') {
    return { error: 'drawflow is missing. Add { nodes: [], edges: [] }.' };
  }

  if (Array.isArray(drawflow.nodes) && Array.isArray(drawflow.edges)) {
    return { drawflow };
  }

  const legacyBlocks =
    drawflow.drawflow && drawflow.drawflow.Home
      ? drawflow.drawflow.Home.data
      : null;
  if (legacyBlocks && typeof legacyBlocks === 'object') {
    warnings.push(
      issue(
        'warning',
        'legacy-drawflow',
        'drawflow',
        'This file still uses the legacy Drawflow editor format. The runner converts it, and the current editor stores Vue Flow nodes and edges.',
        'Run `node agent/cli.js normalize file.automa.json` or rebuild the graph with create_workflow.'
      )
    );
    return { drawflow: legacyToVueFlow(legacyBlocks) };
  }

  return {
    error:
      'drawflow.nodes and drawflow.edges must be arrays. Legacy files need drawflow.drawflow.Home.data.',
  };
}

function legacyToVueFlow(blocks) {
  const values = Object.values(blocks);
  const trigger = values.find((block) => block && block.name === 'trigger');
  const nodes = [];
  const edges = [];
  const seen = new Set();

  function visit(blockId) {
    if (!blockId || seen.has(blockId)) return;
    const block = blocks[blockId];
    if (!block) return;
    seen.add(blockId);
    nodes.push({
      id: block.id,
      type: block.html,
      label: block.name,
      position: { x: block.pos_x || 0, y: block.pos_y || 0 },
      data: block.data || {},
    });

    const outputs = Object.values(block.outputs || {});
    const nextIds = [];
    outputs.forEach((output, outputIndex) => {
      let outputName = outputIndex + 1;
      const isLast = outputIndex === outputs.length - 1;
      const isConditions = block.name === 'conditions';
      const isFallback =
        block.html === 'BlockBasicWithFallback' ||
        (block.html === 'BlockBasic' && outputName >= 2);
      if ((isConditions || isFallback) && isLast) outputName = 'fallback';
      if (isConditions && !isLast) {
        const conditions = (block.data && block.data.conditions) || [];
        const condition = conditions[outputIndex];
        outputName = condition && condition.id ? condition.id : outputName;
      }
      (output.connections || []).forEach((connection) => {
        const sourceHandle = `${block.id}-output-${outputName}`;
        const targetHandle = `${connection.node}-${String(
          connection.output || 'input_1'
        ).replace('_', '-')}`;
        edges.push({
          id: `vueflow__edge-${sourceHandle}-${targetHandle}`,
          source: block.id,
          target: connection.node,
          sourceHandle,
          targetHandle,
        });
        nextIds.push(connection.node);
      });
    });
    nextIds.forEach(visit);
  }

  if (trigger) visit(trigger.id);
  return { nodes, edges, zoom: 1 };
}

function expectedType(schema) {
  if (!schema || schema.type == null) return null;
  return schema.type;
}

function checkValue(schema, value, issuePath, errors, warnings) {
  if (!schema || value === undefined) return;
  if (value === null) return;

  const typeName = expectedType(schema);
  if (typeName === 'array') {
    if (!Array.isArray(value)) {
      errors.push(
        issue(
          'error',
          'invalid-type',
          issuePath,
          `Expected an array and received ${typeof value}.`,
          'Replace the value with an array.'
        )
      );
      return;
    }
    if (schema.items && schema.items.type && value.length) {
      value.forEach((item, index) => {
        checkValue(
          schema.items,
          item,
          `${issuePath}[${index}]`,
          errors,
          warnings
        );
      });
    }
    return;
  }

  if (typeName === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push(
        issue(
          'error',
          'invalid-type',
          issuePath,
          `Expected an object and received ${
            Array.isArray(value) ? 'an array' : typeof value
          }.`,
          'Replace the value with an object.'
        )
      );
      return;
    }
    const properties = schema.properties || {};
    Object.keys(properties).forEach((key) => {
      if (value[key] !== undefined) {
        checkValue(
          properties[key],
          value[key],
          `${issuePath}.${key}`,
          errors,
          warnings
        );
      }
    });
    return;
  }

  if (typeName === 'boolean' && typeof value !== 'boolean') {
    errors.push(
      issue(
        'error',
        'invalid-type',
        issuePath,
        `Expected a boolean and received ${typeof value}.`,
        'Use true or false.'
      )
    );
    return;
  }

  if (typeName === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      checkEnum(schema, value, issuePath, warnings);
      return;
    }
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      !Number.isNaN(Number(value))
    ) {
      warnings.push(
        issue(
          'warning',
          'numeric-string',
          issuePath,
          `Expected a number and received the numeric string ${JSON.stringify(
            value
          )}.`,
          'Store this field as a number when you generate a new workflow.'
        )
      );
      return;
    }
    errors.push(
      issue(
        'error',
        'invalid-type',
        issuePath,
        `Expected a number and received ${typeof value}.`,
        'Use a JSON number.'
      )
    );
    return;
  }

  if (typeName === 'string') {
    if (typeof value === 'string') {
      checkEnum(schema, value, issuePath, warnings);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      warnings.push(
        issue(
          'warning',
          'string-coercion',
          issuePath,
          `Expected a string and received ${typeof value}.`,
          'Wrap the value in quotes.'
        )
      );
      return;
    }
    errors.push(
      issue(
        'error',
        'invalid-type',
        issuePath,
        `Expected a string and received ${typeof value}.`,
        'Use a JSON string.'
      )
    );
  }
}

function checkEnum(schema, value, issuePath, warnings) {
  if (!schema.enum || schema.enum.includes(value) || value === '') return;
  warnings.push(
    issue(
      'warning',
      'unknown-option',
      issuePath,
      `Value ${JSON.stringify(value)} is not one of: ${schema.enum.join(
        ', '
      )}.`,
      `Use one of: ${schema.enum.join(', ')}.`
    )
  );
}

function outputNames(blockId, definition, data, excludeOnError) {
  if (blockId === 'conditions') {
    const names = (data.conditions || [])
      .filter((item) => item && item.id)
      .map((item) => String(item.id));
    if ((data.conditions || []).length > 0) names.push('fallback');
    return names;
  }

  if (definition.component === 'BlockBasicWithFallback') {
    return ['1', 'fallback'];
  }

  const names = [];
  const count = definition.outputs || 0;
  for (let index = 1; index <= Math.max(count, 0); index += 1) {
    names.push(String(index));
  }
  const fallbackAllowed =
    !excludeOnError.includes(blockId) &&
    data.onError &&
    data.onError.enable &&
    data.onError.toDo === 'fallback';
  if (fallbackAllowed) names.push('fallback');
  return names;
}

function addRequired(errors, index, node, field, message, fix) {
  errors.push(
    issue(
      'error',
      'empty-required',
      nodePath(index, `data.${field}`),
      message,
      fix
    )
  );
}

function validateRequired(node, index, errors) {
  const data = node.data || {};
  if (data.disableBlock) return;
  const { label } = node;

  if (SELECTOR_BLOCKS.includes(label) && isBlank(data.selector)) {
    addRequired(
      errors,
      index,
      node,
      'selector',
      `Block "${label}" (${node.id}) needs a CSS selector or XPath in data.selector.`,
      'Set data.selector, for example "h1" or "//button[1]". Set data.findBy to "xpath" when the selector is an XPath.'
    );
  }

  if (label === 'attribute-value' && isBlank(data.attributeName)) {
    addRequired(
      errors,
      index,
      node,
      'attributeName',
      `Block "attribute-value" (${node.id}) needs data.attributeName.`,
      'Set data.attributeName to the attribute to read, for example "href".'
    );
  }

  if (label === 'new-tab' && isBlank(data.url)) {
    addRequired(
      errors,
      index,
      node,
      'url',
      `Block "new-tab" (${node.id}) needs data.url.`,
      'Set data.url to an absolute URL such as "https://example.com".'
    );
  }

  if (label === 'execute-workflow' && isBlank(data.workflowId)) {
    addRequired(
      errors,
      index,
      node,
      'workflowId',
      `Block "execute-workflow" (${node.id}) needs data.workflowId.`,
      'Set data.workflowId to the id of a workflow that is already stored in Automa, or include that workflow in includedWorkflows.'
    );
  }

  if (label === 'proxy' && isBlank(data.host)) {
    addRequired(
      errors,
      index,
      node,
      'host',
      `Block "proxy" (${node.id}) needs data.host.`,
      'Set data.host to the proxy host.'
    );
  }

  if (
    label === 'close-tab' &&
    data.closeType === 'tab' &&
    !data.activeTab &&
    isBlank(data.url)
  ) {
    addRequired(
      errors,
      index,
      node,
      'url',
      `Block "close-tab" (${node.id}) needs a match pattern when activeTab is false.`,
      'Set data.url to a match pattern such as "https://example.com/*", or set data.activeTab to true.'
    );
  }

  if (label === 'switch-tab') {
    if (data.findTabBy === 'match-patterns' && isBlank(data.matchPattern)) {
      addRequired(
        errors,
        index,
        node,
        'matchPattern',
        `Block "switch-tab" (${node.id}) needs data.matchPattern.`,
        'Set data.matchPattern to a pattern such as "https://example.com/*".'
      );
    }
    if (data.findTabBy === 'tab-title' && isBlank(data.tabTitle)) {
      addRequired(
        errors,
        index,
        node,
        'tabTitle',
        `Block "switch-tab" (${node.id}) needs data.tabTitle.`,
        'Set data.tabTitle to the tab title, or change data.findTabBy.'
      );
    }
  }

  if (
    label === 'take-screenshot' &&
    data.type === 'element' &&
    isBlank(data.selector)
  ) {
    addRequired(
      errors,
      index,
      node,
      'selector',
      `Block "take-screenshot" (${node.id}) needs data.selector when type is "element".`,
      'Set data.selector, or set data.type to "page".'
    );
  }

  if (label === 'webhook' && isBlank(data.url)) {
    addRequired(
      errors,
      index,
      node,
      'url',
      `Block "webhook" (${node.id}) needs data.url.`,
      'Set data.url to the request URL.'
    );
  }

  if (label === 'google-sheets') {
    if (isBlank(data.spreadsheetId)) {
      addRequired(
        errors,
        index,
        node,
        'spreadsheetId',
        `Block "google-sheets" (${node.id}) needs data.spreadsheetId.`,
        'Set data.spreadsheetId to the spreadsheet id.'
      );
    }
    if (isBlank(data.range)) {
      addRequired(
        errors,
        index,
        node,
        'range',
        `Block "google-sheets" (${node.id}) needs data.range.`,
        'Set data.range, for example "Sheet1!A1:B10".'
      );
    }
  }

  if (label === 'export-data') {
    if (data.dataToExport === 'variable' && isBlank(data.variableName)) {
      addRequired(
        errors,
        index,
        node,
        'variableName',
        `Block "export-data" (${node.id}) needs data.variableName when dataToExport is "variable".`,
        'Set data.variableName to the variable that should be exported.'
      );
    }
    if (data.dataToExport === 'google-sheets' && isBlank(data.refKey)) {
      addRequired(
        errors,
        index,
        node,
        'refKey',
        `Block "export-data" (${node.id}) needs data.refKey when dataToExport is "google-sheets".`,
        'Set data.refKey to the reference key used by the Google Sheets block.'
      );
    }
  }

  if (label === 'loop-data') {
    if (isBlank(data.loopId)) {
      addRequired(
        errors,
        index,
        node,
        'loopId',
        `Block "loop-data" (${node.id}) needs data.loopId.`,
        'Set data.loopId to a short id such as "items". Reference the current value with {{loopData@items}}.'
      );
    }
    if (data.loopThrough === 'google-sheets' && isBlank(data.referenceKey)) {
      addRequired(
        errors,
        index,
        node,
        'referenceKey',
        `Block "loop-data" (${node.id}) needs data.referenceKey.`,
        'Set data.referenceKey to the Google Sheets reference key.'
      );
    }
    if (data.loopThrough === 'variable' && isBlank(data.variableName)) {
      addRequired(
        errors,
        index,
        node,
        'variableName',
        `Block "loop-data" (${node.id}) needs data.variableName.`,
        'Set data.variableName to the variable that holds the array.'
      );
    }
  }

  if (label === 'loop-elements') {
    if (isBlank(data.loopId)) {
      addRequired(
        errors,
        index,
        node,
        'loopId',
        `Block "loop-elements" (${node.id}) needs data.loopId.`,
        'Set data.loopId to a short id such as "cards".'
      );
    }
    if (isBlank(data.selector)) {
      addRequired(
        errors,
        index,
        node,
        'selector',
        `Block "loop-elements" (${node.id}) needs data.selector.`,
        'Set data.selector to the elements to loop, for example "article h2".'
      );
    }
    if (
      ['click-element', 'click-link'].includes(data.loadMoreAction) &&
      isBlank(data.actionElSelector)
    ) {
      addRequired(
        errors,
        index,
        node,
        'actionElSelector',
        `Block "loop-elements" (${node.id}) needs data.actionElSelector.`,
        'Set data.actionElSelector to the element that loads more items, or set data.loadMoreAction to "none".'
      );
    }
  }

  if (label === 'press-key') {
    const keyMissing =
      !data.action || (data.action === 'press-key' && isBlank(data.keys));
    const comboMissing =
      data.action === 'multiple-keys' && isBlank(data.keysToPress);
    if (keyMissing || comboMissing) {
      addRequired(
        errors,
        index,
        node,
        data.action === 'multiple-keys' ? 'keysToPress' : 'keys',
        `Block "press-key" (${node.id}) needs the keys to press.`,
        'Set data.keys to a key such as "Enter", or set data.action to "multiple-keys" and fill data.keysToPress.'
      );
    }
  }

  if (
    label === 'switch-to' &&
    data.windowType === 'iframe' &&
    isBlank(data.selector)
  ) {
    addRequired(
      errors,
      index,
      node,
      'selector',
      `Block "switch-to" (${node.id}) needs data.selector when windowType is "iframe".`,
      'Set data.selector to the iframe, or set data.windowType to "main-window".'
    );
  }

  if (label === 'upload-file') {
    const paths = Array.isArray(data.filePaths) ? data.filePaths : [];
    if (paths.some((filePath) => isBlank(filePath))) {
      addRequired(
        errors,
        index,
        node,
        'filePaths',
        `Block "upload-file" (${node.id}) has an empty file path.`,
        'Fill every data.filePaths entry with an absolute file path.'
      );
    }
  }

  if (
    label === 'save-assets' &&
    data.type === 'element' &&
    isBlank(data.selector)
  ) {
    addRequired(
      errors,
      index,
      node,
      'selector',
      `Block "save-assets" (${node.id}) needs data.selector when type is "element".`,
      'Set data.selector, or change data.type to "url" and set data.url.'
    );
  }

  if (label === 'trigger') validateTrigger(node, index, errors);
}

function validateTrigger(node, index, errors) {
  const data = node.data || {};
  const triggers = Array.isArray(data.triggers) ? data.triggers : null;
  const items = triggers
    ? triggers.map((trigger) => ({
        type: trigger.type,
        data: trigger.data || {},
        where: `triggers`,
      }))
    : [{ type: data.type, data, where: 'data' }];

  items.forEach((item) => {
    const required = {
      'cron-job': ['expression', 'Cron expression, for example "0 * * * *"'],
      'context-menu': ['contextMenuName', 'Context menu title'],
      date: ['date', 'Date in the format used by the trigger block'],
      'visit-web': ['url', 'URL or match pattern that starts the workflow'],
      'keyboard-shortcut': ['shortcut', 'Shortcut such as "alt+shift+k"'],
    }[item.type];
    if (!required) return;
    const [field, hint] = required;
    if (!isBlank(item.data[field])) return;
    errors.push(
      issue(
        'error',
        'empty-required',
        nodePath(index, `data.${field}`),
        `Trigger "${item.type}" on block ${node.id} needs "${field}".`,
        `Set ${field}. ${hint}.`
      )
    );
  });
}

function validateWorkflow(workflow, options = {}) {
  const shared = options.shared || loadBlocks();
  const schema = options.schema || buildSchema(shared);
  const errors = [];
  const warnings = [];
  const { tasks } = shared;
  const { excludeOnError } = shared;

  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return result(
      false,
      [
        issue(
          'error',
          'invalid-workflow',
          '',
          'Workflow must be a JSON object.',
          'Pass the workflow object produced by create_workflow or exported from Automa.'
        ),
      ],
      warnings
    );
  }

  if (isBlank(workflow.name)) {
    errors.push(
      issue(
        'error',
        'empty-required',
        'name',
        'Workflow name is empty.',
        'Set name to a short human-readable title.'
      )
    );
  }

  const parsed = parseDrawflow(workflow, warnings);
  if (parsed.error) {
    errors.push(
      issue(
        'error',
        'missing-drawflow',
        'drawflow',
        parsed.error,
        'Use drawflow: { nodes: [], edges: [] } with one trigger node.'
      )
    );
    return result(false, errors, warnings);
  }

  const { nodes, edges } = parsed.drawflow;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    errors.push(
      issue(
        'error',
        'invalid-nodes',
        'drawflow',
        'drawflow.nodes and drawflow.edges must be arrays.',
        'Set both to arrays. nodes can be empty only for a draft that is not run.'
      )
    );
    return result(false, errors, warnings);
  }

  const blockSchemas = schema.$defs.blocks;
  const ids = new Set();
  const triggers = [];

  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') {
      errors.push(
        issue(
          'error',
          'invalid-nodes',
          nodePath(index),
          'A node must be an object.',
          'Each node needs id, label, and data.'
        )
      );
      return;
    }
    if (isBlank(node.id)) {
      errors.push(
        issue(
          'error',
          'missing-node-id',
          nodePath(index, 'id'),
          'A node is missing id.',
          'Set id to a unique string.'
        )
      );
    } else if (ids.has(node.id)) {
      errors.push(
        issue(
          'error',
          'duplicate-node-id',
          nodePath(index, 'id'),
          `Node id "${node.id}" is used more than once.`,
          'Give every node a distinct id. Edge handles are built from that id.'
        )
      );
    } else {
      ids.add(node.id);
    }

    if (isBlank(node.label)) {
      errors.push(
        issue(
          'error',
          'missing-block',
          nodePath(index, 'label'),
          'A node is missing label.',
          'Set label to a block id from list_blocks, for example "new-tab".'
        )
      );
      return;
    }

    const definition = tasks[node.label];
    if (!definition) {
      warnings.push(
        issue(
          'warning',
          'unknown-block',
          nodePath(index, 'label'),
          `Block "${node.label}" is not a built-in block.`,
          'Use a built-in block id, or keep this only when the block comes from an installed package.'
        )
      );
    } else if (node.type && node.type !== definition.component) {
      warnings.push(
        issue(
          'warning',
          'component-mismatch',
          nodePath(index, 'type'),
          `Block "${node.label}" is drawn by component "${definition.component}", not "${node.type}".`,
          `Set type to "${definition.component}".`
        )
      );
    }

    if (
      !node.data ||
      typeof node.data !== 'object' ||
      Array.isArray(node.data)
    ) {
      errors.push(
        issue(
          'error',
          'invalid-type',
          nodePath(index, 'data'),
          'Node data must be an object.',
          'Set data to the block parameters. Start from the block defaults returned by get_block_schema.'
        )
      );
      return;
    }

    if (definition && blockSchemas[node.label]) {
      checkValue(
        blockSchemas[node.label].properties.data,
        node.data,
        nodePath(index, 'data'),
        errors,
        warnings
      );
    }

    if (node.label === 'trigger') triggers.push(node);
    if (definition) validateRequired(node, index, errors);

    if (
      !node.position ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number'
    ) {
      warnings.push(
        issue(
          'warning',
          'missing-position',
          nodePath(index, 'position'),
          `Node "${node.id || index}" has no numeric position.`,
          'Set position to { "x": number, "y": number } so the editor can place the block.'
        )
      );
    }
  });

  if (triggers.length === 0) {
    errors.push(
      issue(
        'error',
        'missing-trigger',
        'drawflow.nodes',
        'The workflow has no trigger block. The runner starts at the trigger.',
        'Add one node with label "trigger", type "BlockBasic", and data.type "manual" (or another trigger type).'
      )
    );
  } else if (triggers.length > 1) {
    warnings.push(
      issue(
        'warning',
        'multiple-triggers',
        'drawflow.nodes',
        'More than one trigger block is present. The runner uses the first trigger unless a blockId is passed.',
        'Keep a single trigger node.'
      )
    );
  }

  const incoming = new Set();
  edges.forEach((edge, index) => {
    const edgePath = `drawflow.edges[${index}]`;
    if (!edge || typeof edge !== 'object') {
      errors.push(
        issue(
          'error',
          'invalid-edges',
          edgePath,
          'An edge must be an object.',
          'Each edge needs source, target, sourceHandle, and targetHandle.'
        )
      );
      return;
    }
    ['source', 'target', 'sourceHandle', 'targetHandle'].forEach((key) => {
      if (isBlank(edge[key])) {
        errors.push(
          issue(
            'error',
            'invalid-edges',
            `${edgePath}.${key}`,
            `Edge is missing ${key}.`,
            'Set source and target to node ids. sourceHandle is "{source}-output-1". targetHandle is "{target}-input-1".'
          )
        );
      }
    });
    if (edge.source && !ids.has(edge.source)) {
      errors.push(
        issue(
          'error',
          'dangling-edge',
          `${edgePath}.source`,
          `Edge source "${edge.source}" does not match a node id.`,
          'Use the id of an existing node.'
        )
      );
    }
    if (edge.target && !ids.has(edge.target)) {
      errors.push(
        issue(
          'error',
          'dangling-edge',
          `${edgePath}.target`,
          `Edge target "${edge.target}" does not match a node id.`,
          'Use the id of an existing node.'
        )
      );
    }
    if (edge.target) incoming.add(edge.target);

    const sourceNode = nodes.find((node) => node && node.id === edge.source);
    if (!sourceNode || isBlank(edge.sourceHandle)) return;
    const prefix = `${edge.source}-output-`;
    if (!edge.sourceHandle.startsWith(prefix)) {
      errors.push(
        issue(
          'error',
          'invalid-handle',
          `${edgePath}.sourceHandle`,
          `sourceHandle "${edge.sourceHandle}" must start with "${prefix}".`,
          `Use "${prefix}1" for the first output.`
        )
      );
      return;
    }
    const outputName = edge.sourceHandle.slice(prefix.length);
    const definition = tasks[sourceNode.label];
    if (!definition) return;
    const names = outputNames(
      sourceNode.label,
      definition,
      sourceNode.data || {},
      excludeOnError
    );
    if (!names.includes(outputName)) {
      errors.push(
        issue(
          'error',
          'invalid-handle',
          `${edgePath}.sourceHandle`,
          `Block "${sourceNode.label}" (${sourceNode.id}) has no output "${outputName}".`,
          names.length
            ? `Connect sourceHandle to one of: ${names
                .map((name) => `${prefix}${name}`)
                .join(', ')}.`
            : 'This block has no output. Remove the edge or choose another block.'
        )
      );
    }

    if (edge.target) {
      const targetNode = nodes.find((node) => node && node.id === edge.target);
      if (targetNode && targetNode.label === 'trigger') {
        warnings.push(
          issue(
            'warning',
            'trigger-input',
            `${edgePath}.target`,
            'An edge points at the trigger. The trigger has no input and is the start of the workflow.',
            'Connect the trigger output to the first real block instead.'
          )
        );
      }
      const expectedTarget = `${edge.target}-input-1`;
      if (edge.targetHandle && edge.targetHandle !== expectedTarget) {
        warnings.push(
          issue(
            'warning',
            'target-handle',
            `${edgePath}.targetHandle`,
            `targetHandle is "${edge.targetHandle}". The editor uses "${expectedTarget}".`,
            `Set targetHandle to "${expectedTarget}".`
          )
        );
      }
    }
  });

  nodes.forEach((node, index) => {
    if (!node || node.label === 'trigger' || node.label === 'note') return;
    if (!node.id || incoming.has(node.id)) return;
    warnings.push(
      issue(
        'warning',
        'unreachable-node',
        nodePath(index, 'id'),
        `Node "${node.id}" (${node.label}) has no incoming edge, so the runner will not reach it.`,
        'Connect it from the previous block, or remove it.'
      )
    );
  });

  lintPatterns({ workflow, nodes, edges, warnings, tasks });

  if (workflow.globalData != null && typeof workflow.globalData !== 'string') {
    warnings.push(
      issue(
        'warning',
        'global-data-type',
        'globalData',
        'globalData should be a JSON string. The stored workflow format uses a string, which the runner parses.',
        'JSON.stringify the object before saving the workflow.'
      )
    );
  } else if (
    typeof workflow.globalData === 'string' &&
    workflow.globalData.trim()
  ) {
    try {
      JSON.parse(workflow.globalData);
    } catch (error) {
      errors.push(
        issue(
          'error',
          'invalid-global-data',
          'globalData',
          `globalData is not valid JSON: ${error.message}`,
          'Set globalData to a JSON string such as "{\\"key\\":\\"value\\"}".'
        )
      );
    }
  }

  return result(errors.length === 0, errors, warnings);
}

function result(ok, errors, warnings) {
  return {
    ok,
    errors,
    warnings,
  };
}

const STRUCTURAL_CODES = new Set([
  'invalid-workflow',
  'missing-drawflow',
  'invalid-nodes',
  'invalid-edges',
  'missing-node-id',
  'duplicate-node-id',
  'missing-block',
  'dangling-edge',
  'missing-trigger',
  'invalid-handle',
  'invalid-global-data',
]);

function isStructuralError(item) {
  if (item.code === 'invalid-type') {
    return item.path === 'drawflow' || item.path.endsWith('.data');
  }
  return STRUCTURAL_CODES.has(item.code);
}

module.exports = {
  validateWorkflow,
  isStructuralError,
  legacyToVueFlow,
  parseDrawflow,
};

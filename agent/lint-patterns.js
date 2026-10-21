const { SELECTOR_BLOCKS } = require('./field-hints');

const RETRY_BLOCKS = new Set([
  'new-tab',
  'event-click',
  'get-text',
  'forms',
  'hover-element',
  'attribute-value',
  'link',
  'element-scroll',
  'upload-file',
  'create-element',
  'trigger-event',
  'loop-elements',
  'loop-data',
  'switch-tab',
  'reload-tab',
]);

const SELECTOR_FIELDS = ['selector', 'elementSelector', 'actionElSelector'];

function isBlank(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function issue(code, issuePath, message, fix) {
  return {
    severity: 'warning',
    code,
    path: issuePath,
    message,
    fix,
  };
}

function nodePath(index, suffix) {
  return `drawflow.nodes[${index}].${suffix}`;
}

function numericTime(value) {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.includes('{{') || text.startsWith('!!')) return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function blockHasWait(tasks, label) {
  const data = tasks[label] && tasks[label].data;
  return Boolean(
    data && Object.prototype.hasOwnProperty.call(data, 'waitForSelector')
  );
}

function errorHandled(data) {
  const { onError } = data;
  if (!onError || !onError.enable) return false;
  if (onError.retry) return true;
  return onError.toDo === 'fallback' || onError.toDo === 'continue';
}

function outgoingMap(edges) {
  const map = new Map();
  edges.forEach((edge) => {
    if (!edge || !edge.source || !edge.target) return;
    if (!map.has(edge.source)) map.set(edge.source, []);
    map.get(edge.source).push(edge.target);
  });
  return map;
}

function reachesBreakpoint(startId, loopId, edges, nodesById) {
  const outgoing = outgoingMap(edges);
  const seen = new Set([startId]);
  const queue = (outgoing.get(startId) || []).slice();
  const expected = String(loopId || '');
  while (queue.length) {
    const current = queue.shift();
    if (!seen.has(current)) {
      seen.add(current);
      const node = nodesById.get(current);
      const data = (node && node.data) || {};
      if (
        node &&
        node.label === 'loop-breakpoint' &&
        String(data.loopId || '') === expected
      ) {
        return true;
      }
      (outgoing.get(current) || []).forEach((target) => queue.push(target));
    }
  }
  return false;
}

function hasOutput(edges, nodeId, outputName) {
  const suffix = `-output-${outputName}`;
  return edges.some(
    (edge) =>
      edge &&
      edge.source === nodeId &&
      typeof edge.sourceHandle === 'string' &&
      edge.sourceHandle.endsWith(suffix)
  );
}

function isBroad(selector) {
  return ['*', 'html', 'body'].includes(selector.toLowerCase());
}

function fragileReason(selector, findBy) {
  if (selector.length > 160) return 'longer than 160 characters';
  const positions = selector.match(/:nth-(?:child|of-type)\(/gi) || [];
  if (positions.length >= 2) {
    return 'it chains several :nth-child or :nth-of-type positions';
  }
  if (
    /^(?:html|body)(?:\s*>\s*(?:html|body|div|span|section|main|article)){2,}/i.test(
      selector
    )
  ) {
    return 'it starts at html or body and walks generic tags';
  }
  if (
    /#ember\d+/i.test(selector) ||
    /react-select/i.test(selector) ||
    /css-[a-z0-9]{4,}/i.test(selector) ||
    /_[A-Za-z0-9]{5,}_[A-Za-z0-9]{5,}/.test(selector) ||
    /\bsc-[a-zA-Z0-9]+/.test(selector)
  ) {
    return 'it contains a generated id or class that changes between builds';
  }
  const indexes = selector.match(/\[\d+\]/g) || [];
  const xpath =
    findBy === 'xpath' || selector.startsWith('/') || selector.startsWith('(');
  if (xpath && indexes.length >= 2) {
    return 'the XPath uses several positional indexes';
  }
  return '';
}

const SELECTOR_FIX =
  'Replace it with a stable CSS selector: [name="..."], [type="..."], [href="..."], [aria-label="..."], or [data-testid="..."]. Inside a loop-elements body use {{loopData@loopId}}. Do not copy :nth-child chains, html/body paths, or generated classes.';

function lintNode(node, index, context) {
  const data = node.data || {};
  if (data.disableBlock) return;
  const { edges, nodesById, warnings, tasks } = context;
  const { label } = node;

  if (label === 'delay') {
    const time = numericTime(data.time);
    const previous = edges
      .filter((edge) => edge && edge.target === node.id)
      .map((edge) => nodesById.get(edge.source))
      .filter(Boolean)
      .map((item) => item.label);
    const afterNavigation = previous.some(
      (item) => item === 'new-tab' || item === 'reload-tab'
    );
    if ((time != null && time >= 500) || afterNavigation) {
      warnings.push(
        issue(
          'prefer-wait',
          nodePath(index, 'data.time'),
          afterNavigation
            ? `Delay "${node.id}" follows a page load. A fixed pause misses slow pages and wastes time on fast ones.`
            : `Delay "${node.id}" waits a fixed ${time}ms. Fixed delays are slower and less reliable than waiting for the page or the element.`,
          'Delete this delay. Set new-tab.data.waitTabLoaded to true. On the next click, forms, or get-text block set waitForSelector to true and waitSelectorTimeout to 5000. To branch when an element is missing, use element-exists with tryCount 3 and timeout 1500, and connect output-2.'
        )
      );
    }
  }

  if (
    label === 'new-tab' &&
    !isBlank(data.url) &&
    data.waitTabLoaded !== true
  ) {
    warnings.push(
      issue(
        'enable-wait-tab',
        nodePath(index, 'data.waitTabLoaded'),
        `new-tab "${node.id}" opens a URL with waitTabLoaded false, so the next block can run before the page exists.`,
        'Set data.waitTabLoaded to true and delete any delay that follows this block.'
      )
    );
  }

  if (shouldWaitForSelector(node, tasks) && data.waitForSelector !== true) {
    warnings.push(
      issue(
        'enable-wait-selector',
        nodePath(index, 'data.waitForSelector'),
        `Block "${label}" (${node.id}) uses a selector but does not wait for it.`,
        'Set data.waitForSelector to true and data.waitSelectorTimeout to 5000.'
      )
    );
  }

  if (label === 'element-exists') {
    const tryCount = Number(data.tryCount);
    const timeout = Number(data.timeout);
    if (
      !Number.isNaN(tryCount) &&
      !Number.isNaN(timeout) &&
      tryCount < 2 &&
      timeout < 1000
    ) {
      warnings.push(
        issue(
          'short-existence-check',
          nodePath(index, 'data.timeout'),
          `element-exists "${node.id}" only tries ${tryCount} time(s) and waits ${timeout}ms, so a slow element is treated as missing.`,
          'Set data.tryCount to at least 3 and data.timeout to at least 1500.'
        )
      );
    }
    if (data.throwError !== true && !hasOutput(edges, node.id, '2')) {
      warnings.push(
        issue(
          'unhandled-branch',
          nodePath(index, 'id'),
          `element-exists "${node.id}" has no output-2 edge, so the workflow stops or does nothing when the element is missing.`,
          `Connect sourceHandle "${node.id}-output-2" to the block that should run when the element is missing. Set throwError to true only when a missing element should fail the run.`
        )
      );
    }
  }

  if (RETRY_BLOCKS.has(label) && !errorHandled(data)) {
    warnings.push(
      issue(
        'missing-retry',
        nodePath(index, 'data.onError'),
        `Block "${label}" (${node.id}) has no retry or fallback, so one slow page or missing element stops the workflow.`,
        `Set data.onError to {"enable":true,"retry":true,"retryTimes":2,"retryInterval":1,"toDo":"error"}. Use toDo "fallback" and connect sourceHandle "${node.id}-output-fallback" when the workflow should take another path after the retries.`
      )
    );
  }

  if (
    (label === 'loop-data' || label === 'loop-elements') &&
    isBlank(data.loopId)
  ) {
    warnings.push(
      issue(
        'blank-loop-id',
        nodePath(index, 'data.loopId'),
        `Block "${label}" (${node.id}) has an empty loopId, so the breakpoint and {{loopData@...}} cannot target it.`,
        'Set loopId to a short name such as "items", use that same loopId on the loop-breakpoint, and read the current item with {{loopData@items}}.'
      )
    );
  }

  if (label === 'loop-data' || label === 'loop-elements') {
    if (!reachesBreakpoint(node.id, data.loopId, edges, nodesById)) {
      warnings.push(
        issue(
          'loop-without-breakpoint',
          nodePath(index, 'data.loopId'),
          `Loop "${node.id}" (loopId "${
            data.loopId || ''
          }") has no downstream loop-breakpoint, so the body runs once.`,
          `Add a loop-breakpoint with loopId "${
            data.loopId || 'items'
          }" and connect it at the end of the loop body. Its output-1 runs after the last item.`
        )
      );
    }
  }

  if (label === 'loop-breakpoint' && isBlank(data.loopId)) {
    warnings.push(
      issue(
        'blank-loop-id',
        nodePath(index, 'data.loopId'),
        `loop-breakpoint "${node.id}" has an empty loopId, so it cannot find the loop.`,
        'Set loopId to the same value as the loop-data or loop-elements block.'
      )
    );
  }

  if (isDiscardedRead(label, data)) {
    warnings.push(
      issue(
        'discarded-read',
        nodePath(index, 'data.saveData'),
        `Block "${label}" (${node.id}) reads a value but neither saves it nor assigns a variable.`,
        'Set assignVariable to true and variableName to a name you will read as {{variables@name}}, or set saveData to true and dataColumn to a column id that exists on workflow.table.'
      )
    );
  }

  const { findBy } = data;
  SELECTOR_FIELDS.forEach((field) => {
    if (typeof data[field] !== 'string') return;
    const selector = data[field].trim();
    if (!selector || selector.includes('{{')) return;
    if (isBroad(selector)) {
      warnings.push(
        issue(
          'broad-selector',
          nodePath(index, `data.${field}`),
          `Selector "${selector}" on "${node.id}" matches the whole page.`,
          'Target the element you need, for example h1, input[name="q"], or a[href="https://example.com"].'
        )
      );
      return;
    }
    const reason = fragileReason(selector, findBy);
    if (reason) {
      warnings.push(
        issue(
          'fragile-selector',
          nodePath(index, `data.${field}`),
          `Selector on "${node.id}" is fragile because ${reason}.`,
          SELECTOR_FIX
        )
      );
    }
  });
}

function shouldWaitForSelector(node, tasks) {
  const data = node.data || {};
  if (!blockHasWait(tasks, node.label)) return false;
  if (node.label === 'loop-data') {
    return data.loopThrough === 'elements' && !isBlank(data.elementSelector);
  }
  if (node.label === 'loop-elements') return !isBlank(data.selector);
  if (!SELECTOR_BLOCKS.includes(node.label)) return false;
  if (node.label === 'element-exists') return false;
  return !isBlank(data.selector);
}

function isDiscardedRead(label, data) {
  if (!['get-text', 'attribute-value', 'tab-url'].includes(label)) return false;
  if (label === 'attribute-value' && data.action && data.action !== 'get') {
    return false;
  }
  return data.saveData === false && data.assignVariable !== true;
}

function lintPatterns({ workflow, nodes, edges, warnings, tasks }) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return;
  const nodesById = new Map();
  nodes.forEach((node) => {
    if (node && node.id) nodesById.set(node.id, node);
  });
  const context = { edges, nodesById, warnings, tasks: tasks || {} };
  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object' || !node.label) return;
    lintNode(node, index, context);
  });

  const settings = workflow.settings || {};
  if (Number(settings.blockDelay) > 0) {
    warnings.push(
      issue(
        'high-block-delay',
        'settings.blockDelay',
        `settings.blockDelay is ${settings.blockDelay}ms, so every block pauses even when the page is ready.`,
        'Set settings.blockDelay to 0. Wait with waitTabLoaded and waitForSelector instead of pausing between blocks.'
      )
    );
  }
  if (settings.saveLog === false) {
    warnings.push(
      issue(
        'save-log-disabled',
        'settings.saveLog',
        'settings.saveLog is false, so get_run_logs has no block history after the run.',
        'Set settings.saveLog to true.'
      )
    );
  }
}

module.exports = {
  lintPatterns,
};

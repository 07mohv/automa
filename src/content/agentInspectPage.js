import {
  candidatesFromDescriptor,
  clipText,
  judgeSelector,
} from '@/utils/agentInspect';
import { isXPath } from '@/utils/helper';
import { queryElements } from './handleSelector';

const INTERACTIVE =
  'a, button, input, textarea, select, summary, label, h1, h2, h3, [role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], [contenteditable="true"], [data-testid], [data-test], [data-cy]';

const ATTR_NAMES = [
  'name',
  'type',
  'href',
  'placeholder',
  'aria-label',
  'role',
  'title',
  'alt',
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa',
];

function elementText(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('placeholder') ||
      element.getAttribute('name') ||
      element.value ||
      ''
    );
  }
  return element.innerText || element.textContent || '';
}

function isShown(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function structuralSelector(element) {
  const parts = [];
  let node = element;
  let depth = 0;
  while (
    node &&
    node.nodeType === 1 &&
    node !== document.body &&
    node !== document.documentElement &&
    depth < 4
  ) {
    const tag = node.tagName.toLowerCase();
    let part = tag;
    const parent = node.parentElement;
    if (parent) {
      const current = node;
      const same = Array.from(parent.children).filter(
        (child) => child.tagName === current.tagName
      );
      if (same.length > 1) {
        part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = parent;
    depth += 1;
  }
  return parts.join(' > ');
}

function descriptorFromElement(element) {
  const attributes = {};
  ATTR_NAMES.forEach((name) => {
    const value = element.getAttribute(name);
    if (value) attributes[name] = clipText(value, 160);
  });
  const root = element.getRootNode && element.getRootNode();
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || '',
    text: clipText(elementText(element), 80),
    attributes,
    inShadowRoot: Boolean(root && root.host),
    structural: structuralSelector(element),
  };
}

function hasOpenShadow(doc) {
  const nodes = doc.querySelectorAll('body *');
  const limit = Math.min(nodes.length, 2000);
  for (let index = 0; index < limit; index += 1) {
    if (nodes[index].shadowRoot) return true;
  }
  return false;
}

function snapshotPage(limit) {
  const cap = Math.min(Math.max(Number(limit) || 40, 1), 80);
  const nodes = Array.from(document.querySelectorAll(INTERACTIVE));
  const elements = [];
  nodes.forEach((node) => {
    if (elements.length >= cap) return;
    if (!isShown(node)) return;
    if (
      node.closest &&
      node.closest('#app-container.automa-element-selector')
    ) {
      return;
    }
    const descriptor = descriptorFromElement(node);
    elements.push({
      tag: descriptor.tag,
      role: descriptor.attributes.role || '',
      type: descriptor.attributes.type || '',
      text: descriptor.text,
      inShadowRoot: descriptor.inShadowRoot,
      candidates: candidatesFromDescriptor(descriptor),
    });
  });
  const shadowRoots = hasOpenShadow(document);
  const notes = [];
  if (shadowRoots) {
    notes.push(
      'An open shadow root is present. page_snapshot does not list inside it. Inspect it with evaluate_in_tab, then target it with the >> combinator or a javascript-code block.'
    );
  }
  if (!elements.length) {
    notes.push(
      'No interactive elements were visible. If the page is still loading, call page_snapshot again.'
    );
  }
  return {
    url: window.location.href,
    title: document.title,
    elements,
    truncated: nodes.length > elements.length,
    shadowRoots,
    note: notes.join(' '),
  };
}

async function matchedElements(selector, findBy, waitMs) {
  const detected = findBy || (isXPath(selector) ? 'xpath' : 'cssSelector');
  const wait = Math.min(Math.max(Number(waitMs) || 0, 0), 8000);
  const found = await queryElements({
    selector,
    findBy: detected,
    multiple: true,
    waitForSelector: wait > 0,
    waitSelectorTimeout: wait,
  });
  const list = !found ? [] : Array.from(found);
  return { list, findBy: detected };
}

function clearHighlights() {
  document.querySelectorAll('[data-automa-agent-highlight]').forEach((node) => {
    const previous = node.getAttribute('data-automa-agent-highlight');
    node.style.outline = previous === 'none' ? '' : previous;
    node.removeAttribute('data-automa-agent-highlight');
  });
  if (window.__automaAgentHighlight) {
    clearTimeout(window.__automaAgentHighlight);
    window.__automaAgentHighlight = null;
  }
}

function highlightElements(elements) {
  clearHighlights();
  elements.slice(0, 20).forEach((element) => {
    if (!element || !element.style) return;
    element.setAttribute(
      'data-automa-agent-highlight',
      element.style.outline || 'none'
    );
    element.style.outline = '3px solid #f59e0b';
  });
  window.__automaAgentHighlight = setTimeout(clearHighlights, 2500);
}

async function testSelector({ selector, findBy, highlight, waitMs }) {
  if (!selector || !String(selector).trim()) {
    return {
      ok: false,
      error: 'selector is required. Call page_snapshot and copy a candidate.',
    };
  }
  const { list, findBy: used } = await matchedElements(
    String(selector),
    findBy,
    waitMs
  );
  if (highlight && list.length) highlightElements(list);
  const samples = list.slice(0, 3).map((element) => ({
    tag: element.tagName ? element.tagName.toLowerCase() : '',
    text: clipText(elementText(element), 80),
    visible: isShown(element),
  }));
  const visibleCount = list.filter((element) => isShown(element)).length;
  return {
    ok: true,
    selector: String(selector),
    findBy: used,
    matchCount: list.length,
    visibleCount,
    samples,
    highlighted: Boolean(highlight && list.length),
    robustness: judgeSelector(selector),
    fix:
      list.length === 0
        ? 'Nothing matched. Call page_snapshot and test one of its candidates, or set waitMs while the element appears.'
        : '',
  };
}

function serialize(value, depth = 0) {
  if (value == null) return value;
  const kind = typeof value;
  if (kind === 'string') return clipText(value, 2000);
  if (kind === 'number' || kind === 'boolean') return value;
  if (kind === 'function' || kind === 'symbol') return undefined;
  if (depth > 4) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => serialize(item, depth + 1));
  }
  if (kind === 'object') {
    if (value.nodeType && value.tagName) {
      return {
        tag: String(value.tagName).toLowerCase(),
        text: clipText(elementText(value), 80),
      };
    }
    const output = {};
    Object.keys(value)
      .slice(0, 30)
      .forEach((key) => {
        const next = serialize(value[key], depth + 1);
        if (next !== undefined) output[key] = next;
      });
    return output;
  }
  return String(value);
}

async function runUserCode(code, timeoutMs) {
  const AsyncFunction = Object.getPrototypeOf(async function asyncStub() {
    return null;
  }).constructor;
  let fn;
  try {
    fn = new AsyncFunction('document', 'window', code);
  } catch (error) {
    throw new Error(`JavaScript did not parse: ${error.message}`);
  }
  let timer;
  try {
    return await Promise.race([
      fn(document, window),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`JavaScript timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function evaluateIsolated(code, timeoutMs) {
  const limit = Math.min(Math.max(Number(timeoutMs) || 5000, 200), 15000);
  const source = String(code || '');
  if (!source.trim()) {
    return {
      ok: false,
      error:
        'code is required. It is the body of an async function. Return the JSON value you need.',
    };
  }
  if (source.length > 20000) {
    return { ok: false, error: 'Code is longer than 20000 characters.' };
  }
  try {
    let value = await runUserCode(source, limit);
    if (value === undefined && !/\breturn\b/.test(source)) {
      try {
        value = await runUserCode(`return (${source});`, limit);
      } catch (error) {
        value = undefined;
      }
    }
    return { ok: true, world: 'isolated', value: serialize(value) };
  } catch (error) {
    return { ok: false, world: 'isolated', error: error.message };
  }
}

function summarizeValue(value) {
  return serialize(value);
}

export { evaluateIsolated, snapshotPage, summarizeValue, testSelector };

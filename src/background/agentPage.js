import { IS_FIREFOX } from '@/common/utils/constant';
import injectContentScript from '@/workflowEngine/injectContentScript';
import browser from 'webextension-polyfill';

const PAGE_BLOCKS = new Set([
  'get-text',
  'attribute-value',
  'element-exists',
  'event-click',
  'forms',
  'hover-element',
  'element-scroll',
  'link',
  'trigger-event',
  'javascript-code',
]);

function clip(value, limit = 300) {
  const text = value == null ? '' : String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

function isHttp(url) {
  return /^https?:/i.test(url || '');
}

async function resolveTab(params, { activate = false } = {}) {
  let tab;
  if (params.tabId) {
    tab = await browser.tabs.get(Number(params.tabId));
  } else {
    const [active] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    tab = active;
  }
  if (!tab) {
    throw new Error('No tab. Call open_tab with the page URL, or list_tabs.');
  }
  if (!isHttp(tab.url)) {
    throw new Error(
      `Tab ${tab.id} is not an http(s) page (${
        tab.url || 'blank'
      }). Open the target site with open_tab.`
    );
  }
  if (activate && !tab.active) {
    await browser.tabs.update(tab.id, { active: true });
    tab = await browser.tabs.get(tab.id);
  }
  return tab;
}

function waitUntilComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    let onUpdated;
    const finish = (tab) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(onUpdated);
      resolve(tab);
    };
    onUpdated = (updatedId, info, tab) => {
      if (updatedId === tabId && info.status === 'complete') finish(tab);
    };
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      browser.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('still-loading'));
    }, timeoutMs);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish(tab);
    });
  });
}

async function ensureContentScript(tabId) {
  try {
    const exists = await browser.tabs.sendMessage(
      tabId,
      { type: 'content-script-exists' },
      { frameId: 0 }
    );
    if (exists) return;
  } catch (error) {
    // The page was opened before the extension loaded.
  }
  const injected = await injectContentScript(tabId, 0);
  if (!injected) {
    throw new Error(
      'Automa could not inject into this tab. Reload the page and call page_snapshot again.'
    );
  }
}

async function sendToPage(tabId, message) {
  await ensureContentScript(tabId);
  const response = await browser.tabs.sendMessage(tabId, message, {
    frameId: 0,
  });
  if (!response) {
    throw new Error(
      'The page did not answer. Reload it, then call page_snapshot again.'
    );
  }
  return response;
}

async function listTabs() {
  const tabs = await browser.tabs.query({});
  return {
    tabs: tabs.map((tab) => ({
      tabId: tab.id,
      windowId: tab.windowId,
      active: Boolean(tab.active),
      status: tab.status || '',
      title: clip(tab.title, 120),
      url: clip(tab.url, 300),
      inspectable: isHttp(tab.url),
    })),
  };
}

async function openTab(params) {
  const url = String(params.url || '').trim();
  if (!isHttp(url)) {
    throw new Error(
      'open_tab requires an http(s) URL, for example "https://example.com".'
    );
  }
  const tab = await browser.tabs.create({
    url,
    active: params.active !== false,
  });
  let loaded = true;
  try {
    await waitUntilComplete(tab.id, 12000);
  } catch (error) {
    loaded = false;
  }
  const fresh = await browser.tabs.get(tab.id);
  return {
    tabId: fresh.id,
    url: fresh.url,
    title: fresh.title || '',
    status: fresh.status || '',
    loaded,
    message: loaded
      ? 'Call page_snapshot with this tabId.'
      : 'The tab is still loading. Wait a moment, then call page_snapshot with this tabId.',
  };
}

async function pageSnapshot(params) {
  const tab = await resolveTab(params);
  return sendToPage(tab.id, { type: 'agent:snapshot', limit: params.limit });
}

async function testSelector(params) {
  const tab = await resolveTab(params);
  return sendToPage(tab.id, {
    type: 'agent:test-selector',
    selector: params.selector,
    findBy: params.findBy,
    highlight: Boolean(params.highlight),
    waitMs: params.waitMs,
  });
}

async function evaluateInTab(params) {
  const tab = await resolveTab(params);
  const world = params.world === 'page' ? 'page' : 'isolated';
  const timeoutMs = Math.min(
    Math.max(Number(params.timeoutMs) || 5000, 200),
    15000
  );
  const code = String(params.code || '');
  if (!code.trim()) {
    throw new Error(
      'code is required. Write it as the body of an async function and return a JSON value.'
    );
  }
  if (code.length > 20000) {
    throw new Error('Code is longer than 20000 characters.');
  }
  if (world === 'isolated') {
    return sendToPage(tab.id, {
      type: 'agent:evaluate',
      code,
      timeoutMs,
    });
  }
  if (IS_FIREFOX || browser.runtime.getManifest().manifest_version < 3) {
    throw new Error(
      'Page-world JavaScript is available in Chromium. Use world "isolated", which can still read and edit the DOM.'
    );
  }
  let injected;
  try {
    [injected] = await browser.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      world: 'MAIN',
      func: (source, timeout) => {
        const AsyncFunction = Object.getPrototypeOf(async function asyncStub() {
          return null;
        }).constructor;
        return new Promise((resolve) => {
          let timer;
          const finish = (payload) => {
            clearTimeout(timer);
            resolve(payload);
          };
          timer = setTimeout(() => {
            finish({
              ok: false,
              error: `JavaScript timed out after ${timeout}ms.`,
            });
          }, timeout);
          let fn;
          try {
            fn = new AsyncFunction(source);
          } catch (error) {
            finish({
              ok: false,
              error: `JavaScript did not parse: ${error.message}`,
            });
            return;
          }
          Promise.resolve()
            .then(() => fn())
            .then((value) => finish({ ok: true, world: 'page', value }))
            .catch((error) =>
              finish({
                ok: false,
                world: 'page',
                error: error && error.message ? error.message : String(error),
              })
            );
        });
      },
      args: [code, timeoutMs],
    });
  } catch (error) {
    throw new Error(
      `The page refused JavaScript (${error.message}). Use world "isolated", or put the code in a javascript-code block with context "website".`
    );
  }
  return (injected && injected.result) || { ok: false, error: 'No result.' };
}

async function captureScreenshot(params) {
  const tab = await resolveTab(params, { activate: true });
  const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality: 40,
  });
  if (!dataUrl || dataUrl.length > 1500000) {
    return {
      tabId: tab.id,
      omitted: true,
      message:
        'The screenshot is too large to return. Use page_snapshot, which lists the interactive elements and their selectors.',
    };
  }
  return { tabId: tab.id, format: 'jpeg', dataUrl };
}

async function previewBlock(params) {
  const { block } = params;
  if (!block) throw new Error('block is required, for example "get-text".');
  if (block === 'new-tab') {
    const opened = await openTab({
      url: params.data && params.data.url,
      active: true,
    });
    return { ok: true, block, ...opened };
  }
  if (block === 'reload-tab') {
    const tab = await resolveTab(params);
    await browser.tabs.reload(tab.id);
    return {
      ok: true,
      block,
      tabId: tab.id,
      message: 'Reloaded. Call page_snapshot after the page finishes loading.',
    };
  }
  if (block === 'javascript-code') {
    const context = (params.data && params.data.context) || 'website';
    if (context === 'background') {
      throw new Error(
        'Background JavaScript is not previewed, because it can use extension APIs. Use context "website" and test the DOM part with evaluate_in_tab world "isolated".'
      );
    }
    const code = (params.data && params.data.code) || '';
    const wrapped = [
      'const __vars = {};',
      'let __next;',
      'function automaNextBlock(data) { __next = data; }',
      'function automaSetVariable(name, value) { __vars[name] = value; }',
      'function automaResetTimeout() {}',
      'const __user = async () => {',
      code,
      '};',
      'const __value = await __user();',
      'if (__value !== undefined) return __value;',
      'return { next: __next, variables: __vars };',
    ].join('\n');
    const result = await evaluateInTab({
      tabId: params.tabId,
      code: wrapped,
      world: 'isolated',
      timeoutMs: (params.data && params.data.timeout) || 5000,
    });
    return { ...result, block, world: 'isolated' };
  }
  if (!PAGE_BLOCKS.has(block)) {
    throw new Error(
      `Block "${block}" is not previewed on the page. Build a short workflow and call preview_workflow.`
    );
  }
  const tab = await resolveTab(params);
  const result = await sendToPage(tab.id, {
    type: 'agent:preview-block',
    block,
    data: params.data || {},
  });
  return { tabId: tab.id, ...result };
}

const PAGE_METHODS = {
  list_tabs: listTabs,
  open_tab: openTab,
  page_snapshot: pageSnapshot,
  test_selector: testSelector,
  evaluate_in_tab: evaluateInTab,
  capture_screenshot: captureScreenshot,
  preview_block: previewBlock,
};

function runPageCommand(method, params) {
  const handler = PAGE_METHODS[method];
  if (!handler) return undefined;
  return handler(params || {});
}

export { runPageCommand };

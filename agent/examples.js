const { createWorkflow } = require('./create-workflow');

function pageOnError(toDo = 'error') {
  return {
    enable: true,
    retry: true,
    retryTimes: 2,
    retryInterval: 1,
    toDo,
  };
}

function exampleSpecs() {
  return [
    {
      file: 'read-example-heading.automa.json',
      spec: {
        name: 'Read example.com heading',
        description:
          'Open https://example.com, wait for the page and the h1, and store the heading in the variable "heading".',
        nodes: [
          {
            id: 'trigger',
            block: 'trigger',
            data: {
              type: 'manual',
              description: 'Run from the dashboard or an agent',
            },
          },
          {
            id: 'open',
            block: 'new-tab',
            data: {
              url: 'https://example.com',
              waitTabLoaded: true,
              onError: pageOnError(),
              description: 'Open example.com',
            },
          },
          {
            id: 'read',
            block: 'get-text',
            data: {
              selector: 'h1',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              assignVariable: true,
              variableName: 'heading',
              saveData: false,
              onError: pageOnError(),
              description: 'Read the main heading',
            },
          },
        ],
        edges: [
          { source: 'trigger', target: 'open' },
          { source: 'open', target: 'read' },
        ],
      },
    },
    {
      file: 'fill-httpbin-form.automa.json',
      spec: {
        name: 'Fill the httpbin form',
        description:
          'Open the httpbin form, wait for the name field, type a name, and click submit.',
        nodes: [
          { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
          {
            id: 'open',
            block: 'new-tab',
            data: {
              url: 'https://httpbin.org/forms/post',
              waitTabLoaded: true,
              onError: pageOnError(),
              description: 'Open the sample form',
            },
          },
          {
            id: 'name',
            block: 'forms',
            data: {
              selector: 'input[name="custname"]',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              type: 'text-field',
              value: 'Ada Lovelace',
              onError: pageOnError(),
              description: 'Fill the customer name',
            },
          },
          {
            id: 'submit',
            block: 'event-click',
            data: {
              selector: 'button[type="submit"]',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              onError: pageOnError(),
              description: 'Submit the form',
            },
          },
        ],
        edges: [
          { source: 'trigger', target: 'open' },
          { source: 'open', target: 'name' },
          { source: 'name', target: 'submit' },
        ],
      },
    },
    {
      file: 'heading-or-fallback.automa.json',
      spec: {
        name: 'Read a heading or follow the fallback',
        description:
          'Open example.com. When an h1 exists, store its text. Otherwise store an empty heading.',
        nodes: [
          { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
          {
            id: 'open',
            block: 'new-tab',
            data: {
              url: 'https://example.com',
              waitTabLoaded: true,
              onError: pageOnError(),
            },
          },
          {
            id: 'check',
            block: 'element-exists',
            data: {
              selector: 'h1',
              tryCount: 3,
              timeout: 1500,
              description: 'Does the page have a heading?',
            },
          },
          {
            id: 'read',
            block: 'get-text',
            data: {
              selector: 'h1',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              assignVariable: true,
              variableName: 'heading',
              saveData: false,
              onError: pageOnError(),
            },
          },
          {
            id: 'missing',
            block: 'insert-data',
            data: {
              description: 'Record that the heading is absent',
              dataList: [{ type: 'variable', name: 'heading', value: '' }],
            },
          },
        ],
        edges: [
          { source: 'trigger', target: 'open' },
          { source: 'open', target: 'check' },
          { source: 'check', target: 'read', sourceOutput: 1 },
          { source: 'check', target: 'missing', sourceOutput: 2 },
        ],
      },
    },
    {
      file: 'scrape-example-paragraphs.automa.json',
      spec: {
        name: 'Scrape example.com paragraphs',
        description:
          'Open example.com and append each paragraph to the table column "text".',
        table: [{ id: 'text', name: 'text', type: 'string' }],
        nodes: [
          { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
          {
            id: 'open',
            block: 'new-tab',
            data: {
              url: 'https://example.com',
              waitTabLoaded: true,
              onError: pageOnError(),
              description: 'Open the page to scrape',
            },
          },
          {
            id: 'loop',
            block: 'loop-elements',
            data: {
              loopId: 'paragraphs',
              selector: 'p',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              loadMoreAction: 'none',
              scrollToBottom: false,
              onError: pageOnError(),
              description: 'Visit each paragraph',
            },
          },
          {
            id: 'read',
            block: 'get-text',
            data: {
              selector: '{{loopData@paragraphs}}',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              saveData: true,
              dataColumn: 'text',
              assignVariable: false,
              onError: pageOnError(),
              description: 'Save the current paragraph',
            },
          },
          {
            id: 'next',
            block: 'loop-breakpoint',
            data: { loopId: 'paragraphs' },
          },
        ],
        edges: [
          { source: 'trigger', target: 'open' },
          { source: 'open', target: 'loop' },
          { source: 'loop', target: 'read' },
          { source: 'read', target: 'next' },
        ],
      },
    },
    {
      file: 'loop-numbers-to-table.automa.json',
      spec: {
        name: 'Loop numbers into a table',
        description:
          'Loop from 1 to 3 and append each number to the table column "value".',
        table: [{ id: 'value', name: 'value', type: 'string' }],
        nodes: [
          { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
          {
            id: 'loop',
            block: 'loop-data',
            data: {
              loopId: 'count',
              loopThrough: 'numbers',
              fromNumber: 1,
              toNumber: 3,
              onError: pageOnError(),
              description: 'Count from 1 to 3',
            },
          },
          {
            id: 'save',
            block: 'insert-data',
            data: {
              description: 'Append the current number',
              dataList: [
                {
                  type: 'table',
                  name: 'value',
                  value: '{{loopData@count}}',
                },
              ],
            },
          },
          {
            id: 'next',
            block: 'loop-breakpoint',
            data: { loopId: 'count' },
          },
        ],
        edges: [
          { source: 'trigger', target: 'loop' },
          { source: 'loop', target: 'save' },
          { source: 'save', target: 'next' },
        ],
      },
    },
    {
      file: 'click-with-fallback.automa.json',
      spec: {
        name: 'Click a link and recover if it fails',
        description:
          'Open example.com and click the More information link. After two retries, record a failure in the variable "result" instead of stopping.',
        nodes: [
          { id: 'trigger', block: 'trigger', data: { type: 'manual' } },
          {
            id: 'open',
            block: 'new-tab',
            data: {
              url: 'https://example.com',
              waitTabLoaded: true,
              onError: pageOnError(),
            },
          },
          {
            id: 'click',
            block: 'event-click',
            data: {
              selector: 'a[href="https://www.iana.org/domains/example"]',
              waitForSelector: true,
              waitSelectorTimeout: 5000,
              onError: pageOnError('fallback'),
              description: 'Click More information',
            },
          },
          {
            id: 'ok',
            block: 'insert-data',
            data: {
              description: 'The click ran',
              dataList: [
                { type: 'variable', name: 'result', value: 'clicked' },
              ],
            },
          },
          {
            id: 'failed',
            block: 'insert-data',
            data: {
              description: 'The link was missing after retries',
              dataList: [
                { type: 'variable', name: 'result', value: 'click failed' },
              ],
            },
          },
        ],
        edges: [
          { source: 'trigger', target: 'open' },
          { source: 'open', target: 'click' },
          { source: 'click', target: 'ok', sourceOutput: 1 },
          { source: 'click', target: 'failed', sourceOutput: 'fallback' },
        ],
      },
    },
  ];
}

function buildExamples() {
  return exampleSpecs().map((example) => {
    const built = createWorkflow(example.spec);
    return {
      file: example.file,
      ...built,
    };
  });
}

module.exports = {
  exampleSpecs,
  buildExamples,
};

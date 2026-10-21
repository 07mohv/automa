/**
 * Finite option lists copied from the editor components.
 * The validator treats a mismatch as a warning so older workflows keep loading.
 */
const FIELD_ENUMS = {
  '*': {
    findBy: ['cssSelector', 'xpath'],
  },
  trigger: {
    type: [
      'manual',
      'interval',
      'cron-job',
      'date',
      'context-menu',
      'element-change',
      'specific-day',
      'visit-web',
      'on-startup',
      'keyboard-shortcut',
    ],
  },
  forms: {
    type: ['text-field', 'select', 'checkbox', 'radio'],
    selectOptionBy: ['value', 'custom-position'],
  },
  webhook: {
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
    contentType: ['text', 'json', 'form-data', 'form'],
    responseType: ['json', 'text', 'base64'],
  },
  'loop-data': {
    loopThrough: [
      'data-columns',
      'numbers',
      'google-sheets',
      'variable',
      'custom-data',
      'elements',
    ],
  },
  'javascript-code': {
    context: ['website', 'background'],
  },
  'new-window': {
    type: ['normal', 'popup', 'panel'],
    windowState: ['normal', 'minimized', 'maximized', 'fullscreen'],
  },
  'switch-tab': {
    findTabBy: [
      'match-patterns',
      'tab-title',
      'next-tab',
      'prev-tab',
      'tab-index',
    ],
  },
  'close-tab': {
    closeType: ['tab', 'window'],
  },
  'export-data': {
    type: ['json', 'csv', 'plain-text'],
    dataToExport: ['data-columns', 'variable', 'google-sheets'],
    onConflict: ['uniquify', 'overwrite', 'prompt'],
  },
  clipboard: {
    type: ['get', 'insert'],
  },
  cookie: {
    type: ['get', 'set', 'remove'],
  },
  'workflow-state': {
    type: ['stop-current', 'stop-all', 'stop-specific'],
  },
};

const OUTPUT_NOTES = {
  'element-exists':
    'output-1 runs when the element exists. output-2 runs when it does not.',
  'repeat-task':
    'output-2 is the repeated branch. output-1 runs after the repetition finishes.',
  conditions:
    'Add one output per condition id (`output-{condition.id}`) and `output-fallback` when no condition matches.',
  'while-loop':
    'output-1 is the loop body. output-fallback runs when the condition is no longer met.',
  webhook:
    'output-1 is the success path. output-fallback runs when the request fails.',
};

const SELECTOR_BLOCKS = [
  'event-click',
  'get-text',
  'element-scroll',
  'link',
  'forms',
  'trigger-event',
  'element-exists',
  'hover-element',
  'create-element',
  'upload-file',
];

module.exports = {
  FIELD_ENUMS,
  OUTPUT_NOTES,
  SELECTOR_BLOCKS,
};

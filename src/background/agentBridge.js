import browser from 'webextension-polyfill';
import dbLogs from '@/db/logs';
import { parseJSON } from '@/utils/helper';
import { registerWorkflowTrigger } from '@/utils/workflowTrigger';
import BackgroundWorkflowUtils from './BackgroundWorkflowUtils';

const ALARM_NAME = 'agent-bridge';
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

let generation = 0;
let active = false;
let abortController = null;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createWorkflowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
  }
  return `wf${Date.now()}`;
}

async function readBridgeSettings() {
  const { settings } = await browser.storage.local.get('settings');
  const bridge = (settings && settings.agentBridge) || {};
  const port = Number(bridge.port) || 17321;
  return {
    enabled: Boolean(bridge.enabled),
    port: port > 0 && port < 65536 ? port : 17321,
    token: typeof bridge.token === 'string' ? bridge.token : '',
  };
}

function asWorkflowMap(workflows) {
  if (!workflows) return {};
  if (Array.isArray(workflows)) {
    return workflows.reduce((acc, workflow) => {
      if (workflow && workflow.id) acc[workflow.id] = workflow;
      return acc;
    }, {});
  }
  return { ...workflows };
}

function legacyToVueFlow(blocks) {
  const values = Object.values(blocks || {});
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

function normalizeDrawflow(drawflow) {
  const parsed =
    typeof drawflow === 'string' ? parseJSON(drawflow, null) : drawflow;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('drawflow is missing or is not an object.');
  }
  if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed;
  const legacy =
    parsed.drawflow && parsed.drawflow.Home && parsed.drawflow.Home.data;
  if (legacy) return legacyToVueFlow(legacy);
  throw new Error(
    'drawflow must contain nodes and edges, or the legacy drawflow.Home.data graph.'
  );
}

function toStoredWorkflow(workflow, id) {
  const now = Date.now();
  const globalData =
    typeof workflow.globalData === 'string'
      ? workflow.globalData
      : JSON.stringify(workflow.globalData || {});

  return {
    id,
    name: workflow.name || 'Untitled workflow',
    icon: workflow.icon || 'riGlobalLine',
    folderId: workflow.folderId || null,
    content: workflow.content || null,
    connectedTable: workflow.connectedTable || null,
    drawflow: normalizeDrawflow(workflow.drawflow),
    table: workflow.table || workflow.dataColumns || [],
    dataColumns: [],
    description: workflow.description || '',
    trigger: null,
    createdAt: workflow.createdAt || now,
    updatedAt: now,
    isDisabled: Boolean(workflow.isDisabled),
    settings: { ...DEFAULT_SETTINGS, ...(workflow.settings || {}) },
    version: workflow.version || browser.runtime.getManifest().version,
    globalData,
  };
}

async function saveWorkflow(
  workflow,
  { overwrite = false, keepExisting = false } = {}
) {
  const stored = await browser.storage.local.get('workflows');
  const wasArray = Array.isArray(stored.workflows);
  const workflows = asWorkflowMap(stored.workflows);
  let { id } = workflow;
  if (id && workflows[id] && keepExisting) {
    return { workflowId: id, name: workflows[id].name, skipped: true };
  }
  if (!id || (workflows[id] && !overwrite)) id = createWorkflowId();

  const record = toStoredWorkflow(workflow, id);
  workflows[id] = record;
  await browser.storage.local.set({
    workflows: wasArray ? Object.values(workflows) : workflows,
  });

  const trigger = (record.drawflow.nodes || []).find(
    (node) => node.label === 'trigger'
  );
  if (trigger && trigger.data) {
    try {
      await registerWorkflowTrigger(id, trigger);
    } catch (error) {
      console.error(error);
    }
  }

  return { workflowId: id, name: record.name };
}

async function importWorkflow(params) {
  const { workflow } = params;
  if (!workflow || typeof workflow !== 'object') {
    throw new Error('import_workflow requires a workflow object.');
  }

  const included = [];
  const includedWorkflows = workflow.includedWorkflows || {};
  const includedIds = Object.keys(includedWorkflows);
  for (let index = 0; index < includedIds.length; index += 1) {
    const includedId = includedIds[index];
    const saved = await saveWorkflow(
      { ...includedWorkflows[includedId], id: includedId },
      { keepExisting: true }
    );
    included.push(saved);
  }

  const saved = await saveWorkflow(workflow, {
    overwrite: Boolean(params.overwrite),
  });
  return { ...saved, included };
}

async function listWorkflows(params) {
  const { workflows } = await browser.storage.local.get('workflows');
  const list = Object.values(asWorkflowMap(workflows));
  if (params.full) return { workflows: list };
  return {
    workflows: list.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || '',
      isDisabled: Boolean(workflow.isDisabled),
      updatedAt: workflow.updatedAt || null,
    })),
  };
}

async function runningStates(workflowId) {
  const { workflowStates } = await browser.storage.local.get('workflowStates');
  const list = Array.isArray(workflowStates)
    ? workflowStates
    : Object.values(workflowStates || {});
  return list.filter((state) => !workflowId || state.workflowId === workflowId);
}

function clip(value) {
  if (typeof value !== 'string') return value == null ? '' : value;
  if (value.length <= 500) return value;
  return `${value.slice(0, 500)}…`;
}

function summarizeHistory(history) {
  return (Array.isArray(history) ? history : []).slice(0, 80).map((entry) => ({
    id: entry.id,
    type: entry.type || '',
    name: entry.name || '',
    message: clip(entry.message || entry.description || ''),
    activeTabUrl: entry.activeTabUrl || '',
  }));
}

async function getRunLogs(params) {
  if (!params.workflowId) throw new Error('workflowId is required.');
  const limit = Math.min(Math.max(Number(params.limit) || 3, 1), 20);
  const running = await runningStates(params.workflowId);
  let logs = [];
  try {
    const items = await dbLogs.items
      .where('workflowId')
      .equals(params.workflowId)
      .toArray();
    items.sort((left, right) => (right.endedAt || 0) - (left.endedAt || 0));
    const selected = items.slice(0, limit);
    logs = await Promise.all(
      selected.map(async (item) => {
        const historyRow = await dbLogs.histories
          .where('logId')
          .equals(item.id)
          .last();
        return {
          id: item.id,
          status: item.status,
          message: clip(item.message || ''),
          startedAt: item.startedAt || 0,
          endedAt: item.endedAt || 0,
          history: summarizeHistory(historyRow && historyRow.data),
        };
      })
    );
  } catch (error) {
    console.error(error);
    logs = [];
  }

  return {
    workflowId: params.workflowId,
    running: running.map((state) => ({
      id: state.id,
      status: state.status,
      workflowId: state.workflowId,
    })),
    logs,
    note: running.length
      ? 'A run is still in progress. Step history is written when the run finishes.'
      : '',
  };
}

async function runWorkflow(params) {
  if (!params.workflowId) throw new Error('workflowId is required.');
  const workflow = await BackgroundWorkflowUtils.getWorkflow(params.workflowId);
  if (!workflow)
    throw new Error(`Workflow "${params.workflowId}" was not found.`);
  if (workflow.isDisabled) throw new Error('Workflow is disabled.');

  const options = {
    checkParams: params.checkParams === true,
    data: {},
  };
  if (params.variables && typeof params.variables === 'object') {
    options.data.variables = params.variables;
  }
  if (params.globalData != null) {
    options.data.globalData =
      typeof params.globalData === 'string'
        ? params.globalData
        : JSON.stringify(params.globalData);
  }

  await BackgroundWorkflowUtils.instance.executeWorkflow(workflow, options);

  const started = Date.now();
  let running = [];
  while (Date.now() - started < 1500) {
    running = await runningStates(params.workflowId);
    if (running.length) break;
    await delay(200);
  }

  return {
    started: true,
    workflowId: params.workflowId,
    stateId: running[0] ? running[0].id : null,
    status: running[0] ? running[0].status : 'started',
    message:
      'Poll get_run_logs until running is empty. Finished logs include the block history.',
  };
}

async function stopWorkflow(params) {
  let { stateId } = params;
  if (!stateId) {
    const running = await runningStates(params.workflowId);
    if (!running.length) throw new Error('That workflow has no running state.');
    stateId = running[0].id;
  }
  await BackgroundWorkflowUtils.instance.stopExecution(stateId);
  return { stopped: true, stateId };
}

async function dispatchCommand(command) {
  const params = command.params || {};
  const handlers = {
    ping: async () => ({
      ok: true,
      version: browser.runtime.getManifest().version,
    }),
    import_workflow: () => importWorkflow(params),
    list_workflows: () => listWorkflows(params),
    run_workflow: () => runWorkflow(params),
    get_run_logs: () => getRunLogs(params),
    stop_workflow: () => stopWorkflow(params),
  };
  const handler = handlers[command.method];
  if (!handler) throw new Error(`Unknown bridge method "${command.method}".`);
  return handler();
}

async function postResult(settings, body) {
  await fetch(`http://127.0.0.1:${settings.port}/automa/v1/results`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-automa-token': settings.token,
    },
    body: JSON.stringify(body),
  });
}

async function poll(gen, settings, controller) {
  const url = `http://127.0.0.1:${settings.port}/automa/v1/commands`;
  while (gen === generation) {
    try {
      const response = await fetch(url, {
        headers: { 'x-automa-token': settings.token },
        signal: controller.signal,
      });
      if (gen !== generation) return;
      if (response.status === 401) {
        console.error(
          'Automa agent bridge rejected the token. Update the token in Settings → Agent bridge.'
        );
        await delay(15000);
      } else if (!response.ok) {
        await delay(3000);
      } else {
        const payload = await response.json();
        const commands = payload.commands || [];
        for (let index = 0; index < commands.length; index += 1) {
          const command = commands[index];
          try {
            const result = await dispatchCommand(command);
            await postResult(settings, { id: command.id, ok: true, result });
          } catch (error) {
            await postResult(settings, {
              id: command.id,
              ok: false,
              error: { message: error.message },
            });
          }
        }
      }
    } catch (error) {
      if (gen !== generation || error.name === 'AbortError') return;
      await delay(3000);
    }
  }
}

async function ensureAgentBridge() {
  const settings = await readBridgeSettings();
  generation += 1;
  if (abortController) abortController.abort();
  active = false;
  if (!settings.enabled || !settings.token) return;

  const gen = generation;
  abortController = new AbortController();
  active = true;
  poll(gen, settings, abortController).finally(() => {
    if (gen === generation) active = false;
  });
}

function initAgentBridge() {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const previous =
      changes.settings.oldValue && changes.settings.oldValue.agentBridge;
    const next =
      changes.settings.newValue && changes.settings.newValue.agentBridge;
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    ensureAgentBridge();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME || active) return;
    ensureAgentBridge();
  });

  browser.alarms.create(ALARM_NAME, { periodInMinutes: 1 }).catch((error) => {
    console.error(error);
  });

  ensureAgentBridge().catch((error) => {
    console.error(error);
  });
}

export default initAgentBridge;
export { dispatchCommand, normalizeDrawflow, toStoredWorkflow };

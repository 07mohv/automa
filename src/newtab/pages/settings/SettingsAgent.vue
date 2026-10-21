<template>
  <div class="max-w-2xl">
    <p class="text-gray-600 dark:text-gray-200">
      {{ t('settings.agent.intro') }}
    </p>
    <ui-list class="mt-6 space-y-2">
      <ui-list-item small>
        <ui-switch v-model="settings.enabled" />
        <div class="ml-4 flex-1">
          <p class="leading-tight">{{ t('settings.agent.enabled') }}</p>
          <p class="text-sm leading-tight text-gray-600 dark:text-gray-200">
            {{ t('settings.agent.enabledDescription') }}
          </p>
        </div>
      </ui-list-item>
    </ui-list>
    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <ui-input
        v-model.number="settings.port"
        type="number"
        :label="t('settings.agent.port')"
      />
      <ui-input
        :model-value="settings.token"
        readonly
        :label="t('settings.agent.token')"
      />
    </div>
    <div class="mt-4 space-x-2">
      <ui-button @click="generateToken">
        {{ t('settings.agent.generate') }}
      </ui-button>
      <ui-button :disabled="!settings.token" @click="copyToken">
        {{ copied ? t('settings.agent.copied') : t('settings.agent.copy') }}
      </ui-button>
    </div>
    <p class="mt-6 text-sm text-gray-600 dark:text-gray-200">
      {{ t('settings.agent.command') }}
    </p>
    <pre
      class="bg-box-transparent mt-2 overflow-auto rounded-lg p-3 text-sm"
    ><code>{{ command }}</code></pre>
    <p class="mt-4 text-sm text-gray-600 dark:text-gray-200">
      {{ t('settings.agent.warning') }}
    </p>
  </div>
</template>
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from '@/stores/main';

const { t } = useI18n();
const store = useStore();
const copied = ref(false);
const ready = ref(false);
const settings = reactive({
  enabled: false,
  port: 17321,
  token: '',
});

const command = computed(
  () =>
    `AUTOMA_AGENT_TOKEN=${settings.token || '<token>'} AUTOMA_AGENT_PORT=${
      settings.port || 17321
    } pnpm agent:mcp`
);

function createToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 17321;
  return port;
}

function persist() {
  store.updateSettings({
    agentBridge: {
      enabled: Boolean(settings.enabled),
      port: normalizePort(settings.port),
      token: settings.token,
    },
  });
}

function generateToken() {
  settings.token = createToken();
}

async function copyToken() {
  if (!settings.token) return;
  await navigator.clipboard.writeText(settings.token);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
}

watch(
  settings,
  () => {
    if (!ready.value) return;
    if (settings.enabled && !settings.token) {
      settings.token = createToken();
      return;
    }
    const port = Number(settings.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return;
    persist();
  },
  { deep: true }
);

onMounted(() => {
  const saved = store.settings.agentBridge || {};
  settings.enabled = Boolean(saved.enabled);
  settings.port = normalizePort(saved.port || 17321);
  settings.token = saved.token || '';
  ready.value = true;
});
</script>

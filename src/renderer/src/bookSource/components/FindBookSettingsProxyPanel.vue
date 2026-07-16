<script setup lang="ts">
import { computed, ref } from "vue";
import SwitchToggle from "../../components/SwitchToggle.vue";
import AppCustomSelect, {
  type CustomSelectItem,
} from "../../components/AppCustomSelect.vue";
import ApiEndpointInput, {
  type ApiEndpointSuggestionItem,
} from "../../components/ApiEndpointInput.vue";
import AppConnectionTestButton from "../../components/AppConnectionTestButton.vue";
import { appAlert } from "../../services/appDialog";
import type { ConnectionTestResult } from "../../composables/useConnectionTest";
import {
  buildFindBookProxyUrl,
  FIND_BOOK_PROXY_TYPE_OPTIONS,
  labelForFindBookProxyType,
  type FindBookProxyType,
} from "../constants/findBookSettings";

const props = defineProps<{
  draftProxyEnabled: boolean;
  draftProxyType: FindBookProxyType;
  draftProxyHost: string;
  draftProxyPort: string;
  draftProxyUsername: string;
  draftProxyPassword: string;
}>();

const emit = defineEmits<{
  "update:draftProxyEnabled": [v: boolean];
  "update:draftProxyType": [v: FindBookProxyType];
  "update:draftProxyHost": [v: string];
  "update:draftProxyPort": [v: string];
  "update:draftProxyUsername": [v: string];
  "update:draftProxyPassword": [v: string];
}>();

const DEFAULT_PROXY_TEST_URL = "https://www.google.com";

const selectListsEmpty: CustomSelectItem[] = [];

const proxyTypeItems = computed<CustomSelectItem[]>(() =>
  FIND_BOOK_PROXY_TYPE_OPTIONS.map((option) => ({
    kind: "item" as const,
    id: option.id,
    label: option.label,
  })),
);

const proxyTestUrl = ref(DEFAULT_PROXY_TEST_URL);

const proxyTestSuggestions: readonly ApiEndpointSuggestionItem[] = [
  {
    id: "https://www.google.com",
    label: "Google",
    description: "https://www.google.com",
  },
  {
    id: "https://github.com/",
    label: "GitHub",
    description: "https://github.com/",
  },
];

const proxyTestFingerprint = computed(
  () =>
    [
      props.draftProxyEnabled ? "1" : "0",
      props.draftProxyType,
      props.draftProxyHost.trim(),
      props.draftProxyPort.trim(),
      props.draftProxyUsername.trim(),
      props.draftProxyPassword,
      proxyTestUrl.value.trim(),
    ].join("\0"),
);

function onPortInput(raw: string) {
  emit("update:draftProxyPort", raw.replace(/\D/g, "").slice(0, 5));
}

function draftProxyUrlOrEmpty(): string {
  return buildFindBookProxyUrl({
    enabled: props.draftProxyEnabled,
    type: props.draftProxyType,
    host: props.draftProxyHost,
    port: props.draftProxyPort,
    username: props.draftProxyUsername,
    password: props.draftProxyPassword,
  });
}

async function runProxyTest(): Promise<ConnectionTestResult | null> {
  const url = proxyTestUrl.value.trim();
  if (!url) {
    await appAlert("请填写测试 URL");
    return null;
  }
  if (props.draftProxyEnabled) {
    const proxyUrl = draftProxyUrlOrEmpty();
    if (!proxyUrl) {
      await appAlert("请先填写有效的代理主机与端口");
      return null;
    }
  }
  const r = await window.colorTxt.bookSourceTestHttpProxy({
    proxy: props.draftProxyEnabled ? draftProxyUrlOrEmpty() : null,
    url,
  });
  if (r.ok) return { ok: true };
  return { ok: false, error: r.message?.trim() || "连接失败" };
}
</script>

<template>
  <div class="settingsProxyRoot">
    <div class="settingsBody">
      <div class="settingsRow">
        <div class="settingsRowMain">
          <span class="settingsLabel">启用代理</span>
          <SwitchToggle
            :model-value="draftProxyEnabled"
            aria-label="启用代理"
            @update:model-value="$emit('update:draftProxyEnabled', $event)"
          />
        </div>
        <p class="settingsHint">
          用于找书窗口的书源网络请求。书源规则 header / URL 中的
          <code>proxy</code> 字段优先于此处设置。
        </p>
      </div>

      <template v-if="draftProxyEnabled">
        <div class="settingsRow">
          <div class="settingsRowMain settingsRowMain--baseline">
            <span class="settingsLabel">代理类型</span>
            <div class="settingsSelectWrap">
              <AppCustomSelect
                class="settingsSelect"
                :model-value="draftProxyType"
                :display-label="labelForFindBookProxyType(draftProxyType)"
                :fixed-top-items="selectListsEmpty"
                :scroll-items="proxyTypeItems"
                :fixed-bottom-items="selectListsEmpty"
                :scroll-max-height="160"
                ariaLabel="代理类型"
                @update:model-value="
                  $emit('update:draftProxyType', $event as FindBookProxyType)
                "
              />
            </div>
          </div>
        </div>

        <div class="settingsRow">
          <div class="settingsRowMain settingsRowMain--baseline">
            <span class="settingsLabel">主机</span>
            <input
              class="settingsTextInput"
              type="text"
              :value="draftProxyHost"
              aria-label="代理主机"
              placeholder="127.0.0.1"
              autocomplete="off"
              @input="
                $emit(
                  'update:draftProxyHost',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </div>
        </div>

        <div class="settingsRow">
          <div class="settingsRowMain settingsRowMain--baseline">
            <span class="settingsLabel">端口</span>
            <input
              class="settingsTextInput settingsTextInput--port"
              type="text"
              inputmode="numeric"
              :value="draftProxyPort"
              aria-label="代理端口"
              placeholder="7890"
              autocomplete="off"
              @input="onPortInput(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <div class="settingsRow">
          <div class="settingsRowMain settingsRowMain--baseline">
            <span class="settingsLabel">用户名</span>
            <input
              class="settingsTextInput"
              type="text"
              :value="draftProxyUsername"
              aria-label="代理用户名"
              placeholder="可选"
              autocomplete="off"
              @input="
                $emit(
                  'update:draftProxyUsername',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </div>
        </div>

        <div class="settingsRow">
          <div class="settingsRowMain settingsRowMain--baseline">
            <span class="settingsLabel">密码</span>
            <input
              class="settingsTextInput"
              type="password"
              :value="draftProxyPassword"
              aria-label="代理密码"
              placeholder="可选"
              autocomplete="new-password"
              @input="
                $emit(
                  'update:draftProxyPassword',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </div>
        </div>
      </template>

      <div class="settingsRow">
        <div class="settingsRowMain settingsRowMain--baseline">
          <span class="settingsLabel">测试</span>
          <div class="aiRowField">
            <div class="settingsPasswordRow proxyTestRow">
              <ApiEndpointInput
                v-model="proxyTestUrl"
                class="proxyTestUrlInput"
                input-class="settingsStretchInput settingsPasswordRow__input"
                :suggestion-items="proxyTestSuggestions"
                :suggestions="[]"
                placeholder="https://www.google.com"
                aria-label="代理测试 URL"
                :scroll-max-height="160"
              />
              <AppConnectionTestButton
                label="测试"
                :fingerprint="proxyTestFingerprint"
                :on-test="runProxyTest"
                :alert-on-error="false"
                title="使用上方代理配置探测该 URL 是否可访问"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settingsProxyRoot {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settingsBody {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  background-color: var(--bg);
  border-radius: 8px;
}

.settingsRow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settingsRowMain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.settingsRowMain--baseline {
  align-items: baseline;
}

.settingsSelectWrap {
  flex: 0 1 220px;
  min-width: 140px;
  max-width: 100%;
}

.settingsSelect {
  width: 100%;
}

.settingsTextInput {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 320px;
  height: 32px;
  font-size: 13px;
}

.settingsTextInput--port {
  max-width: 120px;
  flex: 0 0 120px;
}

.settingsLabel {
  font-size: 14px;
  color: var(--fg);
  white-space: nowrap;
  flex: 1 1 40%;
}

.settingsHint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--muted);
}

.settingsHint code {
  font-size: 11px;
}

.proxyTestRow {
  width: 100%;
}

.proxyTestUrlInput {
  flex: 1 1 auto;
  min-width: 0;
  max-width: none;
}
</style>

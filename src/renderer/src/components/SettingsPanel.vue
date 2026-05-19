<script setup lang="ts">
import { computed, nextTick, ref, toRaw, useTemplateRef, watch } from "vue";
import type { AIConfig } from "@shared/aiTypes";
import { defaultAIConfig } from "@shared/aiTypes";
import type { AiCustomSkill, AiSkillUserOverride } from "@shared/aiSkills";
import {
  mergeAiCustomSkills,
  mergeAiSkillOverrides,
  mergeAiSkillsEnabled,
} from "@shared/aiSkills";
import AppModal from "./AppModal.vue";
import SettingsTabBar, { type SettingsTabId } from "./SettingsTabBar.vue";
import SettingsGeneralPanel from "./SettingsGeneralPanel.vue";
import SettingsReadingPanel from "./SettingsReadingPanel.vue";
import SettingsEditPanel from "./SettingsEditPanel.vue";
import SettingsAIPanel from "./SettingsAIPanel.vue";
import SettingsVectorModelPanel from "./SettingsVectorModelPanel.vue";
import SettingsTxt2ImgPanel from "./SettingsTxt2ImgPanel.vue";
import SettingsSkillsPanel from "./SettingsSkillsPanel.vue";
import SettingsVoiceReadPanel from "./SettingsVoiceReadPanel.vue";
import {
  clampLineHeightMultipleForFontSize,
  defaultChapterMinCharCount,
  defaultCompressBlankKeepOneBlank,
  defaultFullscreenReaderWidthPercent,
  defaultMonacoSmoothScrolling,
  defaultReaderEditShowLineNumbers,
  defaultReaderEditMinimap,
  defaultEditAutoRefreshChapterList,
  defaultReaderFontSize,
  defaultReaderLineHeightMultiple,
  defaultRecentFilesHistoryLimit,
  defaultRestoreSessionOnStartup,
  defaultSyncCurrentFile,
  defaultTxtrDelimitedMatchCrossLine,
  maxLineHeightMultipleForFontSize,
  persistKey,
  skipUnloadPersistenceSessionKey,
  APP_DISPLAY_NAME,
} from "../constants/appUi";
import { appAlert } from "../services/appDialog";
import { icons } from "../icons";
import {
  resolveDefaultCharacterPortraitCacheDirSync,
  resolveDefaultEbookConvertOutputDirSync,
} from "../utils/defaultCacheDirs";
import type { VoiceReadSettings } from "../constants/voiceRead";
import {
  defaultVoiceReadSettings,
  mergeVoiceReadSettings,
  voiceReadDashScopeRequiresApiKey,
} from "../constants/voiceRead";

export type SettingsApplyPayload = {
  restoreSessionOnStartup: boolean;
  syncCurrentFile: boolean;
  recentFilesHistoryLimit: number;
  chapterMinCharCount: number;
  fullscreenReaderWidthPercent: number;
  monacoSmoothScrolling: boolean;
  readerEditShowLineNumbers: boolean;
  readerEditMinimap: boolean;
  editAutoRefreshChapterList: boolean;
  fontSize: number;
  lineHeightMultiple: number;
  compressBlankKeepOneBlank: boolean;
  txtrDelimitedMatchCrossLine: boolean;
  ebookConvertOutputDir: string;
  characterPortraitCacheDir: string;
  aiSkillsEnabled: Record<string, boolean>;
  aiSkillOverrides: Record<string, AiSkillUserOverride>;
  aiCustomSkills: AiCustomSkill[];
  voiceRead: VoiceReadSettings;
};

const modelValue = defineModel<boolean>({ default: false });

const props = defineProps<{
  restoreSessionOnStartup: boolean;
  syncCurrentFile: boolean;
  recentFilesHistoryLimit: number;
  chapterMinCharCount: number;
  fullscreenReaderWidthPercent: number;
  readerFontSize: number;
  readerLineHeightMultiple: number;
  monacoSmoothScrolling: boolean;
  readerEditShowLineNumbers: boolean;
  readerEditMinimap: boolean;
  editAutoRefreshChapterList: boolean;
  compressBlankKeepOneBlank: boolean;
  monacoCustomHighlight: boolean;
  txtrDelimitedMatchCrossLine: boolean;
  ebookConvertOutputDir: string;
  characterPortraitCacheDir: string;
  aiSkillsEnabled: Record<string, boolean>;
  aiSkillOverrides: Record<string, AiSkillUserOverride>;
  aiCustomSkills: AiCustomSkill[];
  voiceReadSettings: VoiceReadSettings;
}>();

const emit = defineEmits<{
  apply: [payload: SettingsApplyPayload];
}>();

const activeTab = ref<SettingsTabId>("general");
const settingsTabScrollerEl = useTemplateRef<HTMLElement>(
  "settingsTabScrollerEl",
);

type SettingsSkillsPanelExpose = { openCreateSkill: () => void };
const skillsPanelRef =
  useTemplateRef<SettingsSkillsPanelExpose>("skillsPanelRef");

function onAddSkillClick() {
  skillsPanelRef.value?.openCreateSkill();
}

const draftRestore = ref(true);
const draftSyncCurrentFile = ref(false);
const draftRecentLimit = ref(20);
const draftChapterMinCharCount = ref(defaultChapterMinCharCount);
const draftFullscreenReaderWidthPercent = ref(50);
const draftFontSize = ref(14);
const draftLineHeightMultiple = ref(1.5);
const draftMonacoSmoothScrolling = ref(true);
const draftReaderEditShowLineNumbers = ref(defaultReaderEditShowLineNumbers);
const draftReaderEditMinimap = ref(defaultReaderEditMinimap);
const draftEditAutoRefreshChapterList = ref(defaultEditAutoRefreshChapterList);
const draftCompressBlankKeepOneBlank = ref(false);
const draftTxtrDelimitedMatchCrossLine = ref(
  defaultTxtrDelimitedMatchCrossLine,
);
const draftEbookConvertOutputDir = ref("");
const draftCharacterPortraitCacheDir = ref("");

const draftAi = ref<AIConfig>(structuredClone(defaultAIConfig));
const showAiExtensionTabs = computed(() => draftAi.value.aiEnabled);
const loadedAiDimension = ref(1536);
const draftAiSkillsEnabled = ref<Record<string, boolean>>(
  mergeAiSkillsEnabled(undefined, []),
);
const draftAiSkillOverrides = ref<Record<string, AiSkillUserOverride>>(
  mergeAiSkillOverrides(undefined),
);
const draftAiCustomSkills = ref<AiCustomSkill[]>([]);

const draftVoiceRead = ref<VoiceReadSettings>(
  mergeVoiceReadSettings(undefined),
);

function syncDraftFromProps() {
  draftRestore.value = props.restoreSessionOnStartup;
  draftSyncCurrentFile.value = props.syncCurrentFile;
  draftRecentLimit.value = props.recentFilesHistoryLimit;
  draftChapterMinCharCount.value = props.chapterMinCharCount;
  draftFullscreenReaderWidthPercent.value = props.fullscreenReaderWidthPercent;
  draftFontSize.value = props.readerFontSize;
  draftLineHeightMultiple.value = clampLineHeightMultipleForFontSize(
    props.readerFontSize,
    props.readerLineHeightMultiple,
  );
  draftMonacoSmoothScrolling.value = props.monacoSmoothScrolling;
  draftReaderEditShowLineNumbers.value = props.readerEditShowLineNumbers;
  draftReaderEditMinimap.value = props.readerEditMinimap;
  draftEditAutoRefreshChapterList.value = props.editAutoRefreshChapterList;
  draftCompressBlankKeepOneBlank.value = props.compressBlankKeepOneBlank;
  draftTxtrDelimitedMatchCrossLine.value = props.txtrDelimitedMatchCrossLine;
  draftEbookConvertOutputDir.value = props.ebookConvertOutputDir;
  draftCharacterPortraitCacheDir.value = props.characterPortraitCacheDir;
  draftAiSkillOverrides.value = mergeAiSkillOverrides(props.aiSkillOverrides);
  draftAiCustomSkills.value = mergeAiCustomSkills(props.aiCustomSkills ?? []);
  draftAiSkillsEnabled.value = mergeAiSkillsEnabled(
    props.aiSkillsEnabled,
    draftAiCustomSkills.value.map((s) => s.id),
  );
  draftVoiceRead.value = mergeVoiceReadSettings(props.voiceReadSettings);
}

async function syncAiFromMain() {
  try {
    const c = await window.colorTxt.ai.configGet();
    draftAi.value = structuredClone(c);
    loadedAiDimension.value = c.embedding.dimension;
  } catch {
    draftAi.value = structuredClone(defaultAIConfig);
    loadedAiDimension.value = defaultAIConfig.embedding.dimension;
  }
}

watch(modelValue, (open) => {
  if (!open) {
    activeTab.value = "general";
    return;
  }
  syncDraftFromProps();
  void syncAiFromMain();
});

watch(draftFontSize, (fs) => {
  const cap = maxLineHeightMultipleForFontSize(fs);
  if (draftLineHeightMultiple.value > cap + 1e-6) {
    draftLineHeightMultiple.value = cap;
  }
});

watch(activeTab, () => {
  void nextTick(() => {
    const el = settingsTabScrollerEl.value;
    if (el) el.scrollTop = 0;
  });
});

watch(
  () => draftAi.value.aiEnabled,
  (en) => {
    if (
      !en &&
      (activeTab.value === "vectorModel" ||
        activeTab.value === "txt2img" ||
        activeTab.value === "skills")
    ) {
      activeTab.value = "ai";
    }
  },
);

function resetGeneralDraft() {
  draftRestore.value = defaultRestoreSessionOnStartup;
  draftSyncCurrentFile.value = defaultSyncCurrentFile;
  draftRecentLimit.value = defaultRecentFilesHistoryLimit;
  draftChapterMinCharCount.value = defaultChapterMinCharCount;
  draftEbookConvertOutputDir.value = resolveDefaultEbookConvertOutputDirSync();
}

function resetReadingDraft() {
  draftFontSize.value = defaultReaderFontSize;
  draftLineHeightMultiple.value = clampLineHeightMultipleForFontSize(
    defaultReaderFontSize,
    defaultReaderLineHeightMultiple,
  );
  draftMonacoSmoothScrolling.value = defaultMonacoSmoothScrolling;
  draftCompressBlankKeepOneBlank.value = defaultCompressBlankKeepOneBlank;
  draftTxtrDelimitedMatchCrossLine.value = defaultTxtrDelimitedMatchCrossLine;
  draftFullscreenReaderWidthPercent.value = defaultFullscreenReaderWidthPercent;
}

function resetEditDraft() {
  draftReaderEditShowLineNumbers.value = defaultReaderEditShowLineNumbers;
  draftReaderEditMinimap.value = defaultReaderEditMinimap;
  draftEditAutoRefreshChapterList.value = defaultEditAutoRefreshChapterList;
}

function resetAiDraft() {
  const def = defaultAIConfig;
  draftAi.value = {
    ...draftAi.value,
    aiEnabled: def.aiEnabled,
    chat: structuredClone(def.chat),
    quickQuestions: structuredClone(def.quickQuestions),
  };
}

function resetVectorModelDraft() {
  const def = defaultAIConfig;
  draftAi.value = {
    ...draftAi.value,
    embeddingEnabled: def.embeddingEnabled,
    embedding: structuredClone(def.embedding),
    ragTopK: def.ragTopK,
  };
}

function resetTxt2ImgDraft() {
  draftAi.value = {
    ...draftAi.value,
    txt2img: structuredClone(defaultAIConfig.txt2img),
  };
  draftCharacterPortraitCacheDir.value =
    resolveDefaultCharacterPortraitCacheDirSync();
}

function resetSkillsDraft() {
  draftAiSkillOverrides.value = mergeAiSkillOverrides(undefined);
  draftAiCustomSkills.value = [];
  draftAiSkillsEnabled.value = mergeAiSkillsEnabled(undefined, []);
}

function resetVoiceReadDraft() {
  draftVoiceRead.value = mergeVoiceReadSettings({
    ...defaultVoiceReadSettings,
  });
}

function onResetCurrentTab() {
  if (activeTab.value === "general") resetGeneralDraft();
  else if (activeTab.value === "reading") resetReadingDraft();
  else if (activeTab.value === "edit") resetEditDraft();
  else if (activeTab.value === "ai") resetAiDraft();
  else if (activeTab.value === "vectorModel") resetVectorModelDraft();
  else if (activeTab.value === "txt2img") resetTxt2ImgDraft();
  else if (activeTab.value === "skills") resetSkillsDraft();
  else if (activeTab.value === "voiceRead") resetVoiceReadDraft();
}

function onCancel() {
  modelValue.value = false;
}

async function onConfirm() {
  if (draftAi.value.embedding.dimension !== loadedAiDimension.value) {
    if (!window.colorTxt) return;
    const r = await window.colorTxt.showMessageBox({
      type: "warning",
      title: APP_DISPLAY_NAME,
      buttons: ["取消", "保存"],
      defaultId: 1,
      cancelId: 0,
      message:
        "向量维度已修改，保存后将清空所有已构建的书籍向量索引，是否继续？",
      noLink: true,
    });
    if (r.response !== 1) return;
  }

  if (voiceReadDashScopeRequiresApiKey(draftVoiceRead.value)) {
    await appAlert("「语音朗读」DashScope 需要 API 密钥");
    return;
  }

  const aiPayload = JSON.parse(
    JSON.stringify(toRaw(draftAi.value)),
  ) as AIConfig;
  const aiRes = await window.colorTxt.ai.configSet(aiPayload);
  if (!aiRes.ok) {
    await appAlert(aiRes.error ?? "保存 AI 配置失败");
    return;
  }
  loadedAiDimension.value = draftAi.value.embedding.dimension;

  emit("apply", {
    restoreSessionOnStartup: draftRestore.value,
    syncCurrentFile: draftSyncCurrentFile.value,
    recentFilesHistoryLimit: draftRecentLimit.value,
    chapterMinCharCount: draftChapterMinCharCount.value,
    fullscreenReaderWidthPercent: draftFullscreenReaderWidthPercent.value,
    monacoSmoothScrolling: draftMonacoSmoothScrolling.value,
    readerEditShowLineNumbers: draftReaderEditShowLineNumbers.value,
    readerEditMinimap: draftReaderEditMinimap.value,
    editAutoRefreshChapterList: draftEditAutoRefreshChapterList.value,
    fontSize: draftFontSize.value,
    lineHeightMultiple: draftLineHeightMultiple.value,
    compressBlankKeepOneBlank: draftCompressBlankKeepOneBlank.value,
    txtrDelimitedMatchCrossLine: draftTxtrDelimitedMatchCrossLine.value,
    ebookConvertOutputDir: draftEbookConvertOutputDir.value.trim(),
    characterPortraitCacheDir: draftCharacterPortraitCacheDir.value.trim(),
    aiSkillsEnabled: mergeAiSkillsEnabled(
      draftAiSkillsEnabled.value,
      draftAiCustomSkills.value.map((s) => s.id),
    ),
    aiSkillOverrides: mergeAiSkillOverrides(draftAiSkillOverrides.value),
    aiCustomSkills: mergeAiCustomSkills(draftAiCustomSkills.value),
    voiceRead: mergeVoiceReadSettings(draftVoiceRead.value),
  });
}

async function onClearCache() {
  const r = await window.colorTxt.showMessageBox({
    type: "warning",
    title: APP_DISPLAY_NAME,
    buttons: ["取消", "清除"],
    defaultId: 1,
    cancelId: 0,
    message: "是否清除应用缓存？",
    detail:
      "将删除会话、最近打开、文件列表、书签与阅读进度等本地数据；界面设置（字号、主题、配色等）将保留。清除后窗口会重新加载。",
    noLink: true,
  });
  if (r.response !== 1) return;
  try {
    sessionStorage.setItem(skipUnloadPersistenceSessionKey, "1");
  } catch {
    // ignore
  }
  const saved = localStorage.getItem(persistKey);
  try {
    localStorage.clear();
    if (saved !== null) localStorage.setItem(persistKey, saved);
  } catch {
    // ignore
  }
  window.location.reload();
}
</script>

<template>
  <AppModal
    v-model="modelValue"
    title="设置"
    max-width="700px"
    panel-class="settingsPanelModal"
    :mask-closable="false"
    :esc-closable="true"
    :body-scroll="false"
  >
    <div class="settingsLayout">
      <SettingsTabBar
        v-model:active-tab="activeTab"
        :show-ai-extension-tabs="showAiExtensionTabs"
      />

      <div class="settingsScroll">
        <div ref="settingsTabScrollerEl" class="settingsTabScroller">
          <div class="settingsTabContent">
            <SettingsGeneralPanel
              v-show="activeTab === 'general'"
              v-model:draft-restore="draftRestore"
              v-model:draft-sync-current-file="draftSyncCurrentFile"
              v-model:draft-recent-limit="draftRecentLimit"
              v-model:draft-chapter-min-char-count="draftChapterMinCharCount"
              v-model:draft-ebook-convert-output-dir="
                draftEbookConvertOutputDir
              "
              @clear-cache="onClearCache"
            />

            <SettingsReadingPanel
              v-show="activeTab === 'reading'"
              v-model:draft-font-size="draftFontSize"
              v-model:draft-line-height-multiple="draftLineHeightMultiple"
              v-model:draft-monaco-smooth-scrolling="draftMonacoSmoothScrolling"
              v-model:draft-compress-blank-keep-one-blank="
                draftCompressBlankKeepOneBlank
              "
              v-model:draft-txtr-delimited-match-cross-line="
                draftTxtrDelimitedMatchCrossLine
              "
              v-model:draft-fullscreen-reader-width-percent="
                draftFullscreenReaderWidthPercent
              "
              :monaco-custom-highlight="monacoCustomHighlight"
            />

            <SettingsEditPanel
              v-show="activeTab === 'edit'"
              v-model:draft-reader-edit-show-line-numbers="
                draftReaderEditShowLineNumbers
              "
              v-model:draft-reader-edit-minimap="draftReaderEditMinimap"
              v-model:draft-edit-auto-refresh-chapter-list="
                draftEditAutoRefreshChapterList
              "
            />

            <SettingsVoiceReadPanel
              v-show="activeTab === 'voiceRead'"
              v-model="draftVoiceRead"
            />

            <SettingsAIPanel v-show="activeTab === 'ai'" v-model="draftAi" />

            <SettingsVectorModelPanel
              v-show="activeTab === 'vectorModel'"
              v-model="draftAi"
            />

            <SettingsTxt2ImgPanel
              v-show="activeTab === 'txt2img'"
              v-model="draftAi"
              v-model:character-portrait-cache-dir="
                draftCharacterPortraitCacheDir
              "
            />

            <SettingsSkillsPanel
              ref="skillsPanelRef"
              v-show="activeTab === 'skills'"
              v-model:enabled="draftAiSkillsEnabled"
              v-model:overrides="draftAiSkillOverrides"
              v-model:custom-skills="draftAiCustomSkills"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="settingsFooter">
        <div class="settingsFooterStart">
          <button
            class="btn"
            type="button"
            size="large"
            @click="onResetCurrentTab"
          >
            重置当前页
          </button>
          <button
            v-show="activeTab === 'skills'"
            class="btn settingsFooterAddBtn"
            type="button"
            size="large"
            @click="onAddSkillClick"
          >
            <span
              class="settingsFooterAddIcon"
              aria-hidden="true"
              v-html="icons.add"
            />
            添加技能
          </button>
        </div>
        <div class="settingsFooterActions">
          <button class="btn" type="button" size="large" @click="onCancel">
            取消
          </button>
          <button
            class="btn primary"
            type="button"
            size="large"
            @click="onConfirm"
          >
            确定
          </button>
        </div>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.settingsLayout {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.settingsScroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/**
 * 滚动条贴齐内容区右缘（不受正文左右 padding 影响）；
 * 可滚动高度由 flex 链 `min-height: 0` 约束。
 */
.settingsTabScroller {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px 8px 8px 0;
}

/** 仅标签页正文内边距（不含顶部分类标签栏） */
.settingsTabContent {
  box-sizing: border-box;
}

.resetHint {
  margin: 8px 4px 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.settingsFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.settingsFooterStart {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.settingsFooterAddBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.settingsFooterAddIcon {
  display: inline-flex;
  line-height: 0;
  flex-shrink: 0;
}

.settingsFooterAddIcon :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}

.settingsFooterAddIcon :deep(path) {
  fill: currentColor;
}

.settingsFooterActions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}
</style>

<style>
/* 非 scoped：与配色面板一致拔高模态高度 */
.settingsPanelModal {
  height: min(640px, calc(100vh - 48px));
}
</style>

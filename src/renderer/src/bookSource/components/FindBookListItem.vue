<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DefaultBookCover from "./DefaultBookCover.vue";
import type { SearchBookItem } from "@shared/bookSource/types";
import {
  formatBookAuthor,
  formatBookIntroForDisplay,
  getBookKindList,
} from "../bookSourceDisplay";

const props = withDefaults(
  defineProps<{
    item: SearchBookItem;
    /** 是否在标题行右侧显示书源名（搜索、书架为 true，发现分类为 false） */
    showOrigin?: boolean;
    /** 封面 URL 覆盖（书架重新解析封面时使用） */
    coverUrl?: string;
    /** 外部强制显示默认封面（书架重试失败后） */
    forceDefaultCover?: boolean;
  }>(),
  { showOrigin: true },
);

const emit = defineEmits<{
  click: [item: SearchBookItem];
  coverError: [item: SearchBookItem];
}>();

const coverLoadFailed = ref(false);

const displayCoverUrl = computed(() => props.coverUrl ?? props.item.coverUrl);

const introText = computed(() => formatBookIntroForDisplay(props.item.intro));

const kindTags = computed(() => getBookKindList(props.item));

const showDefaultCover = computed(
  () =>
    props.forceDefaultCover ||
    !displayCoverUrl.value ||
    coverLoadFailed.value,
);

watch(
  () => props.coverUrl,
  () => {
    coverLoadFailed.value = false;
  },
);

function onClick() {
  emit("click", props.item);
}

function onCoverError() {
  coverLoadFailed.value = true;
  emit("coverError", props.item);
}
</script>

<template>
  <li class="findBookListItem" @click="onClick">
    <DefaultBookCover
      v-if="showDefaultCover"
      class="findBookListItemCover"
      :title="item.name"
      :author="item.author"
    />
    <img
      v-else
      class="findBookListItemCover"
      :src="displayCoverUrl"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="onCoverError"
    />
    <div class="findBookListItemMain">
      <div v-if="showOrigin" class="findBookListItemHead">
        <div class="findBookListItemTitle">{{ item.name }}</div>
        <div v-if="item.originName" class="findBookListItemOrigin">
          {{ item.originName }}
        </div>
      </div>
      <div v-else class="findBookListItemTitle">{{ item.name }}</div>
      <div class="findBookListItemAuthor">{{ formatBookAuthor(item.author) }}</div>
      <div v-if="kindTags.length" class="findBookListItemTags">
        <span
          v-for="(tag, tagIdx) in kindTags"
          :key="`${item.id}-tag-${tagIdx}`"
          class="findBookListItemTag"
        >{{ tag }}</span>
      </div>
      <div v-if="item.lastChapter" class="findBookListItemLatest">
        最新：{{ item.lastChapter }}
      </div>
      <div
        v-if="introText"
        class="findBookListItemIntro"
        :title="introText"
      >{{ introText }}</div>
    </div>
  </li>
</template>

<style scoped>
.findBookListItem {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  color: var(--fg);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}
.findBookListItem:hover {
  box-shadow: 0 2px 8px color-mix(in srgb, var(--fg) 12%, transparent);
}
.findBookListItemCover {
  width: 76px;
  height: 102px;
  border-radius: 4px;
  flex-shrink: 0;
}
img.findBookListItemCover {
  object-fit: cover;
  background: var(--scrollbar-track);
}
.findBookListItemMain {
  flex: 1;
  min-width: 0;
}
.findBookListItemHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.findBookListItemTitle {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.35;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
.findBookListItemHead .findBookListItemTitle {
  margin-bottom: 0;
}
.findBookListItemOrigin {
  flex-shrink: 0;
  max-width: 42%;
  font-size: 11px;
  line-height: 1.45;
  color: var(--book-source, var(--find-book-origin, #7c5cbf));
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.findBookListItemAuthor {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 6px;
}
.findBookListItemTags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.findBookListItemTag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
  background: color-mix(in srgb, var(--accent) 12%, var(--btn-bg, rgba(0, 0, 0, 0.06)));
  color: var(--fg);
}
.findBookListItemLatest {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.findBookListItemIntro {
  font-size: 12px;
  line-height: 1.45;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}
</style>

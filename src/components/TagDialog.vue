<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { InputRef } from "antdv-next";
import type { Tag } from "../types";
import ColorPickerPanel from "./ColorPickerPanel.vue";

const props = defineProps<{
  open: boolean;
  tags: Tag[];
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "save", tags: Tag[]): void;
}>();

const localTags = ref<Tag[]>([]);
const newTagName = ref("");
const newTagColor = ref("#3B82F6");

const editingId = ref<string | null>(null);
const editingName = ref("");
// v-for 中 ref 收集为数组，用普通 ref + 函数 ref 直接捕获当前唯一的 InputRef
const editInputRef = ref<InputRef | null>(null);
function setEditInputRef(el: unknown) {
  editInputRef.value = (el as InputRef | null) ?? null;
}

const presetColors = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#6B7280",
];

const colorPickerPresets = computed(() => [
  {
    label: "预设颜色",
    colors: presetColors,
    defaultOpen: true,
  },
]);

watch(() => props.open, (val) => {
  if (val) {
    localTags.value = JSON.parse(JSON.stringify(props.tags || []));
    newTagName.value = "";
    newTagColor.value = "#3B82F6";
    cancelEditName();
  }
});

function addTag() {
  const name = newTagName.value.trim();
  if (!name) return;
  const tag: Tag = {
    id: crypto.randomUUID(),
    name,
    color: newTagColor.value,
  };
  localTags.value.push(tag);
  newTagName.value = "";
}

function removeTag(id: string) {
  localTags.value = localTags.value.filter((t) => t.id !== id);
  if (editingId.value === id) cancelEditName();
}

function startEditName(tag: Tag) {
  if (editingId.value === tag.id) return;
  editingId.value = tag.id;
  editingName.value = tag.name;
  // antdv-next Input API: focus({ cursor: 'end' }) 聚焦 + 光标置于末尾
  queueMicrotask(() => {
    editInputRef.value?.focus({ cursor: "end" });
  });
}

function commitEditName() {
  if (!editingId.value) return;
  const name = editingName.value.trim();
  if (!name) {
    cancelEditName();
    return;
  }
  const tag = localTags.value.find((t) => t.id === editingId.value);
  if (tag) tag.name = name;
  cancelEditName();
}

function cancelEditName() {
  editingId.value = null;
  editingName.value = "";
}

function onColorChange(tag: Tag, val: string | string[]) {
  const color = Array.isArray(val) ? val[0] : val;
  const t = localTags.value.find((it) => it.id === tag.id);
  if (t) t.color = color;
}

function onNewColorChange(val: string | string[]) {
  newTagColor.value = Array.isArray(val) ? val[0] : val;
}

function onSave() {
  emit("save", JSON.parse(JSON.stringify(localTags.value)));
  emit("update:open", false);
}

function onCancel() {
  emit("update:open", false);
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="标签管理"
    :footer="null"
    :width="460"
    @cancel="onCancel"
    centered
    destroyOnHidden
  >
    <div class="mb-4">
      <div class="flex gap-2 mb-3">
        <ColorPickerPanel
          :value="newTagColor"
          :presets="colorPickerPresets"
          :triggerSize="32"
          @update:value="onNewColorChange"
        />
        <a-input
          v-model:value="newTagName"
          placeholder="输入标签名称，回车添加"
          size="middle"
          @pressEnter="addTag"
          class="flex-1"
        />
        <a-button type="primary" @click="addTag" :disabled="!newTagName.trim()">
          添加
        </a-button>
      </div>
    </div>

    <div v-if="localTags.length > 0" class="flex flex-col gap-1">
      <div
        v-for="tag in localTags"
        :key="tag.id"
        class="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--accent)] transition-colors"
      >
        <ColorPickerPanel
          :value="tag.color"
          :presets="colorPickerPresets"
          :triggerSize="20"
          @update:value="(val: string | string[]) => onColorChange(tag, val)"
        />
        <div
          class="flex-1 min-w-0 cursor-text"
          @dblclick="startEditName(tag)"
        >
          <a-input
            v-if="editingId === tag.id"
            :ref="setEditInputRef"
            v-model:value="editingName"
            size="small"
            @pressEnter="commitEditName"
            @blur="commitEditName"
            @keydown.escape="cancelEditName"
          />
          <span
            v-else
            class="block text-sm text-[var(--foreground)] truncate select-none"
            title="双击编辑"
          >{{ tag.name }}</span>
        </div>
        <a-button
          type="text"
          size="small"
          danger
          @click="removeTag(tag.id)"
        >
          删除
        </a-button>
      </div>
    </div>
    <div
      v-else
      class="text-xs text-[var(--muted-foreground)] py-4 text-center"
    >
      暂无标签，请输入名称并点击添加
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t border-[var(--border)] mt-4">
      <a-button @click="onCancel">取消</a-button>
      <a-button type="primary" @click="onSave">保存</a-button>
    </div>
  </a-modal>
</template>

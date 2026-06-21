<script setup lang="ts" generic="T extends { id: string; name: string; color: string }">
import { ref, watch } from "vue";
import type { InputRef } from "antdv-next";
import { DeleteOutlined } from "@antdv-next/icons";
import ColorPickerPanel from "./ColorPickerPanel.vue";

interface PresetGroup {
  label?: string;
  key?: string;
  colors: string[];
  defaultOpen?: boolean;
}

const props = withDefaults(
  defineProps<{
    item: T;
    presets: PresetGroup[];
    editing: boolean;
    triggerSize?: number;
    nameTitle?: string;
    deletable?: boolean;
    deleteTitle?: string;
  }>(),
  {
    triggerSize: 20,
    nameTitle: "双击编辑",
    deletable: true,
    deleteTitle: "删除",
  },
);

const emit = defineEmits<{
  (e: "update:editing", val: boolean): void;
  (e: "update:name", id: string, name: string): void;
  (e: "update:color", id: string, color: string): void;
  (e: "delete", id: string): void;
}>();

const editingName = ref(props.item.name);
const editInputRef = ref<InputRef | null>(null);

function setEditInputRef(el: unknown) {
  editInputRef.value = (el as InputRef | null) ?? null;
}

// 进入编辑态时：预填名称 + 聚焦到末尾光标
watch(
  () => props.editing,
  (isEditing) => {
    if (isEditing) {
      editingName.value = props.item.name;
      queueMicrotask(() => {
        editInputRef.value?.focus({ cursor: "end" });
      });
    }
  },
);

// 外部更新 item.name（例如父组件重置）时同步到本地草稿
watch(
  () => props.item.name,
  (newName) => {
    if (!props.editing) editingName.value = newName;
  },
);

function startEdit() {
  if (props.editing) return;
  emit("update:editing", true);
}

function commit() {
  if (!props.editing) return;
  const name = editingName.value.trim();
  if (!name) {
    cancel();
    return;
  }
  emit("update:name", props.item.id, name);
  emit("update:editing", false);
}

function cancel() {
  if (!props.editing) return;
  emit("update:editing", false);
}

function onColorChange(val: string | string[]) {
  const color = Array.isArray(val) ? val[0] : val;
  emit("update:color", props.item.id, color);
}

function onDelete() {
  emit("delete", props.item.id);
}
</script>

<template>
  <div
    class="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--accent)] transition-colors"
  >
    <ColorPickerPanel
      :value="item.color"
      :presets="presets"
      :trigger-size="triggerSize"
      @update:value="onColorChange"
    />
    <div
      class="flex-1 min-w-0 cursor-text"
      @dblclick="startEdit"
    >
      <a-input
        v-if="editing"
        :ref="setEditInputRef"
        v-model:value="editingName"
        size="small"
        @pressEnter="commit"
        @blur="commit"
        @keydown.escape="cancel"
      />
      <span
        v-else
        class="block text-sm text-[var(--foreground)] truncate select-none"
        :title="nameTitle"
      >{{ item.name }}</span>
    </div>
    <a-button
      v-if="deletable"
      type="text"
      size="small"
      danger
      :title="deleteTitle"
      class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
      @click="onDelete"
    >
      <template #icon>
        <DeleteOutlined />
      </template>
    </a-button>
    <slot name="actions" :item="item" />
  </div>
</template>

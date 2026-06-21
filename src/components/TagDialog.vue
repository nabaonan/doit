<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { Tag } from "../types";
import { buildColorPresets } from "../constants/presetColors";
import ColorLabelRow from "./ColorLabelRow.vue";
import ColorLabelAdder from "./ColorLabelAdder.vue";

const props = defineProps<{
  open: boolean;
  tags: Tag[];
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "save", tags: Tag[]): void;
}>();

const localTags = ref<Tag[]>([]);
const newTagColor = ref("#3B82F6");
const editingId = ref<string | null>(null);

const colorPresets = computed(() => buildColorPresets());

watch(() => props.open, (val) => {
  if (val) {
    localTags.value = JSON.parse(JSON.stringify(props.tags || []));
    newTagColor.value = "#3B82F6";
    editingId.value = null;
  }
});

function onAdd(payload: { name: string; color: string }) {
  localTags.value.push({
    id: crypto.randomUUID(),
    name: payload.name,
    color: payload.color,
  });
}

function removeTag(id: string) {
  localTags.value = localTags.value.filter((t) => t.id !== id);
  if (editingId.value === id) editingId.value = null;
}

function updateName(id: string, name: string) {
  const t = localTags.value.find((it) => it.id === id);
  if (t) t.name = name;
}

function updateColor(id: string, color: string) {
  const t = localTags.value.find((it) => it.id === id);
  if (t) t.color = color;
}

function onEditChange(id: string, val: boolean) {
  editingId.value = val ? id : null;
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
    <ColorLabelAdder
      :presets="colorPresets"
      :default-color="newTagColor"
      @add="onAdd"
    />

    <div v-if="localTags.length > 0" class="flex flex-col gap-1">
      <ColorLabelRow
        v-for="tag in localTags"
        :key="tag.id"
        :item="tag"
        :presets="colorPresets"
        :editing="editingId === tag.id"
        @update:editing="(val) => onEditChange(tag.id, val)"
        @update:name="updateName"
        @update:color="updateColor"
        @delete="removeTag"
      />
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

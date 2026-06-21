<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Modal } from "antdv-next";
import type { Category, TodoItem } from "../types";
import { buildColorPresets } from "../constants/presetColors";
import ColorLabelRow from "./ColorLabelRow.vue";
import ColorLabelAdder from "./ColorLabelAdder.vue";

const props = defineProps<{
  open: boolean;
  categories: Category[];
  todos: TodoItem[];
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "save", categories: Category[]): void;
}>();

const localCategories = ref<Category[]>([]);
const newCatColor = ref("#3B82F6");
const editingId = ref<string | null>(null);

const colorPresets = computed(() => buildColorPresets());

watch(() => props.open, (val) => {
  if (val) {
    localCategories.value = JSON.parse(JSON.stringify(props.categories || []));
    newCatColor.value = "#3B82F6";
    editingId.value = null;
  }
});

function onAdd(payload: { name: string; color: string }) {
  localCategories.value.push({
    id: crypto.randomUUID(),
    name: payload.name,
    color: payload.color,
  });
}

function removeCategory(id: string) {
  const remove = () => {
    localCategories.value = localCategories.value.filter((c) => c.id !== id);
    if (editingId.value === id) editingId.value = null;
  };
  const count = (props.todos || []).filter((t) => t.catId === id).length;
  if (count > 0) {
    const cat = localCategories.value.find((c) => c.id === id);
    Modal.confirm({
      title: `删除分类「${cat?.name || ""}」`,
      content: `该分类下有 ${count} 个待办事项，删除后这些待办将变为未分类。确定要删除吗？`,
      okText: "确定删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: remove,
    });
  } else {
    remove();
  }
}

function updateName(id: string, name: string) {
  const c = localCategories.value.find((it) => it.id === id);
  if (c) c.name = name;
}

function updateColor(id: string, color: string) {
  const c = localCategories.value.find((it) => it.id === id);
  if (c) c.color = color;
}

function onEditChange(id: string, val: boolean) {
  editingId.value = val ? id : null;
}

function onSave() {
  emit("save", JSON.parse(JSON.stringify(localCategories.value)));
  emit("update:open", false);
}

function onCancel() {
  emit("update:open", false);
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="分类管理"
    :footer="null"
    :width="460"
    @cancel="onCancel"
    centered
    destroyOnHidden
  >
    <ColorLabelAdder
      :presets="colorPresets"
      :default-color="newCatColor"
      @add="onAdd"
    />

    <div v-if="localCategories.length > 0" class="flex flex-col gap-1">
      <ColorLabelRow
        v-for="cat in localCategories"
        :key="cat.id"
        :item="cat"
        :presets="colorPresets"
        :editing="editingId === cat.id"
        @update:editing="(val) => onEditChange(cat.id, val)"
        @update:name="updateName"
        @update:color="updateColor"
        @delete="removeCategory"
      />
    </div>
    <div
      v-else
      class="text-xs text-[var(--muted-foreground)] py-4 text-center"
    >
      暂无分类，请输入名称并点击添加
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t border-[var(--border)] mt-4">
      <a-button @click="onCancel">取消</a-button>
      <a-button type="primary" @click="onSave">保存</a-button>
    </div>
  </a-modal>
</template>

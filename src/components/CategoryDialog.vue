<script setup lang="ts">
import { ref, watch, computed, h } from "vue";
import { Modal } from "antdv-next";
import type { Category, TodoItem } from "../types";

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
const newCatName = ref("");
const newCatColor = ref("#3B82F6");

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

function renderPresetsOnly({ extra }: { extra: { components: { Presets: any } } }) {
  return h(extra.components.Presets);
}

watch(() => props.open, (val) => {
  if (val) {
    localCategories.value = JSON.parse(JSON.stringify(props.categories || []));
    newCatName.value = "";
    newCatColor.value = "#3B82F6";
  }
});

function addCategory() {
  const name = newCatName.value.trim();
  if (!name) return;
  const cat: Category = {
    id: crypto.randomUUID(),
    name,
    color: newCatColor.value,
  };
  localCategories.value.push(cat);
  newCatName.value = "";
}

function removeCategory(id: string) {
  const count = (props.todos || []).filter((t) => t.catId === id).length;
  if (count > 0) {
    const cat = localCategories.value.find((c) => c.id === id);
    Modal.confirm({
      title: `删除分类「${cat?.name || ""}」`,
      content: `该分类下有 ${count} 个待办事项，删除后这些待办将变为未分类。确定要删除吗？`,
      okText: "确定删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        localCategories.value = localCategories.value.filter((c) => c.id !== id);
      },
    });
  } else {
    localCategories.value = localCategories.value.filter((c) => c.id !== id);
  }
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
    :width="420"
    @cancel="onCancel"
    centered
    destroyOnHidden
  >
    <div class="mb-4">
      <div class="flex gap-2 mb-3">
        <a-color-picker
          v-model:value="newCatColor"
          :presets="colorPickerPresets"
          value-format="hex"
          size="small"
          :panelRender="renderPresetsOnly"
        >
          <div
            class="w-8 h-8 rounded-md border border-[var(--border)] cursor-pointer shrink-0 transition-shadow hover:shadow-md"
            :style="{ backgroundColor: newCatColor }"
          />
        </a-color-picker>
        <a-input
          v-model:value="newCatName"
          placeholder="输入分类名称，回车添加"
          size="middle"
          @pressEnter="addCategory"
          class="flex-1"
        />
        <a-button type="primary" @click="addCategory" :disabled="!newCatName.trim()">
          添加
        </a-button>
      </div>
    </div>

    <div v-if="localCategories.length > 0" class="flex flex-col gap-1">
      <div
        v-for="cat in localCategories"
        :key="cat.id"
        class="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--accent)] transition-colors"
      >
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-3 h-3 rounded-full shrink-0"
            :style="{ backgroundColor: cat.color }"
          />
          <span class="text-sm text-[var(--foreground)]">{{ cat.name }}</span>
        </div>
        <a-button
          type="text"
          size="small"
          danger
          @click="removeCategory(cat.id)"
        >
          删除
        </a-button>
      </div>
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

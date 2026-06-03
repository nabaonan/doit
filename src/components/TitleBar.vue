<script setup lang="ts">
import { FileTextOutlined, SettingOutlined, AppstoreOutlined } from "@antdv-next/icons";
import { ref, computed } from "vue";
import type { Category } from "../types";

const props = defineProps<{
  categories: Category[];
  selectedCatId: string | null;
}>();

const emit = defineEmits<{
  (e: "open-settings"): void;
  (e: "open-report"): void;
  (e: "update:view", view: string): void;
  (e: "select-cat", catId: string | null): void;
  (e: "manage-categories"): void;
}>();

const currentView = ref("today");

const catOptions = computed(() => {
  const options: { value: string; label: string }[] = [
    { value: "__none__", label: "未分类" },
  ];
  const cats = props.categories || [];
  for (const cat of cats) {
    options.push({ value: cat.id, label: cat.name });
  }
  return options;
});

function handleOpenReport() {
  emit("open-report");
}

function handleOpenSettings() {
  emit("open-settings");
}

function onViewChange(val: string) {
  currentView.value = val;
  emit("update:view", val);
}

function onCatChange(value: string | undefined) {
  if (value === undefined) {
    emit("select-cat", null);
  } else {
    emit("select-cat", value);
  }
}

function handleManageCategories() {
  emit("manage-categories");
}
</script>

<template>
  <header
    class="h-12 border-b bg-[var(--card)] flex items-center justify-between px-4 shrink-0"
  >
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold text-[var(--foreground)]">Doit</h1>
      <a-segmented
        v-model:value="currentView"
        :options="[
          { label: '今日待办', value: 'today' },
          { label: '按时间查看', value: 'time' },
        ]"
        size="small"
        @change="onViewChange"
      />
    </div>
    <div class="flex items-center gap-2">
      <a-select
        :value="selectedCatId"
        :options="catOptions"
        style="width: 120px"
        size="small"
        placeholder="未分类"
        @change="onCatChange"
        allow-clear
      >
        <template #labelRender="{ value: optValue, label }">
          <span v-if="optValue === '__none__' || !optValue">{{ label }}</span>
          <span v-else class="flex items-center gap-1.5">
            <span
              class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: (categories || []).find((c) => c.id === optValue)?.color }"
            />
            {{ label }}
          </span>
        </template>
        <template #optionRender="{ option }">
          <span v-if="option.value === '__none__'">{{ option.label }}</span>
          <span v-else class="flex items-center gap-1.5">
            <span
              class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: (categories || []).find((c) => c.id === option.value)?.color }"
            />
            {{ option.label }}
          </span>
        </template>
      </a-select>
      <a-button
        type="text"
        size="small"
        shape="circle"
        @click="handleManageCategories"
        title="分类管理"
      >
        <AppstoreOutlined />
      </a-button>
      <a-button
        type="text"
        size="small"
        shape="circle"
        @click="handleOpenReport"
        title="报告"
      >
        <FileTextOutlined />
      </a-button>
      <a-button
        type="text"
        size="small"
        shape="circle"
        @click="handleOpenSettings"
        title="设置"
      >
        <SettingOutlined />
      </a-button>
    </div>
  </header>
</template>
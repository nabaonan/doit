<script setup lang="ts">
import { FileTextOutlined, SettingOutlined } from "@antdv-next/icons";
import { ref } from "vue";

const emit = defineEmits<{
  (e: "open-settings"): void;
  (e: "open-report"): void;
  (e: "update:view", view: string): void;
}>();

const currentView = ref("today");

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
<script setup lang="ts">
import { FileTextOutlined, SettingOutlined } from "@antdv-next/icons";

const emit = defineEmits<{
  (e: "open-settings"): void;
  (e: "open-report"): void;
}>();

function handleOpenReport() {
  emit("open-report");
}

function handleOpenSettings() {
  emit("open-settings");
}
</script>

<template>
  <header
    class="h-12 border-b bg-[var(--card)] flex items-center justify-between px-4 shrink-0"
  >
    <h1 class="text-lg font-semibold text-[var(--foreground)]">Doit</h1>
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
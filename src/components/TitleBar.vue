<script setup lang="ts">
import { FileText, Settings } from "@lucide/vue";

defineEmits<{
  (e: "open-settings"): void;
  (e: "open-report"): void;
}>();
</script>

<template>
  <header
    class="h-12 border-b bg-[var(--card)] flex items-center justify-between px-4 shrink-0"
  >
    <h1 class="text-lg font-semibold text-[var(--foreground)]">Doit</h1>
    <div class="flex items-center gap-2">
      <button
        class="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        @click="$emit('open-report')"
        title="报告"
      >
        <FileText :size="18" />
      </button>
      <button
        class="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        @click="$emit('open-settings')"
        title="设置"
      >
        <Settings :size="18" />
      </button>
    </div>
  </header>
</template>
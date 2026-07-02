<script setup lang="ts">
import { computed } from "vue";
import dayjs from "dayjs";
import type { TodoItem } from "../types";

const props = defineProps<{
  todos: TodoItem[];
}>();

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const dayGroups = computed(() => {
  const m = new Map<string, TodoItem[]>();
  for (const t of props.todos) {
    if (!t.completed || !t.completedAt) continue;
    const key = dayjs(t.completedAt).format("YYYY-MM-DD");
    const list = m.get(key) || [];
    list.push(t);
    m.set(key, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  }
  return Array.from(m, ([dateKey, items]) => ({
    dateKey,
    items,
  })).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
});
</script>

<template>
  <div class="flex-1 overflow-y-auto px-6 py-6">
    <a-empty
      v-if="dayGroups.length === 0"
      description="还没有完成记录"
      class="flex items-center justify-center"
    />
    <a-timeline v-else mode="left" title-span="100px">
      <a-timeline-item v-for="group in dayGroups" :key="group.dateKey">
        <template #title>
          <div class="flex flex-col items-end pr-2 text-right">
            <span class="text-base font-semibold text-[var(--foreground)] tabular-nums">
              {{ dayjs(group.dateKey).format("MM-DD") }}
            </span>
            <span class="text-xs text-[var(--muted-foreground)]">
              {{ WEEKDAYS[dayjs(group.dateKey).day()] }}
            </span>
          </div>
        </template>
        <div class="flex flex-col gap-1.5">
          <div
            v-for="todo in group.items"
            :key="todo.id"
            class="flex items-baseline gap-3"
          >
            <span class="text-xs text-[var(--muted-foreground)] tabular-nums shrink-0 w-12">
              {{ dayjs(todo.completedAt).format("HH:mm") }}
            </span>
            <span class="line-through text-[var(--muted-foreground)]">
              {{ todo.content }}
            </span>
          </div>
        </div>
      </a-timeline-item>
    </a-timeline>
  </div>
</template>

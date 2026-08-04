<script setup lang="ts">
import { computed, ref } from "vue";
import dayjs from "dayjs";
import { CheckCircleFilled } from "@antdv-next/icons";
import type { TodoItem } from "../types";

const props = defineProps<{
  todos: TodoItem[];
}>();

const dailyCompletedMap = computed(() => {
  const m = new Map<string, TodoItem[]>()
  for (const t of props.todos) {
    if (!t.completed || !t.completedAt) continue
    const key = dayjs(t.completedAt).format("YYYY-MM-DD")
    const list = m.get(key)
    if (list) {
      list.push(t)
    } else {
      m.set(key, [t])
    }
  }
  return m
})

const selectedDate = ref<dayjs.Dayjs | null>(null)
const showDetail = ref(false)

const selectedDayTodos = computed(() => {
  if (!selectedDate.value) return []
  const key = selectedDate.value.format("YYYY-MM-DD")
  return dailyCompletedMap.value.get(key) || []
})

const selectedDayTitle = computed(() => {
  if (!selectedDate.value) return ""
  return selectedDate.value.format("YYYY年MM月DD日") + ` · 完成 ${selectedDayTodos.value.length} 个待办`
})

function onSelect(date: dayjs.Dayjs) {
  selectedDate.value = date
  showDetail.value = true
}
</script>

<template>
  <div class="flex-1 overflow-auto p-4">
    <a-calendar
      :fullscreen="true"
      @select="onSelect"
    >
      <template #cellRender="{ date }">
        <div class="flex flex-col h-full cursor-pointer overflow-hidden">
          <div class="flex-1 overflow-y-auto min-h-0 space-y-0.5 px-0.5">
            <div
              v-for="todo in dailyCompletedMap.get(date.format('YYYY-MM-DD'))!"
              :key="todo.id"
              class="flex items-center gap-1 truncate"
              :title="todo.content"
            >
              <CheckCircleFilled class="shrink-0 text-[var(--primary)] text-[9px]" />
              <span class="text-[11px] text-[var(--muted-foreground)] truncate leading-4">{{ todo.content }}</span>
            </div>
          </div>
          <div class="flex items-center justify-end px-1 pb-1 shrink-0">
            <span v-if="dailyCompletedMap.get(date.format('YYYY-MM-DD'))?.length" class="text-[10px] text-[var(--primary)] font-semibold leading-none">
              {{ dailyCompletedMap.get(date.format('YYYY-MM-DD'))!.length }}项
            </span>
          </div>
        </div>
      </template>
    </a-calendar>

    <a-modal
      v-model:open="showDetail"
      :title="selectedDayTitle"
      :footer="null"
      width="400px"
      :destroy-on-close="true"
    >
      <div v-if="selectedDayTodos.length === 0" class="text-sm text-[var(--muted-foreground)] py-4 text-center">
        该日期没有已完成的待办事项
      </div>
      <div v-else class="max-h-[400px] overflow-y-auto">
        <div
          v-for="todo in selectedDayTodos"
          :key="todo.id"
          class="flex items-start gap-2 py-2 px-1 border-b border-[var(--border)] last:border-b-0"
        >
          <CheckCircleFilled class="mt-0.5 shrink-0 text-[var(--primary)] text-sm" />
          <span class="text-sm text-[var(--foreground)] leading-5 break-all">{{ todo.content }}</span>
        </div>
      </div>
    </a-modal>
  </div>
</template>

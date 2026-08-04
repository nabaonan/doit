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

const monthlyCompletedMap = computed(() => {
  const m = new Map<string, TodoItem[]>()
  for (const t of props.todos) {
    if (!t.completed || !t.completedAt) continue
    const key = dayjs(t.completedAt).format("YYYY-MM")
    const list = m.get(key)
    if (list) {
      list.push(t)
    } else {
      m.set(key, [t])
    }
  }
  return m
})

const currentPanelMode = ref<"month" | "year">("month")
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

const panelValue = ref(dayjs())

function onSelect(date: dayjs.Dayjs, extra: { source: string }) {
  if (extra.source !== "date") return
  selectedDate.value = date
  showDetail.value = true
}

function onPanelChange(date: dayjs.Dayjs, mode: string) {
  currentPanelMode.value = mode as "month" | "year"
  panelValue.value = date
}

function getCellTodos(date: dayjs.Dayjs) {
  if (currentPanelMode.value === "year") {
    const key = date.format("YYYY-MM")
    return monthlyCompletedMap.value.get(key) || []
  }
  const key = date.format("YYYY-MM-DD")
  return dailyCompletedMap.value.get(key) || []
}
</script>

<template>
  <div class="flex-1 overflow-auto p-4">
    <a-calendar
      :value="panelValue"
      :fullscreen="true"
      @select="onSelect"
      @panelChange="onPanelChange"
    >
      <template #cellRender="{ date }">
        <div class="flex flex-col h-full cursor-pointer timeview-cell scrollbar-thin">
          <div class="flex-1 min-h-0 space-y-0.5 px-0.5 timeview-scroll" style="overflow-y: auto; scrollbar-width: thin;">
            <div
              v-for="todo in getCellTodos(date)"
              :key="todo.id"
              class="flex items-center gap-1 truncate"
              :title="todo.content"
            >
              <CheckCircleFilled class="shrink-0 text-[10px]" style="color: #22c55e" />
              <span class="text-[11px] text-[var(--muted-foreground)] truncate leading-4">{{ todo.content }}</span>
            </div>
          </div>
          <div class="flex items-center justify-end px-1 pb-1 shrink-0">
            <span v-if="getCellTodos(date).length" class="text-[10px] text-[var(--primary)] font-semibold leading-none">
              {{ getCellTodos(date).length }}项
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
          <CheckCircleFilled class="mt-0.5 shrink-0 text-sm" style="color: #22c55e" />
          <span class="text-sm text-[var(--foreground)] leading-5 break-all">{{ todo.content }}</span>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style>
.timeview-scroll::-webkit-scrollbar {
  width: 4px !important;
  height: 4px !important;
}
.timeview-scroll::-webkit-scrollbar-track {
  background: transparent !important;
}
.timeview-scroll::-webkit-scrollbar-thumb {
  background: var(--border) !important;
  border-radius: 9999px !important;
  border: none !important;
  box-shadow: none !important;
}
.timeview-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--muted-foreground) !important;
}

/* Firefox */
.timeview-scroll {
  scrollbar-width: thin !important;
  scrollbar-color: var(--border) transparent !important;
}


/* ant-calendar 内部时间轴滚轮也隐藏原生日历系统滚动条 */
.timeview-cell :deep(.ant-picker-calendar-date-content) {
  scrollbar-width: thin !important;
  scrollbar-color: var(--border) transparent !important;
}
.timeview-cell :deep(.ant-picker-calendar-date-content::-webkit-scrollbar) {
  width: 4px !important;
  height: 4px !important;
}
.timeview-cell :deep(.ant-picker-calendar-date-content::-webkit-scrollbar-track) {
  background: transparent !important;
}
.timeview-cell :deep(.ant-picker-calendar-date-content::-webkit-scrollbar-thumb) {
  background: var(--border) !important;
  border-radius: 9999px !important;
}
</style>

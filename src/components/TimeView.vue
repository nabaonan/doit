<script setup lang="ts">
import { ref, computed } from "vue";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import TodoItem from "./TodoItem.vue";
import type { TodoItem as TodoItemType, TodoItemNode } from "../types";
import { flatToNested } from "../types";

dayjs.extend(isoWeek);

const props = defineProps<{
  todos: TodoItemType[];
}>();

const mode = ref<"week" | "month">("week");
const currentDate = ref(dayjs());
const selectedDay = ref(dayjs().format("YYYY-MM-DD"));

function onDateChange(date: dayjs.Dayjs | null) {
  if (date) {
    currentDate.value = date;
    if (mode.value === "week") {
      selectedDay.value = date.isoWeekday(1).format("YYYY-MM-DD");
    } else {
      selectedDay.value = date.startOf("month").format("YYYY-MM-DD");
    }
  }
}

function onModeChange(val: "week" | "month") {
  mode.value = val;
  const now = dayjs();
  currentDate.value = now;
  if (val === "week") {
    selectedDay.value = now.isoWeekday(1).format("YYYY-MM-DD");
  } else {
    selectedDay.value = now.startOf("month").format("YYYY-MM-DD");
  }
}

const dayItems = computed(() => {
  if (mode.value === "week") {
    const start = currentDate.value.isoWeekday(1).startOf("day");
    const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = start.add(i, "day");
      const key = d.format("YYYY-MM-DD");
        return {
          key,
          label: `${weekdays[i]} ${d.format("M月D日")}`,
        };
    });
  } else {
    const start = currentDate.value.startOf("month");
    const end = currentDate.value.endOf("month");
    const items: { key: string; label: string }[] = [];
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    for (let d = start; d.isBefore(end) || d.isSame(end, "day"); d = d.add(1, "day")) {
      const key = d.format("YYYY-MM-DD");
      items.push({
        key,
        label: `${weekdays[d.day()]} ${d.format("M月D日")}`,
      });
    }
    return items;
  }
});

const selectedDayNodes = computed<TodoItemNode[]>(() => {
  const dayTodos = props.todos.filter((t) => t.completedAt && dayjs(t.completedAt).format("YYYY-MM-DD") === selectedDay.value);
  return flatToNested(dayTodos);
});

function onSelect({ key }: { key: string }) {
  selectedDay.value = key;
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3 shrink-0">
      <a-segmented
        v-model:value="mode"
        :options="[
          { label: '按周', value: 'week' },
          { label: '按月', value: 'month' },
        ]"
        size="small"
        @change="onModeChange"
      />
      <a-date-picker
        v-if="mode === 'week'"
        v-model:value="currentDate"
        picker="week"
        format="YYYY 第wo"
        @change="onDateChange"
        class="flex-1"
      />
      <a-date-picker
        v-else
        v-model:value="currentDate"
        picker="month"
        format="YYYY年M月"
        @change="onDateChange"
        class="flex-1"
      />
    </div>

    <div class="flex-1 flex overflow-hidden">
      <div class="w-[150px] border-r border-[var(--border)] shrink-0 min-h-0" style="overflow-y: auto; max-height: 100%;">
        <a-menu
          mode="inline"
          :items="dayItems"
          :selectedKeys="[selectedDay]"
          @select="onSelect"
          style="border-inline-end: none !important;"
        />
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="selectedDayNodes.length === 0" class="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">
          该日期没有已完成的待办事项
        </div>
        <template v-for="node in selectedDayNodes" :key="node.id">
          <TodoItem
            :todo="node"
            :settings="{ completionMode: 'checkbox', longPressDuration: 3, theme: 'system', happyMode: false, fontFamily: 'default', addTodoShortcut: { key: 'Enter', ctrl: false, shift: false, alt: false, meta: false }, tags: [], categories: [], defaultCategoryId: null, cloudSync: { enabled: false, provider: 'webdav', webdavUrl: '', webdavUsername: '', webdavPassword: '' }, autoBackup: { enabled: false, interval: 30, unit: 'minute' }, autoRestore: { enabled: false, interval: 30, unit: 'minute' } }"
            :is-editing="false"
            :edit-content="''"
            :readonly="true"
            :has-children="node.children.length > 0"
          />
          <template v-if="node.children.length > 0">
            <div v-for="child in node.children" :key="child.id" class="pl-6">
              <TodoItem
                :todo="child"
                :settings="{ completionMode: 'checkbox', longPressDuration: 3, theme: 'system', happyMode: false, fontFamily: 'default', addTodoShortcut: { key: 'Enter', ctrl: false, shift: false, alt: false, meta: false }, tags: [], categories: [], defaultCategoryId: null, cloudSync: { enabled: false, provider: 'webdav', webdavUrl: '', webdavUsername: '', webdavPassword: '' }, autoBackup: { enabled: false, interval: 30, unit: 'minute' }, autoRestore: { enabled: false, interval: 30, unit: 'minute' } }"
                :is-editing="false"
                :edit-content="''"
                :readonly="true"
                :is-sub-task="true"
                :depth="1"
              />
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { CalendarHeatmap } from "vue3-calendar-heatmap";
import "vue3-calendar-heatmap/dist/style.css";
import type { TodoItem } from "../types";

dayjs.extend(isoWeek);

const props = defineProps<{ todos: TodoItem[] }>();

const dailyCounts = computed(() => {
  const m = new Map<string, number>();
  for (const t of props.todos) {
    if (!t.completed || !t.completedAt) continue;
    const d = dayjs(t.completedAt).format("YYYY-MM-DD");
    m.set(d, (m.get(d) || 0) + 1);
  }
  return m;
});

const values = computed(() =>
  Array.from(dailyCounts.value, ([date, count]) => ({ date, count }))
);

const totalCount = computed(() => {
  let sum = 0;
  for (const n of dailyCounts.value.values()) sum += n;
  return sum;
});

const todayStr = dayjs().format("YYYY-MM-DD");

const isDark = ref(false);
const darkObserver = new MutationObserver(() => {
  isDark.value = document.documentElement.classList.contains("dark");
});
onMounted(() => {
  isDark.value = document.documentElement.classList.contains("dark");
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
});
onBeforeUnmount(() => darkObserver.disconnect());

const lightRangeColor = ["#ebedf0", "#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const darkRangeColor = ["#161b22", "#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const rangeColor = computed(() => (isDark.value ? darkRangeColor : lightRangeColor));

const locale = {
  months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  days: ["日", "一", "二", "三", "四", "五", "六"],
  on: "",
  less: "少",
  more: "多",
};

const tooltipFormatter = (item: { date: Date; count?: number }, _unit: string) => {
  const date = dayjs(item.date).format("YYYY年MM月DD日");
  if (item.count === undefined || item.count === 0) {
    return `${date} 无完成记录`;
  }
  return `${date} 完成 ${item.count} 个待办`;
};

const completionMode = ref<"week" | "month">("month");
const selectedDate = ref(dayjs());

const periodRange = computed(() => {
  if (completionMode.value === "month") {
    return {
      start: selectedDate.value.startOf("month"),
      end: selectedDate.value.endOf("month"),
      label: selectedDate.value.format("YYYY年M月"),
    };
  }
  return {
    start: selectedDate.value.isoWeekday(1).startOf("day"),
    end: selectedDate.value.isoWeekday(7).endOf("day"),
    label: `${selectedDate.value.isoWeekday(1).format("M月D日")} - ${selectedDate.value.isoWeekday(7).format("M月D日")}`,
  };
});

const completionStats = computed(() => {
  const { start, end } = periodRange.value;
  const inRange = (d: dayjs.Dayjs) =>
    (d.isSame(start, "day") || d.isAfter(start)) &&
    (d.isSame(end, "day") || d.isBefore(end));
  const cohort = props.todos.filter((t) => t.createdAt && inRange(dayjs(t.createdAt)));
  let completed = 0;
  for (const t of cohort) {
    if (t.completedAt && inRange(dayjs(t.completedAt))) completed++;
  }
  const total = cohort.length;
  const incomplete = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, incomplete, percent };
});

const ringColors = computed(() =>
  isDark.value
    ? { done: "#22c55e", todo: "#374151" }
    : { done: "#16a34a", todo: "#e5e7eb" }
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="flex flex-col gap-6 w-full">
      <section class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 class="text-sm font-semibold text-[var(--foreground)]">每日完成热点图</h2>
          <span class="text-xs text-[var(--muted-foreground)]">
            最近 52 周 · 共完成 {{ totalCount }} 个待办 · 活跃 {{ dailyCounts.size }} 天
          </span>
        </div>
        <CalendarHeatmap
          :values="values"
          :end-date="todayStr"
          :range-color="rangeColor"
          :locale="locale"
          :tooltip="true"
          tooltip-unit="个待办"
          :tooltip-formatter="tooltipFormatter"
          no-data-text="无数据"
          :round="3"
          class="w-full"
        />
        <p
          v-if="totalCount === 0"
          class="text-xs text-[var(--muted-foreground)] self-center py-4"
        >
          还没有完成记录,完成一条待办即可点亮你的第一格
        </p>
      </section>

      <section class="border-t border-[var(--border)] pt-4 flex flex-col gap-3">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 class="text-sm font-semibold text-[var(--foreground)]">完成率</h2>
          <span class="text-xs text-[var(--muted-foreground)]">
            周期: {{ periodRange.label }} · 共 {{ completionStats.total }} 个待办
          </span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <a-segmented
            v-model:value="completionMode"
            :options="[
              { label: '按月', value: 'month' },
              { label: '按周', value: 'week' },
            ]"
            size="small"
          />
          <a-date-picker
            v-if="completionMode === 'month'"
            v-model:value="selectedDate"
            picker="month"
            format="YYYY年M月"
            class="flex-1 min-w-0"
          />
          <a-date-picker
            v-else
            v-model:value="selectedDate"
            picker="week"
            format="YYYY 第wo"
            class="flex-1 min-w-0"
          />
        </div>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-6 mt-2">
          <a-progress
            type="circle"
            :percent="completionStats.percent"
            :stroke-color="ringColors.done"
            :rail-color="ringColors.todo"
            :size="160"
            :stroke-width="10"
            :format="(p?: number) => `${p ?? 0}%`"
          />
          <div class="flex flex-col gap-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-sm" :style="{ background: ringColors.done }" />
              <span class="text-[var(--muted-foreground)]">已完成</span>
              <span class="font-semibold text-[var(--foreground)]">{{ completionStats.completed }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-sm" :style="{ background: ringColors.todo }" />
              <span class="text-[var(--muted-foreground)]">未完成</span>
              <span class="font-semibold text-[var(--foreground)]">{{ completionStats.incomplete }}</span>
            </div>
          </div>
        </div>
        <p
          v-if="completionStats.total === 0"
          class="text-xs text-[var(--muted-foreground)] mt-2 text-center"
        >
          该周期内没有创建的待办
        </p>
      </section>
    </div>
  </div>
</template>

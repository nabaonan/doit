<script setup lang="ts">
import { ref, computed } from "vue";
import { X, Copy, FileDown, FileText } from "lucide-vue-next";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import jsPDF from "jspdf";
import type { TodoItem } from "../types";
import { isTauri } from "../services/tauriEnv";

dayjs.extend(isoWeek);

const props = defineProps<{
  todos: TodoItem[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const reportType = ref<"daily" | "weekly">("daily");

const todayStr = computed(() => dayjs().format("YYYY-MM-DD"));

const weekRange = computed(() => {
  const start = dayjs().isoWeekday(1).format("YYYY-MM-DD");
  const end = dayjs().isoWeekday(7).format("YYYY-MM-DD");
  return { start, end };
});

const filteredTodos = computed(() => {
  if (reportType.value === "daily") {
    return props.todos.filter((t) => dayjs(t.createdAt).format("YYYY-MM-DD") === todayStr.value);
  }
  return props.todos.filter((t) => {
    const d = dayjs(t.createdAt).format("YYYY-MM-DD");
    return d >= weekRange.value.start && d <= weekRange.value.end;
  });
});

const completedTodos = computed(() => filteredTodos.value.filter((t) => t.completed));
const uncompletedTodos = computed(() => filteredTodos.value.filter((t) => !t.completed));

const completionRate = computed(() => {
  const total = filteredTodos.value.length;
  const done = completedTodos.value.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
});

function formatDuration(createdAt: string, completedAt: string | null): string {
  if (!completedAt) return "";
  const start = dayjs(createdAt);
  const end = dayjs(completedAt);
  const seconds = end.diff(start, "second");
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = end.diff(start, "minute");
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = end.diff(start, "hour");
  if (hours < 24) return `${hours} 小时`;
  const days = end.diff(start, "day");
  return `${days} 天`;
}

function formatDate(dateStr: string): string {
  return dayjs(dateStr).format("YYYY年MM月DD日");
}

const reportText = computed(() => {
  const dateLabel =
    reportType.value === "daily"
      ? formatDate(todayStr.value)
      : `${formatDate(weekRange.value.start)} - ${formatDate(weekRange.value.end)}`;

  const lines: string[] = [];
  lines.push(`# Doit 报告`);
  lines.push(`**日期**: ${dateLabel}`);
  lines.push(
    `**完成率**: ${completionRate.value.done}/${completionRate.value.total} (${completionRate.value.pct}%)`
  );
  lines.push("");

  if (completedTodos.value.length > 0) {
    lines.push("## 已完成");
    for (const todo of completedTodos.value) {
      const duration = formatDuration(todo.createdAt, todo.completedAt);
      const timeInfo = duration ? ` (${duration})` : "";
      lines.push(`- [x] ${todo.content}${timeInfo}`);
    }
    lines.push("");
  }

  if (uncompletedTodos.value.length > 0) {
    lines.push("## 未完成");
    for (const todo of uncompletedTodos.value) {
      lines.push(`- [ ] ${todo.content}`);
    }
    lines.push("");
  }

  if (filteredTodos.value.length === 0) {
    lines.push("暂无数据");
  }

  return lines.join("\n");
});

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(reportText.value);
  } catch {
  }
}

async function exportMarkdown() {
  if (!isTauri) {
    copyToClipboard()
    return
  }
  try {
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    const filePath = await save({
      defaultPath: `doit-${reportType.value === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!filePath) return;
    await writeTextFile(filePath, reportText.value);
  } catch {
  }
}

async function exportPDF() {
  if (!isTauri) {
    copyToClipboard()
    return
  }
  try {
    const doc = new jsPDF();
    const dateLabel =
      reportType.value === "daily"
        ? formatDate(todayStr.value)
        : `${formatDate(weekRange.value.start)} - ${formatDate(weekRange.value.end)}`;

    doc.setFontSize(20);
    doc.text("Doit 报告", 20, 20);
    doc.setFontSize(12);
    doc.text(`日期: ${dateLabel}`, 20, 30);
    doc.text(
      `完成率: ${completionRate.value.done}/${completionRate.value.total} (${completionRate.value.pct}%)`,
      20,
      38
    );

    let y = 50;

    if (completedTodos.value.length > 0) {
      doc.setFontSize(14);
      doc.text("已完成", 20, y);
      y += 8;
      doc.setFontSize(11);
      for (const todo of completedTodos.value) {
        const duration = formatDuration(todo.createdAt, todo.completedAt);
        const timeInfo = duration ? ` (${duration})` : "";
        doc.text(`[x] ${todo.content}${timeInfo}`, 25, y);
        y += 7;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      }
      y += 5;
    }

    if (uncompletedTodos.value.length > 0) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.text("未完成", 20, y);
      y += 8;
      doc.setFontSize(11);
      for (const todo of uncompletedTodos.value) {
        doc.text(`[ ] ${todo.content}`, 25, y);
        y += 7;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      }
    }

    const pdfBytes = doc.output("arraybuffer");
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { writeFile } = await import("@tauri-apps/plugin-fs")
    const filePath = await save({
      defaultPath: `doit-${reportType.value === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!filePath) return;
    await writeFile(filePath, new Uint8Array(pdfBytes as ArrayBuffer));
  } catch {
  }
}

</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
    @click.self="emit('close')"
  >
    <div
      class="bg-[var(--card)] rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto p-6 text-[var(--foreground)]"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">报告</h2>
        <button
          class="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="flex bg-[var(--secondary)] rounded-lg p-1 mb-4">
        <button
          class="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="
            reportType === 'daily'
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          "
          @click="reportType = 'daily'"
        >
          日报
        </button>
        <button
          class="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="
            reportType === 'weekly'
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          "
          @click="reportType = 'weekly'"
        >
          周报
        </button>
      </div>

      <div class="flex items-center gap-4 mb-4 text-sm">
        <span class="text-[var(--muted-foreground)]">
          {{ reportType === "daily" ? "今日" : "本周" }}
        </span>
        <span class="font-medium">
          已完成 {{ completionRate.done }} / {{ completionRate.total }}（{{ completionRate.pct }}%）
        </span>
      </div>

      <div
        class="bg-[var(--secondary)] rounded-lg p-4 mb-4 max-h-[300px] overflow-y-auto"
      >
        <pre class="text-sm text-[var(--foreground)] whitespace-pre-wrap font-mono leading-relaxed">{{ reportText }}</pre>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="flex items-center gap-1.5 bg-[var(--secondary)] text-[var(--foreground)] px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--accent)]"
          @click="copyToClipboard"
        >
          <Copy :size="14" />
          复制到剪贴板
        </button>
        <button
          class="flex items-center gap-1.5 bg-[var(--secondary)] text-[var(--foreground)] px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--accent)]"
          @click="exportMarkdown"
        >
          <FileDown :size="14" />
          导出 Markdown
        </button>
        <button
          class="flex items-center gap-1.5 bg-[var(--secondary)] text-[var(--foreground)] px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--accent)]"
          @click="exportPDF"
        >
          <FileText :size="14" />
          导出 PDF
        </button>
        <button
          class="flex items-center gap-1.5 bg-[var(--secondary)] text-[var(--foreground)] px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--accent)] ml-auto"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>
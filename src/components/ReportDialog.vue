<script setup lang="ts">
import { ref, computed } from "vue";
import { CopyOutlined, DownloadOutlined, FileTextOutlined } from "@antdv-next/icons";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { jsPDF } from "jspdf";
import type { TodoItem } from "../types";
import { isTauri } from "../services/tauriEnv";

dayjs.extend(isoWeek);

const props = defineProps<{
  open: boolean;
  todos: TodoItem[];
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
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

const FONT_PATH = "fonts/noto-sans-sc.ttf";
const FONT_URL = "/fonts/noto-sans-sc.ttf";

let fontBase64: string | null = null;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function loadCJKFont(): Promise<string> {
  if (fontBase64) return fontBase64;

  if (isTauri) {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const data = await readFile(FONT_PATH);
    fontBase64 = uint8ArrayToBase64(data);
    return fontBase64;
  }

  const res = await fetch(FONT_URL);
  const blob = await res.blob();
  fontBase64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
  return fontBase64;
}

async function buildPDFDoc(): Promise<jsPDF> {
  const doc = new jsPDF();

  const base64 = await loadCJKFont();
  doc.addFileToVFS("cjk-font.ttf", base64);
  doc.addFont("cjk-font.ttf", "CJKFont", "normal");
  doc.setFont("CJKFont");

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

  return doc;
}

async function exportMarkdown() {
  const filename = `doit-${reportType.value === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.md`;
  const content = reportText.value;

  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: filename,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, content);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportPDF() {
  const filename = `doit-${reportType.value === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.pdf`;

  if (isTauri) {
    try {
      const doc = await buildPDFDoc();
      const pdfBytes = doc.output("arraybuffer");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: filename,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!filePath) return;
      await writeFile(filePath, new Uint8Array(pdfBytes as ArrayBuffer));
    } catch (e) {
      console.error(e);
    }
    return;
  }

  try {
    const doc = await buildPDFDoc();
    doc.save(filename);
  } catch (e) {
    console.error(e);
  }
}

function onCancel() {
  emit("update:open", false);
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="报告"
    :footer="null"
    :width="500"
    @cancel="onCancel"
    centered
    destroyOnHidden
  >
    <a-segmented
      v-model:value="reportType"
      :options="[
        { label: '日报', value: 'daily' },
        { label: '周报', value: 'weekly' },
      ]"
      block
      class="mb-4"
    />

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
      <a-button @click="copyToClipboard">
        <template #icon><CopyOutlined /></template>
        复制到剪贴板
      </a-button>
      <a-button @click="exportMarkdown">
        <template #icon><DownloadOutlined /></template>
        导出 Markdown
      </a-button>
      <a-button @click="exportPDF">
        <template #icon><FileTextOutlined /></template>
        导出 PDF
      </a-button>
      <a-button class="ml-auto" @click="onCancel">关闭</a-button>
    </div>
  </a-modal>
</template>
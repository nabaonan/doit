<script setup lang="ts">
import { ref, computed } from "vue";
import { CopyOutlined, DownloadOutlined, FileTextOutlined } from "@antdv-next/icons";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { jsPDF } from "jspdf";
import type { TodoItem, TodoItemNode, Category } from "../types";
import { flatToNested } from "../types";

dayjs.extend(isoWeek);

const props = defineProps<{
  open: boolean;
  todos: TodoItem[];
  categories: Category[];
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
}>();

const reportType = ref<"daily" | "weekly">("daily");
// 分类筛选：__all__ = 全部, __none__ = 未分类, 否则为 category id
const catFilter = ref<string>("__all__");

const todayStr = computed(() => dayjs().format("YYYY-MM-DD"));

const weekRange = computed(() => {
  const start = dayjs().isoWeekday(1).format("YYYY-MM-DD");
  const end = dayjs().isoWeekday(7).format("YYYY-MM-DD");
  return { start, end };
});

const catFilterOptions = computed(() => {
  return [
    { label: "全部", value: "__all__" },
    ...props.categories.map((c) => ({ label: c.name, value: c.id })),
  ];
});

const filteredTodos = computed(() => {
  let list = props.todos;
  if (reportType.value === "daily") {
    list = list.filter((t) => dayjs(t.createdAt).format("YYYY-MM-DD") === todayStr.value);
  } else {
    const inWeek = (d: string) => {
      const day = dayjs(d).format("YYYY-MM-DD");
      return day >= weekRange.value.start && day <= weekRange.value.end;
    };
    list = list.filter((t) => {
      if (!t.completed) return true;
      return inWeek(t.createdAt) || (!!t.completedAt && inWeek(t.completedAt));
    });
  }
  if (catFilter.value === "__all__") {
    return list;
  } else if (catFilter.value === "__none__") {
    return list.filter((t) => !t.catId);
  }
  return list.filter((t) => t.catId === catFilter.value);
});

// "全部" 模式下按分类分组输出
const groupedByCategory = computed(() => {
  if (catFilter.value !== "__all__") return null;
  const catMap = new Map(props.categories.map((c) => [c.id, c]));
  const buckets = new Map<string, TodoItem[]>();
  for (const t of filteredTodos.value) {
    const key = t.catId || "__none__";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  const groups: { key: string; name: string; color: string; todos: TodoItem[] }[] = [];
  // 已有分类按 settings.categories 顺序排列，未分类最后
  for (const c of props.categories) {
    if (buckets.has(c.id)) {
      groups.push({ key: c.id, name: c.name, color: c.color, todos: buckets.get(c.id)! });
    }
  }
  if (buckets.has("__none__")) {
    groups.push({ key: "__none__", name: "未分类", color: "#9CA3AF", todos: buckets.get("__none__")! });
  }
  // 兜底：当前 props.categories 已删除的旧 id
  for (const [key, todos] of buckets) {
    if (key === "__none__") continue;
    if (!catMap.has(key) && !groups.some((g) => g.key === key)) {
      groups.push({ key, name: "已删除分类", color: "#9CA3AF", todos });
    }
  }
  return groups;
});

const nestedTodos = computed(() => flatToNested(filteredTodos.value));

const completionRate = computed(() => {
  const total = filteredTodos.value.length;
  const done = filteredTodos.value.filter((t) => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
});

function groupStats(todos: TodoItem[]) {
  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

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

function renderTreeMarkdown(nodes: TodoItemNode[], depth: number): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const node of nodes) {
    const checkbox = node.completed ? "[x]" : "[ ]";
    const duration = node.completed
      ? ` (${formatDuration(node.createdAt, node.completedAt)})`
      : "";
    lines.push(`${indent}- ${checkbox} ${node.content}${duration}`);
    if (node.children.length > 0) {
      lines.push(...renderTreeMarkdown(node.children, depth + 1));
    }
  }
  return lines;
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

  if (filteredTodos.value.length === 0) {
    lines.push("暂无数据");
  } else if (groupedByCategory.value) {
    for (const group of groupedByCategory.value) {
      const stats = groupStats(group.todos);
      lines.push(`## ${group.name}`);
      lines.push(`完成率: ${stats.done}/${stats.total} (${stats.pct}%)`);
      lines.push("");
      const nested = flatToNested(group.todos);
      lines.push(...renderTreeMarkdown(nested, 0));
      lines.push("");
    }
  } else {
    const nested = nestedTodos.value;
    lines.push(...renderTreeMarkdown(nested, 0));
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

  const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
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

  doc.setFontSize(11);
  function renderTreePDF(nodes: TodoItemNode[], depth: number) {
    for (const node of nodes) {
      const checkbox = node.completed ? "[x]" : "[ ]";
      const duration = node.completed
        ? ` (${formatDuration(node.createdAt, node.completedAt)})`
        : "";
      doc.text(`${checkbox} ${node.content}${duration}`, 25 + depth * 12, y);
      y += 7;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      if (node.children.length > 0) {
        renderTreePDF(node.children, depth + 1);
      }
    }
  }

  function pageBreakIfNeeded(need = 20) {
    if (y + need > 280) {
      doc.addPage();
      y = 20;
    }
  }

  if (filteredTodos.value.length === 0) {
    doc.text("暂无数据", 25, y);
  } else if (groupedByCategory.value) {
    for (const group of groupedByCategory.value) {
      pageBreakIfNeeded(30);
      doc.setFontSize(14);
      doc.text(`${group.name}`, 20, y);
      y += 7;
      const stats = groupStats(group.todos);
      doc.setFontSize(10);
      doc.text(`完成率: ${stats.done}/${stats.total} (${stats.pct}%)`, 25, y);
      y += 7;
      doc.setFontSize(11);
      const nested = flatToNested(group.todos);
      renderTreePDF(nested, 0);
      y += 4;
    }
  } else {
    renderTreePDF(nestedTodos.value, 0);
  }

  return doc;
}

async function exportMarkdown() {
  const filename = `doit-${reportType.value === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.md`;
  const content = reportText.value;

  const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;

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

  const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
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
    <div class="mb-5">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-[var(--muted-foreground)] shrink-0">分类</span>
        <a-select
          v-model:value="catFilter"
          :options="catFilterOptions"
          size="small"
          class="flex-1"
          :dropdown-match-select-width="false"
        />
      </div>
    </div>

    <a-segmented
      v-model:value="reportType"
      :options="[
        { label: '日报', value: 'daily' },
        { label: '周报', value: 'weekly' },
      ]"
      block
      class="mb-4"
    />

    <div class="mb-4 text-sm text-[var(--muted-foreground)]">
      {{ reportType === "daily" ? "今日" : "本周" }}
      已完成 {{ completionRate.done }} / {{ completionRate.total }}（{{ completionRate.pct }}%）
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
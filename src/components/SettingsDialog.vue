<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from "vue";
import { Modal } from "antdv-next";
import { KeyOutlined, SunOutlined, MoonOutlined, MonitorOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined, LockOutlined, ExclamationCircleOutlined, BgColorsOutlined, InteractionOutlined, CloudSyncOutlined, DatabaseOutlined } from "@antdv-next/icons";
import type { AppSettings } from "../types";

const props = defineProps<{
  open: boolean;
  settings: AppSettings;
}>();

const emit = defineEmits<{
  (e: "update:open", open: boolean): void;
  (e: "save", settings: AppSettings): void;
  (e: "clear-data"): void;
  (e: "export-db"): void;
  (e: "import-db"): void;
  (e: "backup-now", settings: AppSettings): void;
}>();

const backupNowLoading = ref(false);

const localSettings = ref<AppSettings>(JSON.parse(JSON.stringify(props.settings)));
const recordingShortcut = ref(false);

const backupUnitOptions = [
  { value: "minute", label: "分钟" },
  { value: "hour", label: "小时" },
  { value: "day", label: "天" },
];

const cloudSyncEnabled = computed(() => localSettings.value.cloudSync.enabled);

type CategoryKey = "appearance" | "interaction" | "sync" | "data";

const activeCategory = ref<CategoryKey>("appearance");
const contentRef = ref<HTMLElement | null>(null);
const sectionAppearance = ref<HTMLElement | null>(null);
const sectionInteraction = ref<HTMLElement | null>(null);
const sectionSync = ref<HTMLElement | null>(null);
const sectionData = ref<HTMLElement | null>(null);

const categoryMenuItems = [
  { key: "appearance", label: "外观", icon: () => h(BgColorsOutlined) },
  { key: "interaction", label: "交互", icon: () => h(InteractionOutlined) },
  { key: "sync", label: "同步", icon: () => h(CloudSyncOutlined) },
  { key: "data", label: "数据", icon: () => h(DatabaseOutlined) },
];

const menuStyles = {
  item: { height: "28px", lineHeight: "28px", marginBlock: "2px", marginInline: 0 },
  itemIcon: { fontSize: "14px" },
  itemContent: { fontSize: "13px" },
  list: { paddingInline: 0 },
};

const modalStyles = {
  container: { padding: 0 },
  header: { padding: "12px 16px" },
  footer: { padding: "12px 16px" },
};

const sectionRefs: Record<CategoryKey, { value: HTMLElement | null }> = {
  appearance: sectionAppearance,
  interaction: sectionInteraction,
  sync: sectionSync,
  data: sectionData,
};

function handleCategorySelect({ key }: { key: string }) {
  const k = key as CategoryKey;
  activeCategory.value = k;
  const el = sectionRefs[k].value;
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onContentScroll() {
  if (!contentRef.value) return;
  const containerTop = contentRef.value.getBoundingClientRect().top;
  let current: CategoryKey = "appearance";
  for (const key of ["appearance", "interaction", "sync", "data"] as CategoryKey[]) {
    const el = sectionRefs[key].value;
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top - containerTop < 40) current = key;
  }
  activeCategory.value = current;
}

watch(() => props.open, (val) => {
  if (val) {
    // 打开时同步 props.settings 到 localSettings，期间抑制 deep watch 触发的保存
    suppressSave = true;
    localSettings.value = JSON.parse(JSON.stringify(props.settings));
    // 在 nextTick 后解除抑制，确保初次同步完成
    nextTick(() => {
      suppressSave = false;
    });
  }
});

// 实时保存：设置项改变后 250ms 自动写入数据库（debounce 避免频繁写入）
let saveTimer: number | null = null;
let suppressSave = false; // 抑制初始同步期间的保存
watch(
  localSettings,
  (val) => {
    if (suppressSave) return;
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      emit("save", JSON.parse(JSON.stringify(val)));
    }, 250);
  },
  { deep: true }
);

onUnmounted(() => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
});

const shortcutDisplay = computed(() => {
  const sc = localSettings.value.addTodoShortcut;
  if (!sc) return "Enter";
  const parts: string[] = [];
  if (sc.ctrl) parts.push("Ctrl");
  if (sc.shift) parts.push("Shift");
  if (sc.alt) parts.push("Alt");
  if (sc.meta) parts.push("Cmd");
  const displayKey = sc.key === " " ? "Space" : sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
  parts.push(displayKey);
  return parts.join(" + ");
});

function startRecording() {
  recordingShortcut.value = true;
}

function handleRecordKeydown(e: KeyboardEvent) {
  if (!recordingShortcut.value) return;
  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    recordingShortcut.value = false;
    return;
  }

  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

  localSettings.value.addTodoShortcut = {
    key: e.key,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey,
  };
  recordingShortcut.value = false;
}

onMounted(() => {
  document.addEventListener("keydown", handleRecordKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleRecordKeydown);
});

function onClose() {
  // 立即 flush 未保存的修改
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  emit("save", JSON.parse(JSON.stringify(localSettings.value)));
  emit("update:open", false);
}

function confirmClearData() {
  Modal.confirm({
    title: "确定要清空所有数据吗？",
    content: "此操作不可恢复，待办、分类和标签都会被清除（主题、快捷键等设置保留）。",
    okText: "确认清空",
    cancelText: "取消",
    okButtonProps: { danger: true },
    onOk: () => {
      emit("clear-data");
    },
  });
}

async function handleBackupNow() {
  if (backupNowLoading.value) return;
  backupNowLoading.value = true;
  try {
    // 把当前最新设置（包含 keepRecent 等未保存改动）作为参数传给父组件，
    // 避免父组件 handleSaveSettings 异步 + handleBackupNow 同步导致的时序竞态：
    // 之前 emit("save") 和 emit("backup-now") 都同步排队，runBackup 读到的
    // settings.value 还是旧值，新 keepRecent 没有生效。
    const newSettings = JSON.parse(JSON.stringify(localSettings.value));
    emit("backup-now", newSettings);
  } finally {
    // loading 短暂保持，给用户视觉反馈
    setTimeout(() => {
      backupNowLoading.value = false;
    }, 1500);
  }
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="设置"
    :footer="null"
    :width="760"
    :styles="modalStyles"
    :bodyStyle="{ padding: '12px' }"
    @cancel="onClose"
    centered
    destroyOnHidden
  >
    <div class="flex h-[520px] max-h-[70vh]">
      <!-- 左侧分类菜单 -->
      <div class="w-[120px] shrink-0 border-r border-[var(--border)] py-1 overflow-y-auto">
        <a-menu
          mode="inline"
          :items="categoryMenuItems"
          :selectedKeys="[activeCategory]"
          :styles="menuStyles"
          @select="handleCategorySelect"
          style="border-inline-end: none !important;"
        />
      </div>

      <!-- 右侧内容 -->
      <div ref="contentRef" class="flex-1 overflow-y-auto px-4 py-3" @scroll="onContentScroll">
        <a-divider size="small" class="!mt-0 !mb-3" style="border-color: var(--border)">外观</a-divider>

        <!-- 外观 -->
        <section id="sec-appearance" ref="sectionAppearance" class="space-y-4 pb-2">

          <!-- 主题 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">主题</h4>
            <a-radio-group v-model:value="localSettings.theme" class="flex gap-x-4">
              <a-radio value="system">
                <MonitorOutlined class="mr-0.5" :style="{ fontSize: '13px' }" />
                系统
              </a-radio>
              <a-radio value="light">
                <SunOutlined class="mr-0.5" :style="{ fontSize: '13px' }" />
                浅色
              </a-radio>
              <a-radio value="dark">
                <MoonOutlined class="mr-0.5" :style="{ fontSize: '13px' }" />
                深色
              </a-radio>
            </a-radio-group>
          </div>

          <!-- 字体 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">字体</h4>
            <a-radio-group v-model:value="localSettings.fontFamily" class="flex gap-x-4">
              <a-radio value="default">系统默认</a-radio>
              <a-radio value="cartoon">
                <span style="font-family: 'ZCOOL XiaoWei', sans-serif;">卡通</span>
              </a-radio>
            </a-radio-group>
          </div>

          <!-- 快乐工作 -->
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm">快乐工作</span>
              <p class="text-xs text-[var(--muted-foreground)] mt-0.5">点击组件时有彩色圆点动画</p>
            </div>
            <a-switch v-model:checked="localSettings.happyMode" size="small" />
          </div>
        </section>

        <a-divider size="small" class="!my-3" style="border-color: var(--border)">交互</a-divider>

        <!-- 交互 -->
        <section id="sec-interaction" ref="sectionInteraction" class="space-y-4 pb-2">

          <!-- 完成方式 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">完成方式</h4>
            <a-radio-group v-model:value="localSettings.completionMode" class="flex gap-x-4">
              <a-radio value="checkbox">勾选</a-radio>
              <a-radio value="longpress">长按</a-radio>
            </a-radio-group>
            <div v-if="localSettings.completionMode === 'longpress'" class="mt-3 flex items-center gap-2">
              <span class="text-xs text-[var(--muted-foreground)] shrink-0">长按时长</span>
              <a-slider
                v-model:value="localSettings.longPressDuration"
                :min="1"
                :max="10"
                :step="1"
                class="flex-1"
              />
              <span class="text-xs font-medium w-8 text-right tabular-nums">{{ localSettings.longPressDuration }}秒</span>
            </div>
          </div>

          <!-- 快捷键 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">添加快捷键</h4>
            <a-button
              block
              size="small"
              class="flex items-center justify-between"
              :class="recordingShortcut ? 'border-[var(--primary)]' : ''"
              @click="startRecording"
            >
              <span class="flex items-center gap-2">
                <KeyOutlined :style="{ fontSize: '13px', color: 'var(--muted-foreground)' }" />
                <span v-if="recordingShortcut" class="text-[var(--primary)]">请按下组合键...</span>
                <span v-else class="text-[var(--muted-foreground)]">新增待办快捷键</span>
              </span>
              <a-tag>{{ shortcutDisplay }}</a-tag>
            </a-button>
          </div>
        </section>

        <a-divider size="small" class="!my-3" style="border-color: var(--border)">同步</a-divider>

        <!-- 同步 -->
        <section id="sec-sync" ref="sectionSync" class="space-y-4 pb-2">

          <!-- 云同步 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">云同步</h4>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm">启用云同步</span>
              <a-switch v-model:checked="localSettings.cloudSync.enabled" size="small" />
            </div>

            <div v-if="localSettings.cloudSync.enabled" class="flex flex-col gap-2">
              <a-input
                v-model:value="localSettings.cloudSync.webdavUrl"
                placeholder="WebDAV URL，例如 https://example.com/webdav/"
                size="small"
              />
              <a-input
                v-model:value="localSettings.cloudSync.webdavUsername"
                placeholder="用户名"
                size="small"
              />
              <a-input-password
                v-model:value="localSettings.cloudSync.webdavPassword"
                placeholder="密码"
                size="small"
              />

              <!-- 立即备份：手动触发上传 + 清理旧备份 -->
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs text-[var(--muted-foreground)]">
                  立即把本地数据上传到 WebDAV（旧的会自动清理）
                </span>
                <a-button
                  size="small"
                  :loading="backupNowLoading"
                  :disabled="!localSettings.cloudSync.webdavUrl"
                  @click="handleBackupNow"
                >
                  立即备份
                </a-button>
              </div>
            </div>
          </div>

          <!-- 启动时拉取（一次性，不与下方定时任务联动） -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">启动时拉取</h4>
            <div class="flex items-center justify-between">
              <span
                class="text-sm"
                :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }"
              >
                启动时拉取远程数据
              </span>
              <a-switch
                v-model:checked="localSettings.cloudSync.fetchOnStartup"
                :disabled="!cloudSyncEnabled"
                size="small"
              />
            </div>
            <p class="text-[11px] text-[var(--muted-foreground)] mt-1">
              {{ cloudSyncEnabled
                ? "应用启动时从 WebDAV 拉取最新数据并覆盖本地，与下方定时任务相互独立"
                : "需先启用云同步" }}
            </p>
          </div>

          <!-- 关闭时上传（一次性，不与下方定时任务联动） -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2">关闭时上传</h4>
            <div class="flex items-center justify-between">
              <span
                class="text-sm"
                :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }"
              >
                关闭时上传本地数据
              </span>
              <a-switch
                v-model:checked="localSettings.cloudSync.uploadOnExit"
                :disabled="!cloudSyncEnabled"
                size="small"
              />
            </div>
            <p class="text-[11px] text-[var(--muted-foreground)] mt-1">
              {{ cloudSyncEnabled
                ? "关闭窗口时自动把本地最新数据上传到 WebDAV，与下方定时任务相互独立"
                : "需先启用云同步" }}
            </p>
            <div class="flex items-center justify-between mt-2">
              <span
                class="text-sm"
                :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }"
              >
                云端保留近
              </span>
              <a-input-number
                v-model:value="localSettings.cloudSync.keepRecent"
                :min="0"
                :max="100"
                :step="1"
                :disabled="!cloudSyncEnabled"
                size="small"
                class="!w-20"
              />
              <span
                class="text-sm"
                :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }"
              >
                条备份（0 = 不限制）
              </span>
            </div>
          </div>

          <!-- 定时备份 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
              定时备份
              <a-tooltip v-if="!cloudSyncEnabled" title="需先启用云同步">
                <LockOutlined :style="{ fontSize: '12px', color: 'var(--muted-foreground)' }" />
              </a-tooltip>
            </h4>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm" :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }">
                启用定时上传
              </span>
              <a-switch
                v-model:checked="localSettings.autoBackup.enabled"
                :disabled="!cloudSyncEnabled"
                size="small"
              />
            </div>
            <div v-if="localSettings.autoBackup.enabled" class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm shrink-0">每</span>
                <a-input-number
                  v-model:value="localSettings.autoBackup.interval"
                  :min="1"
                  :max="999"
                  :step="1"
                  :disabled="!cloudSyncEnabled"
                  size="small"
                  class="flex-1"
                />
                <a-select
                  v-model:value="localSettings.autoBackup.unit"
                  :options="backupUnitOptions"
                  :disabled="!cloudSyncEnabled"
                  size="small"
                  class="w-24"
                />
              </div>
            </div>
          </div>

          <!-- 定时恢复 -->
          <div>
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
              定时恢复
              <a-tooltip color="warning" title="自动恢复会覆盖本地数据，请谨慎启用">
                <ExclamationCircleOutlined :style="{ fontSize: '12px' }" />
              </a-tooltip>
            </h4>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm" :class="{ 'text-[var(--muted-foreground)]': !cloudSyncEnabled }">
                启用定时下载
              </span>
              <a-switch
                v-model:checked="localSettings.autoRestore.enabled"
                :disabled="!cloudSyncEnabled"
                size="small"
              />
            </div>
            <div v-if="localSettings.autoRestore.enabled" class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm shrink-0">每</span>
                <a-input-number
                  v-model:value="localSettings.autoRestore.interval"
                  :min="1"
                  :max="999"
                  :step="1"
                  :disabled="!cloudSyncEnabled"
                  size="small"
                  class="flex-1"
                />
                <a-select
                  v-model:value="localSettings.autoRestore.unit"
                  :options="backupUnitOptions"
                  :disabled="!cloudSyncEnabled"
                  size="small"
                  class="w-24"
                />
              </div>
            </div>
          </div>
        </section>

        <a-divider size="small" class="!my-3" style="border-color: var(--border)">数据</a-divider>

        <!-- 数据 -->
        <section id="sec-data" ref="sectionData" class="space-y-4 pb-2">

          <div class="grid grid-cols-3 gap-2">
            <a-button size="small" @click="emit('export-db')">
              <DownloadOutlined />
              导出
            </a-button>
            <a-button size="small" @click="emit('import-db')">
              <UploadOutlined />
              导入
            </a-button>
            <a-button size="small" danger @click="confirmClearData">
              <DeleteOutlined />
              清空
            </a-button>
          </div>
        </section>
      </div>
    </div>
  </a-modal>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from "vue";
import { Modal } from "antdv-next";
import { KeyOutlined, SunOutlined, MoonOutlined, MonitorOutlined } from "@antdv-next/icons";
import type { AppSettings, Tag, FontFamilyOption } from "../types";

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
}>();

const localSettings = ref<AppSettings>(JSON.parse(JSON.stringify(props.settings)));
const recordingShortcut = ref(false);
const newTagName = ref("");
const newTagColor = ref("#3B82F6");

const presetColors = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#6B7280",
];

const providerOptions = [
  { value: "local_folder", label: "本地文件夹" },
  { value: "webdav", label: "WebDAV" },
];

const colorPickerPresets = computed(() => [
  {
    label: "预设颜色",
    colors: presetColors,
    defaultOpen: true,
  },
]);

function renderPresetsOnly({ extra }: { extra: { components: { Presets: any } } }) {
  return h(extra.components.Presets);
}

watch(() => props.open, (val) => {
  if (val) {
    localSettings.value = JSON.parse(JSON.stringify(props.settings));
    newTagName.value = "";
    newTagColor.value = "#3B82F6";
  }
});

function addTag() {
  const name = newTagName.value.trim();
  if (!name) return;
  if (!localSettings.value.tags) localSettings.value.tags = [];
  const tag: Tag = {
    id: crypto.randomUUID(),
    name,
    color: newTagColor.value,
  };
  localSettings.value.tags.push(tag);
  newTagName.value = "";
}

function removeTag(id: string) {
  if (!localSettings.value.tags) return;
  localSettings.value.tags = localSettings.value.tags.filter((t) => t.id !== id);
}

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

function onSave() {
  emit("save", JSON.parse(JSON.stringify(localSettings.value)));
  emit("update:open", false);
}

function onCancel() {
  emit("update:open", false);
}

function confirmClearData() {
  Modal.confirm({
    title: "确定要清空所有待办数据吗？",
    content: "此操作不可恢复，设置不会被清除。",
    okText: "确认清空",
    cancelText: "取消",
    okButtonProps: { danger: true },
    onOk: () => {
      emit("clear-data");
    },
  });
}
</script>

<template>
  <a-modal
    :open="props.open"
    title="设置"
    :footer="null"
    :width="420"
    @cancel="onCancel"
    centered
    destroyOnHidden
  >
    <div class="mb-6">
      <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">主题模式</h3>
      <a-radio-group v-model:value="localSettings.theme" class="flex flex-col gap-2">
        <a-radio value="system">
          <MonitorOutlined class="mr-1" :style="{ fontSize: '14px' }" />
          跟随系统
        </a-radio>
        <a-radio value="light">
          <SunOutlined class="mr-1" :style="{ fontSize: '14px' }" />
          浅色模式
        </a-radio>
        <a-radio value="dark">
          <MoonOutlined class="mr-1" :style="{ fontSize: '14px' }" />
          深色模式
        </a-radio>
      </a-radio-group>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">字体</h3>
      <a-radio-group v-model:value="localSettings.fontFamily" class="flex flex-col gap-2">
        <a-radio value="default">
          <span class="font-sans">系统默认</span>
        </a-radio>
        <a-radio value="cartoon">
          <span style="font-family: 'ZCOOL XiaoWei', sans-serif;">卡通字体 (小薇体)</span>
        </a-radio>
      </a-radio-group>
    </div>

    <div class="mb-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-[var(--muted-foreground)]">快乐工作</h3>
        <a-switch v-model:checked="localSettings.happyMode" />
      </div>
      <p class="text-xs text-[var(--muted-foreground)] mt-1">
        开启后点击按钮、复选框等组件会有彩色圆点动画效果
      </p>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">添加快捷键</h3>
      <a-button
        block
        class="flex items-center justify-between"
        :class="recordingShortcut ? 'border-[var(--primary)]' : ''"
        @click="startRecording"
      >
        <span class="flex items-center gap-2">
          <KeyOutlined :style="{ fontSize: '14px', color: 'var(--muted-foreground)' }" />
          <span v-if="recordingShortcut" class="text-[var(--primary)]">请按下组合键...</span>
          <span v-else class="text-[var(--muted-foreground)]">新增待办快捷键</span>
        </span>
        <a-tag>{{ shortcutDisplay }}</a-tag>
      </a-button>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">自定义标签</h3>
      <div class="flex gap-2 mb-3">
        <a-color-picker
          v-model:value="newTagColor"
          :presets="colorPickerPresets"
          value-format="hex"
          size="small"
          :panelRender="renderPresetsOnly"
        >
          <div
            class="w-8 h-8 rounded-md border border-[var(--border)] cursor-pointer shrink-0 transition-shadow hover:shadow-md"
            :style="{ backgroundColor: newTagColor }"
          />
        </a-color-picker>
        <a-input
          v-model:value="newTagName"
          placeholder="输入标签名称，回车添加"
          size="middle"
          @pressEnter="addTag"
          class="flex-1"
        />
      </div>
      <div v-if="localSettings.tags && localSettings.tags.length > 0" class="flex flex-wrap gap-2">
        <a-tag
          v-for="tag in localSettings.tags"
          :key="tag.id"
          :color="tag.color"
          variant="solid"
          closable
          @close="removeTag(tag.id)"
        >
          {{ tag.name }}
        </a-tag>
      </div>
      <div
        v-if="!localSettings.tags || localSettings.tags.length === 0"
        class="text-xs text-[var(--muted-foreground)] py-2"
      >
        暂无标签，请输入名称并回车添加
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">完成方式</h3>
      <a-radio-group v-model:value="localSettings.completionMode" class="flex flex-col gap-2">
        <a-radio value="checkbox">勾选完成</a-radio>
        <a-radio value="longpress">长按完成</a-radio>
      </a-radio-group>

      <div v-if="localSettings.completionMode === 'longpress'" class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-[var(--muted-foreground)]">长按时长</span>
          <span class="text-xs font-medium">{{ localSettings.longPressDuration }} 秒</span>
        </div>
        <a-slider
          v-model:value="localSettings.longPressDuration"
          :min="1"
          :max="10"
          :step="1"
        />
      </div>
    </div>

    <div class="mb-6">
      <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">云同步</h3>
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm">启用云同步</span>
        <a-switch v-model:checked="localSettings.cloudSync.enabled" />
      </div>

      <div v-if="localSettings.cloudSync.enabled" class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">同步方式</label>
          <a-select
            v-model:value="localSettings.cloudSync.provider"
            :options="providerOptions"
            class="w-full"
          />
        </div>

        <template v-if="localSettings.cloudSync.provider === 'local_folder'">
          <div>
            <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">同步路径</label>
            <div class="flex gap-2">
              <a-input
                v-model:value="localSettings.cloudSync.localSyncPath"
                placeholder="选择本地文件夹路径..."
              />
              <a-button>浏览</a-button>
            </div>
          </div>
        </template>

        <template v-else>
          <div>
            <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">WebDAV URL</label>
            <a-input
              v-model:value="localSettings.cloudSync.webdavUrl"
              placeholder="https://example.com/webdav/"
            />
          </div>
          <div>
            <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">用户名</label>
            <a-input
              v-model:value="localSettings.cloudSync.webdavUsername"
              placeholder="用户名"
            />
          </div>
          <div>
            <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">密码</label>
            <a-input-password
              v-model:value="localSettings.cloudSync.webdavPassword"
              placeholder="密码"
            />
          </div>
        </template>
      </div>
    </div>

    <div class="mb-6 pt-4 border-t border-[var(--border)]">
      <h3 class="text-sm font-medium text-[var(--foreground)] mb-3">数据管理</h3>
      <div class="flex flex-col gap-2">
        <a-button @click="emit('export-db')">导出数据库</a-button>
        <a-button @click="emit('import-db')">导入数据库</a-button>
      </div>
    </div>

    <div class="mb-6 pt-4 border-t border-[var(--border)]">
      <h3 class="text-sm font-medium text-[var(--destructive)] mb-3">危险操作</h3>
      <a-button danger block @click="confirmClearData">清空本地数据</a-button>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <a-button @click="onCancel">取消</a-button>
      <a-button type="primary" @click="onSave">保存</a-button>
    </div>
  </a-modal>
</template>
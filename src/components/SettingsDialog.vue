<script setup lang="ts">
import { ref, computed } from "vue";
import { X, Keyboard, Sun, Moon, Monitor } from "lucide-vue-next";
import {
  SwitchRoot,
  SwitchThumb,
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb,
  RadioGroupRoot,
  RadioGroupItem,
  RadioGroupIndicator,
} from "radix-vue";
import type { AppSettings } from "../types";

const props = defineProps<{
  settings: AppSettings;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", settings: AppSettings): void;
}>();

const localSettings = ref<AppSettings>(JSON.parse(JSON.stringify(props.settings)));
const recordingShortcut = ref(false);

const sliderValue = computed({
  get: () => [localSettings.value.longPressDuration],
  set: (val: number[]) => {
    localSettings.value.longPressDuration = val[0];
  },
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

function onRecordKeydown(e: KeyboardEvent) {
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

function onSave() {
  emit("save", JSON.parse(JSON.stringify(localSettings.value)));
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
    @click.self="$emit('close')"
    @keydown="onRecordKeydown"
  >
    <div
      class="bg-[var(--card)] rounded-xl shadow-2xl w-[400px] max-h-[80vh] overflow-y-auto p-6 text-[var(--foreground)]"
    >
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold">设置</h2>
        <button
          class="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          @click="$emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="mb-6">
        <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">主题模式</h3>
        <RadioGroupRoot
          v-model="localSettings.theme"
          class="flex flex-col gap-2"
        >
          <div class="flex items-center gap-2">
            <RadioGroupItem
              value="system"
              :id="'theme-system'"
              class="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--secondary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] flex items-center justify-center"
            >
              <RadioGroupIndicator
                class="w-2 h-2 rounded-full bg-[var(--primary-foreground)]"
              />
            </RadioGroupItem>
            <label :for="'theme-system'" class="text-sm cursor-pointer flex items-center gap-1.5">
              <Monitor :size="14" />
              跟随系统
            </label>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroupItem
              value="light"
              :id="'theme-light'"
              class="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--secondary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] flex items-center justify-center"
            >
              <RadioGroupIndicator
                class="w-2 h-2 rounded-full bg-[var(--primary-foreground)]"
              />
            </RadioGroupItem>
            <label :for="'theme-light'" class="text-sm cursor-pointer flex items-center gap-1.5">
              <Sun :size="14" />
              浅色模式
            </label>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroupItem
              value="dark"
              :id="'theme-dark'"
              class="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--secondary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] flex items-center justify-center"
            >
              <RadioGroupIndicator
                class="w-2 h-2 rounded-full bg-[var(--primary-foreground)]"
              />
            </RadioGroupItem>
            <label :for="'theme-dark'" class="text-sm cursor-pointer flex items-center gap-1.5">
              <Moon :size="14" />
              深色模式
            </label>
          </div>
        </RadioGroupRoot>
      </div>

      <div class="mb-6">
        <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">添加快捷键</h3>
        <button
          class="w-full flex items-center justify-between bg-[var(--secondary)] hover:bg-[var(--accent)] rounded-lg px-3 py-2.5 text-sm transition-colors border-2"
          :class="recordingShortcut ? 'border-[var(--primary)]' : 'border-transparent'"
          @click="startRecording"
        >
          <span class="flex items-center gap-2">
            <Keyboard :size="14" class="text-[var(--muted-foreground)]" />
            <span v-if="recordingShortcut" class="text-[var(--primary)]">请按下组合键...</span>
            <span v-else class="text-[var(--muted-foreground)]">新增待办快捷键</span>
          </span>
          <kbd class="bg-[var(--card)] px-2 py-0.5 rounded text-xs font-mono text-[var(--foreground)]">
            {{ shortcutDisplay }}
          </kbd>
        </button>
      </div>

      <div class="mb-6">
        <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">完成方式</h3>
        <RadioGroupRoot
          v-model="localSettings.completionMode"
          class="flex flex-col gap-2"
        >
          <div class="flex items-center gap-2">
            <RadioGroupItem
              value="checkbox"
              :id="'completion-checkbox'"
              class="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--secondary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] flex items-center justify-center"
            >
              <RadioGroupIndicator
                class="w-2 h-2 rounded-full bg-[var(--primary-foreground)]"
              />
            </RadioGroupItem>
            <label :for="'completion-checkbox'" class="text-sm cursor-pointer">勾选完成</label>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroupItem
              value="longpress"
              :id="'completion-longpress'"
              class="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--secondary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)] flex items-center justify-center"
            >
              <RadioGroupIndicator
                class="w-2 h-2 rounded-full bg-[var(--primary-foreground)]"
              />
            </RadioGroupItem>
            <label :for="'completion-longpress'" class="text-sm cursor-pointer">长按完成</label>
          </div>
        </RadioGroupRoot>

        <div v-if="localSettings.completionMode === 'longpress'" class="mt-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-[var(--muted-foreground)]">长按时长</span>
            <span class="text-xs font-medium">{{ localSettings.longPressDuration }} 秒</span>
          </div>
          <SliderRoot
            v-model="sliderValue"
            :min="1"
            :max="10"
            :step="1"
            class="relative flex items-center w-full h-5"
          >
            <SliderTrack class="relative w-full h-1.5 bg-[var(--secondary)] rounded-full">
              <SliderRange class="absolute h-full bg-[var(--primary)] rounded-full" />
            </SliderTrack>
            <SliderThumb
              class="block w-4 h-4 bg-[var(--primary)] rounded-full shadow cursor-pointer hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </SliderRoot>
        </div>
      </div>

      <div class="mb-6">
        <h3 class="text-sm font-medium text-[var(--muted-foreground)] mb-3">云同步</h3>
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm">启用云同步</span>
          <SwitchRoot
            v-model:checked="localSettings.cloudSync.enabled"
            class="w-10 h-5 bg-[var(--secondary)] rounded-full relative data-[state=checked]:bg-[var(--primary)] transition-colors cursor-pointer"
          >
            <SwitchThumb
              class="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]"
            />
          </SwitchRoot>
        </div>

        <div v-if="localSettings.cloudSync.enabled" class="flex flex-col gap-3">
          <div>
            <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">同步方式</label>
            <select
              v-model="localSettings.cloudSync.provider"
              class="w-full bg-[var(--secondary)] rounded-lg px-3 py-2 text-[var(--foreground)] text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="local_folder">本地文件夹</option>
              <option value="webdav">WebDAV</option>
            </select>
          </div>

          <template v-if="localSettings.cloudSync.provider === 'local_folder'">
            <div>
              <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">同步路径</label>
              <div class="flex gap-2">
                <input
                  v-model="localSettings.cloudSync.localSyncPath"
                  type="text"
                  placeholder="选择本地文件夹路径..."
                  class="flex-1 bg-[var(--secondary)] rounded-lg px-3 py-2 text-[var(--foreground)] text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <button
                  class="bg-[var(--secondary)] hover:bg-[var(--accent)] text-[var(--foreground)] px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  浏览
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div>
              <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">WebDAV URL</label>
              <input
                v-model="localSettings.cloudSync.webdavUrl"
                type="text"
                placeholder="https://example.com/webdav/"
                class="w-full bg-[var(--secondary)] rounded-lg px-3 py-2 text-[var(--foreground)] text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">用户名</label>
              <input
                v-model="localSettings.cloudSync.webdavUsername"
                type="text"
                placeholder="用户名"
                class="w-full bg-[var(--secondary)] rounded-lg px-3 py-2 text-[var(--foreground)] text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--muted-foreground)] block mb-1.5">密码</label>
              <input
                v-model="localSettings.cloudSync.webdavPassword"
                type="password"
                placeholder="密码"
                class="w-full bg-[var(--secondary)] rounded-lg px-3 py-2 text-[var(--foreground)] text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </template>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button
          class="bg-[var(--secondary)] text-[var(--foreground)] px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--accent)]"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          class="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm transition-colors hover:opacity-90"
          @click="onSave"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>
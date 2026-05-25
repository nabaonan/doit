<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Circle, CheckCircle2 } from "lucide-vue-next";
import dayjs from "dayjs";
import type { TodoItem, AppSettings } from "../types";

const props = defineProps<{
  todo: TodoItem;
  settings: AppSettings;
  isEditing: boolean;
  editContent: string;
}>();

const emit = defineEmits<{
  (e: "toggle-complete"): void;
  (e: "start-edit"): void;
  (e: "save-edit", content: string): void;
  (e: "cancel-edit"): void;
}>();

const editInput = ref<HTMLInputElement | null>(null);
const localEditContent = ref(props.editContent);
const isLongPressing = ref(false);
const longPressProgress = ref(0);
let longPressTimer: ReturnType<typeof setInterval> | null = null;
let longPressStartTime: number | null = null;

watch(
  () => props.isEditing,
  (val) => {
    if (val) {
      localEditContent.value = props.editContent;
      setTimeout(() => editInput.value?.focus(), 0);
    }
  }
);

const durationText = computed(() => {
  if (!props.todo.completed || !props.todo.completedAt) return "";
  const start = dayjs(props.todo.createdAt);
  const end = dayjs(props.todo.completedAt);
  const seconds = end.diff(start, "second");
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = end.diff(start, "minute");
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = end.diff(start, "hour");
  if (hours < 24) return `${hours} 小时`;
  const days = end.diff(start, "day");
  return `${days} 天`;
});

function onCheckboxClick() {
  emit("toggle-complete");
}

function onDblClick() {
  if (props.todo.completed) return;
  emit("start-edit");
}

function onSave() {
  const trimmed = localEditContent.value.trim();
  emit("save-edit", trimmed);
}

function onCancel() {
  emit("cancel-edit");
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    onSave();
  } else if (e.key === "Escape") {
    onCancel();
  }
}

function startLongPress() {
  if (props.settings.completionMode !== "longpress") return;
  isLongPressing.value = true;
  longPressProgress.value = 0;
  longPressStartTime = Date.now();
  const durationMs = props.settings.longPressDuration * 1000;

  longPressTimer = setInterval(() => {
    if (!longPressStartTime) return;
    const elapsed = Date.now() - longPressStartTime;
    const progress = Math.min((elapsed / durationMs) * 100, 100);
    longPressProgress.value = progress;
    if (progress >= 100) {
      stopLongPress();
      emit("toggle-complete");
    }
  }, 30);
}

function stopLongPress() {
  isLongPressing.value = false;
  longPressProgress.value = 0;
  longPressStartTime = null;
  if (longPressTimer) {
    clearInterval(longPressTimer);
    longPressTimer = null;
  }
}
</script>

<template>
  <div
    class="py-3 px-4 border-b border-[var(--border)] flex flex-col gap-1 cursor-pointer relative overflow-hidden select-none"
    :class="{ 'cursor-default': isEditing }"
    @dblclick="onDblClick"
    @mousedown="startLongPress"
    @mouseup="stopLongPress"
    @mouseleave="stopLongPress"
  >
    <div
      v-if="settings.completionMode === 'longpress' && isLongPressing"
      class="absolute bottom-0 left-0 h-[3px] bg-[var(--primary)] transition-[width] duration-30"
      :style="{ width: longPressProgress + '%' }"
    />

    <div v-if="isEditing" class="flex items-center gap-3">
      <input
        ref="editInput"
        v-model="localEditContent"
        class="flex-1 bg-transparent text-xl text-[var(--foreground)] border-b-2 border-[var(--primary)] outline-none py-1"
        @keydown="onKeydown"
        @blur="onCancel"
      />
    </div>

    <template v-else>
      <div class="flex items-center gap-3">
        <button
          v-if="settings.completionMode === 'checkbox'"
          class="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
          @click="onCheckboxClick"
        >
          <CheckCircle2 v-if="todo.completed" :size="24" class="text-[var(--primary)]" />
          <Circle v-else :size="24" />
        </button>

        <div class="flex-1 min-w-0">
          <p
            class="text-xl"
            :class="{
              'text-[var(--muted-foreground)] line-through': todo.completed,
              'text-[var(--foreground)]': !todo.completed,
            }"
          >
            {{ todo.content }}
          </p>
        </div>
      </div>

      <p
        v-if="todo.completed && durationText"
        class="text-xs text-[var(--muted-foreground)] ml-9"
      >
        完成耗时: {{ durationText }}
      </p>
    </template>
  </div>
</template>
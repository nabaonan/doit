<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Circle, CheckCircle2, Pencil, Trash2, Tag } from "@lucide/vue";
import dayjs from "dayjs";
import type { TodoItem as TodoItemType, AppSettings } from "../types";

const props = defineProps<{
  todo: TodoItemType;
  settings: AppSettings;
  isEditing: boolean;
  editContent: string;
}>();

const emit = defineEmits<{
  (e: "toggle-complete"): void;
  (e: "start-edit"): void;
  (e: "save-edit", content: string): void;
  (e: "cancel-edit"): void;
  (e: "delete-todo"): void;
  (e: "set-tag", tagId: string | null): void;
}>();

const editInput = ref<HTMLInputElement | null>(null);
const localEditContent = ref(props.editContent);
const isLongPressing = ref(false);
const longPressProgress = ref(0);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const showTagMenu = ref(false);

const currentTag = computed(() => {
  if (!props.todo.tagId) return null;
  return (props.settings.tags || []).find((t) => t.id === props.todo.tagId) || null;
});

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
  if (props.todo.completed) return;
  isLongPressing.value = true;
  const durationMs = props.settings.longPressDuration * 1000;

  requestAnimationFrame(() => {
    longPressProgress.value = 100;
  });

  longPressTimer = setTimeout(() => {
    stopLongPress();
    emit("toggle-complete");
  }, durationMs);
}

function stopLongPress() {
  if (!isLongPressing.value) return;
  isLongPressing.value = false;
  longPressProgress.value = 0;
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  showMenu.value = true;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
}

function closeMenu() {
  showMenu.value = false;
  showTagMenu.value = false;
}

function onMenuEdit() {
  closeMenu();
  if (props.todo.completed) return;
  emit("start-edit");
}

function onMenuDelete() {
  closeMenu();
  emit("delete-todo");
}

function onMenuTag() {
  showTagMenu.value = !showTagMenu.value;
}

function onSelectTag(tagId: string | null) {
  emit("set-tag", tagId);
  closeMenu();
}

function onDocumentClick() {
  closeMenu();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <div
    class="py-3 px-4 border-b border-[var(--border)] cursor-pointer relative overflow-hidden select-none"
    :class="{ 'cursor-default': isEditing }"
    @dblclick="onDblClick"
    @mousedown="startLongPress"
    @mouseup="stopLongPress"
    @mouseleave="stopLongPress"
    @contextmenu.prevent="onContextMenu"
  >
    <div
      v-if="settings.completionMode === 'longpress' && isLongPressing"
      class="absolute inset-0 overflow-hidden"
    >
      <div
        class="h-full bg-emerald-400/25"
        :style="{
          width: longPressProgress + '%',
          transition: longPressProgress > 0 ? `width ${props.settings.longPressDuration}s linear` : 'none'
        }"
      />
    </div>

    <div v-if="isEditing" class="flex items-center gap-3 relative z-10">
      <input
        ref="editInput"
        v-model="localEditContent"
        class="flex-1 bg-transparent text-xl text-[var(--foreground)] border-b-2 border-[var(--primary)] outline-none py-1"
        @keydown="onKeydown"
        @blur="onCancel"
      />
    </div>

    <template v-else>
      <div class="flex items-center gap-3 relative z-10">
        <button
          v-if="settings.completionMode === 'checkbox'"
          class="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
          @mousedown.stop
          @click.stop="onCheckboxClick"
        >
          <CheckCircle2 v-if="todo.completed" :size="24" class="text-[var(--primary)]" />
          <Circle v-else :size="24" />
        </button>

        <div class="flex-1 min-w-0">
          <p
            class="text-xl truncate"
            :class="{
              'text-[var(--muted-foreground)] line-through': todo.completed,
              'text-[var(--foreground)]': !todo.completed,
            }"
          >
            {{ todo.content }}
          </p>
        </div>

        <span
          v-if="currentTag"
          class="shrink-0 text-xs px-2 py-0.5 rounded font-medium truncate max-w-[80px]"
          :style="{ backgroundColor: currentTag.color, color: '#fff' }"
        >
          {{ currentTag.name }}
        </span>

        <span
          v-if="todo.completed && durationText"
          class="shrink-0 text-xs text-[var(--muted-foreground)]"
        >
          {{ durationText }}
        </span>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="showMenu"
        class="fixed z-[9999] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[120px]"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
      >
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': todo.completed }"
          :disabled="todo.completed"
          @click="onMenuEdit"
        >
          <Pencil :size="14" />
          编辑
        </button>
        <div class="relative">
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            @click="onMenuTag"
          >
            <Tag :size="14" />
            设置标签
          </button>
          <div
            v-if="showTagMenu"
            class="absolute left-full top-0 ml-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[140px]"
          >
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
              @click="onSelectTag(null)"
            >
              <span class="inline-block w-2.5 h-2.5 rounded-full border border-[var(--border)] shrink-0" />
              无标签
            </button>
            <button
              v-for="tag in settings.tags"
              :key="tag.id"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
              @click="onSelectTag(tag.id)"
            >
              <span
                class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: tag.color }"
              />
              {{ tag.name }}
            </button>
          </div>
        </div>
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--destructive)] hover:bg-[var(--accent)] transition-colors"
          @click="onMenuDelete"
        >
          <Trash2 :size="14" />
          删除
        </button>
      </div>
    </Teleport>
  </div>
</template>
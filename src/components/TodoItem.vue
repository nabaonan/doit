<script setup lang="ts">
import { ref, computed, watch, h, nextTick, onUnmounted } from "vue";
import { EditOutlined, DeleteOutlined, TagOutlined, PlusOutlined, FolderOutlined, ClockCircleOutlined, CheckCircleFilled, CaretRightOutlined } from "@antdv-next/icons";
import type { MenuItemType } from "antdv-next";
import dayjs from "dayjs";
import type { TodoItem as TodoItemType, AppSettings } from "../types";

const props = defineProps<{
  todo: TodoItemType;
  settings: AppSettings;
  isEditing: boolean;
  editContent: string;
  readonly?: boolean;
  hasChildren?: boolean;
  isSubTask?: boolean;
  depth?: number;
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-complete"): void;
  (e: "start-edit"): void;
  (e: "save-edit", content: string): void;
  (e: "cancel-edit"): void;
  (e: "delete-todo"): void;
  (e: "set-tag", tagId: string | null): void;
  (e: "set-cat", catId: string | null): void;
  (e: "add-sub-todo", content: string): void;
  (e: "set-reminder"): void;
  (e: "cancel-reminder"): void;
  (e: "toggle-collapse"): void;
}>();

const editInput = ref<HTMLInputElement | null>(null);
const localEditContent = ref(props.editContent);
const isLongPressing = ref(false);
const longPressProgress = ref(0);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.isEditing,
  async (val) => {
    if (val) {
      localEditContent.value = props.editContent;
      await nextTick();
      requestAnimationFrame(() => {
        editInput.value?.focus();
      });
    }
  },
  { immediate: true }
);

const currentTag = computed(() => {
  if (!props.todo.tagId) return null;
  return (props.settings.tags || []).find((t) => t.id === props.todo.tagId) || null;
});

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

const countdownTick = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const countdownText = computed(() => {
  countdownTick.value
  if (!props.todo.remindAt || props.todo.completed) return ""
  const diff = dayjs(props.todo.remindAt).diff(dayjs(), "second")
  if (diff <= 0) return ""
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  if (hours > 0) {
    return `还剩 ${hours}小时${minutes}分钟`
  }
  if (minutes > 0) {
    return `还剩 ${minutes}分钟`
  }
  return `还剩 ${diff}秒`
})

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown() {
  stopCountdown()
  const diff = dayjs(props.todo.remindAt).diff(dayjs(), "second")
  if (!props.todo.remindAt || props.todo.completed || diff <= 0) return
  countdownTick.value++
  const interval = diff > 60 ? 60_000 : 1_000
  countdownTimer = setInterval(() => {
    const remaining = dayjs(props.todo.remindAt!).diff(dayjs(), "second")
    if (remaining <= 0) {
      stopCountdown()
      return
    }
    countdownTick.value++
    if (remaining <= 60 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = setInterval(() => {
        countdownTick.value++
      }, 1_000)
    }
  }, interval)
}

watch(() => props.todo.remindAt, startCountdown, { immediate: true })
watch(() => props.todo.completed, (val) => {
  if (val) stopCountdown()
})

onUnmounted(stopCountdown)

const tagMenuChildren = computed(() => {
  const tags = props.settings.tags || [];
  if (tags.length === 0) {
    return [
      {
        key: "tag-placeholder",
        label: "暂无标签",
        disabled: true,
        icon: h("span", {
          class: "inline-block w-2.5 h-2.5 rounded-full border border-[var(--border)] shrink-0",
        }),
      },
    ];
  }
  const items: MenuItemType[] = [];
  for (const tag of tags) {
    items.push({
      key: `tag-${tag.id}`,
      label: tag.name,
      icon: h("span", {
        class: "inline-block w-2.5 h-2.5 rounded-full shrink-0",
        style: { backgroundColor: tag.color },
      }),
    });
  }
  return items;
});

const catMenuChildren = computed(() => {
  const cats = props.settings.categories || [];
  if (cats.length === 0) {
    return [
      {
        key: "cat-placeholder",
        label: "暂无分类",
        disabled: true,
        icon: h("span", {
          class: "inline-block w-2.5 h-2.5 rounded-full border border-[var(--border)] shrink-0",
        }),
      },
    ];
  }
  const items: MenuItemType[] = [
    {
      key: "cat-null",
      label: "不分类",
    },
    { type: "divider" },
  ];
  for (const cat of cats) {
    items.push({
      key: `cat-${cat.id}`,
      label: cat.name,
      icon: h("span", {
        class: "inline-block w-2.5 h-2.5 rounded-full shrink-0",
        style: { backgroundColor: cat.color },
      }),
    });
  }
  return items;
});

const menuItems = computed<MenuItemType[]>(() => {
  const items: MenuItemType[] = [
    {
      key: "edit",
      label: "编辑",
      icon: h(EditOutlined),
      disabled: props.todo.completed,
    },
    {
      key: "tag",
      label: "设置标签",
      icon: h(TagOutlined),
      children: tagMenuChildren.value,
    },
    {
      key: "cat",
      label: "移动到分类",
      icon: h(FolderOutlined),
      disabled: !!props.isSubTask,
      children: catMenuChildren.value,
    },
  ];
  items.push({
    key: "subtask",
    label: "子任务",
    icon: h(PlusOutlined),
    disabled: props.todo.completed,
  });
  items.push({
    key: "reminder",
    label: "定时提醒",
    icon: h(ClockCircleOutlined),
  });
  items.push({ type: "divider" });
  items.push({
    key: "delete",
    label: "删除",
    icon: h(DeleteOutlined),
    danger: true,
  });
  return items;
});

function onMenuClick({ key }: { key: string }) {
  if (key === "edit") {
    if (props.todo.completed) return;
    emit("start-edit");
  } else if (key === "delete") {
    emit("delete-todo");
  } else if (key === "subtask") {
    if (props.todo.completed) return;
    emit("add-sub-todo", "");
  } else if (key === "tag-null") {
    emit("set-tag", null);
  } else if (key.startsWith("tag-")) {
    emit("set-tag", key.replace("tag-", ""));
  } else if (key === "cat-null") {
    emit("set-cat", null);
  } else if (key.startsWith("cat-")) {
    emit("set-cat", key.replace("cat-", ""));
  } else if (key === "reminder") {
    emit("set-reminder");
  }
}

function onCheckboxClick() {
  if (props.hasChildren) return;
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
  const sc = props.settings.addTodoShortcut;
  if (!sc) {
    if (e.key === "Enter") onSave();
    return;
  }
  if (
    e.key === sc.key &&
    e.ctrlKey === sc.ctrl &&
    e.shiftKey === sc.shift &&
    e.altKey === sc.alt &&
    e.metaKey === sc.meta
  ) {
    e.preventDefault();
    onSave();
    return;
  }
  if (e.key === "Escape") {
    onCancel();
  }
}

function startLongPress(e: MouseEvent) {
  if (props.settings.completionMode !== "longpress") return;
  if (props.todo.completed) return;
  if (props.hasChildren) return;
  const target = e.target as HTMLElement;
  if (target.closest(".todo-checkbox")) return;
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
</script>

<template>
  <a-dropdown
    v-if="!readonly"
    :menu="{ items: menuItems, onClick: onMenuClick }"
    :trigger="['contextmenu']"
  >
    <div
      class="py-3 px-4 border-b border-[var(--border)] cursor-pointer relative overflow-hidden select-none flex items-center gap-3"
      :class="{
        'cursor-default': isEditing,
      }"
      :style="(depth ?? 0) > 0 ? { paddingLeft: `${24 + (depth ?? 0) * 20}px` } : undefined"
      @dblclick="onDblClick"
      @mousedown="(e) => startLongPress(e)"
      @mouseup="stopLongPress"
      @mouseleave="stopLongPress"
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

      <div v-if="isEditing" class="flex items-center gap-3 relative z-10 w-full flex-1">
        <a-input
          ref="editInput"
          v-model:value="localEditContent"
          variant="underlined"
          size="large"
          class="flex-1"
          @keydown="onKeydown"
          @blur="onSave"
        />
      </div>

      <template v-else>
        <div class="flex items-center gap-3 relative z-10 w-full">
          <a-config-provider
            v-if="settings.completionMode === 'checkbox'"
            :theme="{
              token: {
                colorPrimary: props.hasChildren
                  ? 'var(--muted-foreground)'
                  : props.todo.completed
                    ? '#22c55e'
                    : undefined,
              },
            }"
          >
            <a-tag
              class="shrink-0 !inline-flex items-center justify-center !border-none !px-0 !py-0"
              :class="{
                'hover:!bg-transparent !bg-transparent cursor-pointer': !hasChildren,
                '!bg-transparent opacity-40 cursor-not-allowed': hasChildren,
              }"
              @click.prevent="onCheckboxClick"
            >
              <CheckCircleFilled
                v-if="todo.completed"
                style="font-size: 22px;"
                :style="{ color: hasChildren ? 'var(--muted-foreground)' : '#22c55e' }"
              />
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-[22px] h-[22px]">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </a-tag>
          </a-config-provider>

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

          <a-tag
            v-if="currentTag"
            :color="currentTag.color"
            variant="solid"
            class="shrink-0 max-w-[80px] truncate"
          >
            {{ currentTag.name }}
          </a-tag>

          <span
            v-if="countdownText"
            class="shrink-0 flex items-center gap-1 text-xs text-orange-500"
          >
            <ClockCircleOutlined :style="{ fontSize: '12px' }" />
            {{ countdownText }}
          </span>

          <span
            v-if="todo.completed && durationText"
            class="shrink-0 text-xs text-[var(--muted-foreground)]"
          >
            {{ durationText }}
          </span>

          <button
            v-if="hasChildren"
            type="button"
            class="shrink-0 w-5 h-5 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-transform duration-200"
            :class="{ 'rotate-90': !collapsed }"
            @click.stop="emit('toggle-collapse')"
            @mousedown.stop
          >
            <CaretRightOutlined :style="{ fontSize: '14px' }" />
          </button>
        </div>
      </template>
    </div>
  </a-dropdown>

  <div
    v-if="readonly"
    :class="{
       'py-3 px-4 border-b border-[var(--border)] relative select-none': true,
     }"
     :style="(depth ?? 0) > 0 ? { paddingLeft: `${24 + (depth ?? 0) * 20}px` } : undefined"
  >
    <div class="flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-xl truncate text-[var(--muted-foreground)] line-through">
          {{ todo.content }}
        </p>
      </div>

      <a-tag
        v-if="currentTag"
        :color="currentTag.color"
        variant="solid"
        class="shrink-0 max-w-[80px] truncate"
      >
        {{ currentTag.name }}
      </a-tag>

      <span
        v-if="todo.completed && durationText"
        class="shrink-0 text-xs text-[var(--muted-foreground)]"
      >
        {{ durationText }}
      </span>
    </div>
  </div>
</template>
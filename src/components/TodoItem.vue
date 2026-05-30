<script setup lang="ts">
import { ref, computed, watch, h } from "vue";
import { EditOutlined, DeleteOutlined, TagOutlined } from "@antdv-next/icons";
import type { MenuItemType } from "antdv-next";
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

watch(
  () => props.isEditing,
  (val) => {
    if (val) {
      localEditContent.value = props.editContent;
      setTimeout(() => editInput.value?.focus(), 0);
    }
  }
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

const tagMenuChildren = computed(() => {
  const items: MenuItemType[] = [
    {
      key: "tag-null",
      label: "无标签",
      icon: h("span", {
        class: "inline-block w-2.5 h-2.5 rounded-full border border-[var(--border)] shrink-0",
      }),
    },
  ];
  for (const tag of (props.settings.tags || [])) {
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

const menuItems = computed<MenuItemType[]>(() => [
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
  { type: "divider" },
  {
    key: "delete",
    label: "删除",
    icon: h(DeleteOutlined),
    danger: true,
  },
]);

function onMenuClick({ key }: { key: string }) {
  if (key === "edit") {
    if (props.todo.completed) return;
    emit("start-edit");
  } else if (key === "delete") {
    emit("delete-todo");
  } else if (key === "tag-null") {
    emit("set-tag", null);
  } else if (key.startsWith("tag-")) {
    emit("set-tag", key.replace("tag-", ""));
  }
}

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
</script>

<template>
  <a-dropdown
    :menu="{ items: menuItems, onClick: onMenuClick }"
    :trigger="['contextmenu']"
  >
    <div
      class="py-3 px-4 border-b border-[var(--border)] cursor-pointer relative overflow-hidden select-none"
      :class="{ 'cursor-default': isEditing }"
      @dblclick="onDblClick"
      @mousedown="startLongPress"
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

      <div v-if="isEditing" class="flex items-center gap-3 relative z-10">
        <a-input
          ref="editInput"
          v-model:value="localEditContent"
          variant="underlined"
          size="large"
          class="flex-1"
          @keydown="onKeydown"
          @blur="onCancel"
        />
      </div>

      <template v-else>
        <div class="flex items-center gap-3 relative z-10">
          <a-checkbox
            v-if="settings.completionMode === 'checkbox'"
            :checked="todo.completed"
            class="shrink-0"
            @mousedown.stop
            @change="onCheckboxClick"
          />

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
            v-if="todo.completed && durationText"
            class="shrink-0 text-xs text-[var(--muted-foreground)]"
          >
            {{ durationText }}
          </span>
        </div>
      </template>
    </div>
  </a-dropdown>
</template>
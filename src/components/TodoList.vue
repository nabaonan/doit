<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import draggable from "vuedraggable";
import TodoItem from "./TodoItem.vue";
import type { TodoItem as TodoItemType, AppSettings } from "../types";

const props = defineProps<{
  todos: TodoItemType[];
  settings: AppSettings;
}>();

const emit = defineEmits<{
  (e: "add-todo", content: string): void;
  (e: "update-todo", id: string, content: string): void;
  (e: "toggle-complete", id: string): void;
  (e: "reorder", ids: string[], parentIds?: Record<string, string | null>): void;
  (e: "delete-todo", id: string): void;
  (e: "set-tag", id: string, tagId: string | null): void;
  (e: "add-sub-todo", parentId: string, content: string): void;
}>();

const newTodoInput = ref("");
const editingId = ref<string | null>(null);
const editContent = ref("");
const isDragging = ref(false);

const draggableList = ref<TodoItemType[]>([]);
const listContainerRef = ref<HTMLElement | null>(null);

watch(
  () => props.todos,
  async (todos) => {
    if (isDragging.value) return;

    const container = listContainerRef.value;
    const oldTops = new Map<string, number>();

    if (container) {
      container.querySelectorAll("[data-todo-id]").forEach((el) => {
        const id = (el as HTMLElement).dataset.todoId;
        if (id) oldTops.set(id, el.getBoundingClientRect().top);
      });
    }

    draggableList.value = [...todos];

    await nextTick();

    if (container) {
      container.querySelectorAll("[data-todo-id]").forEach((el) => {
        const id = (el as HTMLElement).dataset.todoId;
        if (!id) return;
        const oldTop = oldTops.get(id);
        if (oldTop === undefined) return;
        const newTop = el.getBoundingClientRect().top;
        const delta = oldTop - newTop;
        if (Math.abs(delta) < 0.5) return;

        const htmlEl = el as HTMLElement;
        htmlEl.style.transition = "none";
        htmlEl.style.transform = `translateY(${delta}px)`;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            htmlEl.style.transition = "transform 0.3s ease";
            htmlEl.style.transform = "";
          });
        });
      });
    }
  },
  { deep: true, immediate: true }
);

let prevTodoIds = new Set<string>();

watch(
  () => props.todos,
  (todos) => {
    for (const t of todos) {
      if (t.parentId && t.content === "" && !prevTodoIds.has(t.id)) {
        editingId.value = t.id;
        editContent.value = "";
        break;
      }
    }
    prevTodoIds = new Set(todos.map((t) => t.id));
  },
  { immediate: true }
);

function onDragStart() {
  isDragging.value = true;
}

function onDragEnd() {
  isDragging.value = false;

  const parentIdChanges: Record<string, string | null> = {};
  let currentParentId: string | null = null;

  for (const item of draggableList.value) {
    if (!item.parentId) {
      currentParentId = item.id;
    } else {
      if (item.parentId !== currentParentId) {
        parentIdChanges[item.id] = currentParentId;
      }
    }
  }

  const ids = draggableList.value.map((t) => t.id);
  const hasChanges = Object.keys(parentIdChanges).length > 0;
  emit("reorder", ids, hasChanges ? parentIdChanges : undefined);
}

function onAddTodo() {
  const trimmed = newTodoInput.value.trim();
  if (!trimmed) return;

  const hasEmptyTodo = props.todos.some((t) => t.content.trim() === "");
  if (hasEmptyTodo) return;

  newTodoInput.value = "";
  emit("add-todo", trimmed);
}

function onInputKeydown(e: KeyboardEvent) {
  const sc = props.settings.addTodoShortcut;
  if (!sc) {
    if (e.key === "Enter") onAddTodo();
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
    onAddTodo();
  }
}

function startEdit(todo: TodoItemType) {
  editingId.value = todo.id;
  editContent.value = todo.content;
}

function saveEdit(content: string) {
  const id = editingId.value;
  if (!id) return;
  if (content.trim() === "") {
    emit("delete-todo", id);
  } else {
    emit("update-todo", id, content);
  }
  editingId.value = null;
  editContent.value = "";
}

function cancelEdit() {
  editingId.value = null;
  editContent.value = "";
}

function onToggleComplete(id: string) {
  emit("toggle-complete", id);
}

function onSetTag(id: string, tagId: string | null) {
  emit("set-tag", id, tagId);
}

function onAddSubTodo(parentId: string, content: string) {
  emit("add-sub-todo", parentId, content);
}
</script>

<template>
  <div class="flex-1 overflow-y-auto flex flex-col">
    <div class="px-4 pt-4 pb-2">
      <a-input
        v-model:value="newTodoInput"
        variant="borderless"
        size="large"
        class="text-xl"
        placeholder="输入新待办事项..."
        @keydown="onInputKeydown"
      />
    </div>

    <div ref="listContainerRef" class="flex flex-col">
      <draggable
        :list="draggableList"
        item-key="id"
        :animation="200"
        ghost-class="opacity-50"
        :force-fallback="true"
        @start="onDragStart"
        @end="onDragEnd"
      >
      <template #item="{ element }">
        <div :data-todo-id="element.id">
          <TodoItem
            :key="element.id"
            :todo="element"
            :settings="settings"
            :is-editing="editingId === element.id"
            :edit-content="editContent"
            :has-children="props.todos.some(t => t.parentId === element.id)"
            :is-sub-task="!!element.parentId"
            @toggle-complete="onToggleComplete(element.id)"
            @start-edit="startEdit(element)"
            @save-edit="(content: string) => saveEdit(content)"
            @cancel-edit="cancelEdit"
            @delete-todo="emit('delete-todo', element.id)"
            @set-tag="(tagId: string | null) => onSetTag(element.id, tagId)"
            @add-sub-todo="(content: string) => onAddSubTodo(element.id, content)"
          />
        </div>
      </template>
    </draggable>
    </div>

    <a-empty
      v-if="todos.length === 0"
      description="暂无待办事项"
      class="flex-1 flex items-center justify-center"
    />
  </div>
</template>
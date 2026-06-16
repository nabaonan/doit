<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import NestedTodoList from "./NestedTodoList.vue";
import type { TodoItem as TodoItemType, TodoItemNode, AppSettings } from "../types";
import { flatToNested, nestedToFlat } from "../types";

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
  (e: "set-cat", id: string, catId: string | null): void;
  (e: "add-sub-todo", parentId: string, content: string): void;
}>();

const newTodoInput = ref("");
const editingId = ref<string | null>(null);
const editContent = ref("");

const nestedTodos = ref<TodoItemNode[]>([]);
let isProgrammaticUpdate = false;

function mergeNested(existing: TodoItemNode[], incoming: TodoItemNode[]) {
  const existingMap = new Map<string, TodoItemNode>();
  function collect(list: TodoItemNode[]) {
    for (const node of list) {
      existingMap.set(node.id, node);
      if (node.children.length > 0) collect(node.children);
    }
  }
  collect(existing);

  function merge(list: TodoItemNode[], incList: TodoItemNode[]) {
    list.length = 0;
    for (const inc of incList) {
      const existingNode = existingMap.get(inc.id);
      if (existingNode) {
        existingNode.content = inc.content;
        existingNode.completed = inc.completed;
        existingNode.completedAt = inc.completedAt;
        existingNode.order = inc.order;
        existingNode.tagId = inc.tagId;
        existingNode.parentId = inc.parentId;
        merge(existingNode.children, inc.children);
        list.push(existingNode);
        existingMap.delete(inc.id);
      } else {
        list.push(inc);
      }
    }
  }
  merge(existing, incoming);
}

let flipCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cleanupFlipTransform(el: HTMLElement, id: string) {
  el.style.transform = "";
  el.style.transition = "";
  flipCleanupTimers.delete(id);
}

watch(
  () => props.todos,
  (todos) => {
    const items = document.querySelectorAll<HTMLElement>("[data-todo-id]");
    const prevRects = new Map<string, DOMRect>();
    items.forEach((el) => {
      const id = el.getAttribute("data-todo-id");
      if (id) prevRects.set(id, el.getBoundingClientRect());
    });

    isProgrammaticUpdate = true;
    mergeNested(nestedTodos.value, flatToNested(todos));
    nextTick(() => {
      isProgrammaticUpdate = false;
      requestAnimationFrame(() => {
        const newItems = document.querySelectorAll<HTMLElement>("[data-todo-id]");
        newItems.forEach((el) => {
          const id = el.getAttribute("data-todo-id");
          if (!id) return;

          const existingTimer = flipCleanupTimers.get(id);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const prev = prevRects.get(id);
          if (!prev) return;
          const curr = el.getBoundingClientRect();
          const dx = prev.left - curr.left;
          const dy = prev.top - curr.top;
          if (dx === 0 && dy === 0) return;
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = "none";
          requestAnimationFrame(() => {
            el.style.transition = "transform 300ms ease";
            el.style.transform = "";
          });
          flipCleanupTimers.set(id, setTimeout(() => cleanupFlipTransform(el, id), 350));
        });
      });
    });
  },
  { deep: true, immediate: true }
);

watch(
  nestedTodos,
  () => {
    if (isProgrammaticUpdate) return;
    const flat = nestedToFlat(nestedTodos.value);
    const ids = flat.map((t) => t.id);
    const parentIdChanges: Record<string, string | null> = {};
    for (const item of flat) {
      const original = props.todos.find((t) => t.id === item.id);
      if (original && original.parentId !== item.parentId) {
        parentIdChanges[item.id] = item.parentId;
      }
    }
    const hasChanges = Object.keys(parentIdChanges).length > 0;
    emit("reorder", ids, hasChanges ? parentIdChanges : undefined);
  },
  { deep: true }
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

function onSetCat(id: string, catId: string | null) {
  emit("set-cat", id, catId);
}

function onAddSubTodo(parentId: string, content: string) {
  emit("add-sub-todo", parentId, content);
}

function onDeleteTodo(id: string) {
  emit("delete-todo", id);
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

    <div class="flex flex-col">
      <NestedTodoList
        v-model="nestedTodos"
        :settings="settings"
        :editing-id="editingId"
        :edit-content="editContent"
        :toggle-complete="onToggleComplete"
        :start-edit="startEdit"
        :save-edit="saveEdit"
        :cancel-edit="cancelEdit"
        :delete-todo="onDeleteTodo"
        :set-tag="onSetTag"
        :set-cat="onSetCat"
        :add-sub-todo="onAddSubTodo"
      />
    </div>

    <a-empty
      v-if="todos.length === 0"
      description="暂无待办事项"
      class="flex-1 flex items-center justify-center"
    />
  </div>
</template>
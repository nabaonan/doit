<script setup lang="ts">
import { ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import TodoItem from "./TodoItem.vue";
import type { TodoItem as TodoItemType, AppSettings } from "../types";

const props = defineProps<{
  todos: TodoItemType[];
  settings: AppSettings;
}>();

const emit = defineEmits<{
  (e: "add-todo"): void;
  (e: "update-todo", id: string, content: string): void;
  (e: "toggle-complete", id: string): void;
  (e: "reorder", ids: string[]): void;
  (e: "delete-todo", id: string): void;
}>();

const newTodoInput = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const editingId = ref<string | null>(null);
const editContent = ref("");

const activeTodos = computed(() =>
  props.todos.filter((t) => !t.completed)
);

const completedTodos = computed(() =>
  props.todos.filter((t) => t.completed)
);

const draggableList = ref<TodoItemType[]>([...activeTodos.value]);

watch(
  () => props.todos,
  () => {
    const active = props.todos.filter((t) => !t.completed);
    const currentIds = draggableList.value.map((t) => t.id);
    const activeIds = active.map((t) => t.id);

    if (
      activeIds.length !== currentIds.length ||
      !activeIds.every((id, i) => id === currentIds[i])
    ) {
      const reordered = activeIds.every((id) => currentIds.includes(id));
      if (!reordered) {
        draggableList.value = [...active];
      }
    }
  },
  { deep: true }
);

function handleDragChange() {
  const reorderedActiveIds = draggableList.value.map((t) => t.id);
  const completedIds = completedTodos.value.map((t) => t.id);
  emit("reorder", [...reorderedActiveIds, ...completedIds]);
}

function onAddTodo() {
  const trimmed = newTodoInput.value.trim();
  if (!trimmed) return;

  const hasEmptyTodo = props.todos.some((t) => t.content.trim() === "");
  if (hasEmptyTodo) return;

  newTodoInput.value = "";
  emit("add-todo");
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
</script>

<template>
  <div class="flex-1 overflow-y-auto flex flex-col">
    <div class="px-4 pt-4 pb-2">
      <input
        ref="inputRef"
        v-model="newTodoInput"
        type="text"
        class="w-full bg-transparent text-xl text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none py-2"
        :placeholder="'输入新待办事项... 按回车新增'"
        @keydown.enter="onAddTodo"
      />
    </div>

    <draggable
      v-model="draggableList"
      item-key="id"
      class="flex flex-col"
      :animation="200"
      ghost-class="opacity-50"
      @change="handleDragChange"
    >
      <template #item="{ element }">
        <div>
          <TodoItem
            :key="element.id"
            :todo="element"
            :settings="settings"
            :is-editing="editingId === element.id"
            :edit-content="editContent"
            @toggle-complete="onToggleComplete(element.id)"
            @start-edit="startEdit(element)"
            @save-edit="(content: string) => saveEdit(content)"
            @cancel-edit="cancelEdit"
          />
        </div>
      </template>
    </draggable>

    <div
      v-if="completedTodos.length > 0"
      class="border-t-2 border-[var(--border)] mt-2"
    >
      <p class="px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
        已完成 ({{ completedTodos.length }})
      </p>
      <TodoItem
        v-for="todo in completedTodos"
        :key="todo.id"
        :todo="todo"
        :settings="settings"
        :is-editing="editingId === todo.id"
        :edit-content="editContent"
        @toggle-complete="onToggleComplete(todo.id)"
        @start-edit="startEdit(todo)"
        @save-edit="(content: string) => saveEdit(content)"
        @cancel-edit="cancelEdit"
      />
    </div>

    <div
      v-if="todos.length === 0"
      class="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-sm"
    >
      暂无待办事项
    </div>
  </div>
</template>
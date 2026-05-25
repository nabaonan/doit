<script setup lang="ts">
import { ref, onMounted, provide } from "vue";
import TitleBar from "./components/TitleBar.vue";
import TodoList from "./components/TodoList.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import ReportDialog from "./components/ReportDialog.vue";
import type { TodoItem, AppSettings } from "./types";
import { init as initTodos, getAllTodos, addTodo, updateTodo, deleteTodo, reorderTodos } from "./services/todoService";
import { init as initSettings, getSettings, saveSettings } from "./services/settingsService";

const todos = ref<TodoItem[]>([]);
const settings = ref<AppSettings>({
  completionMode: "longpress",
  longPressDuration: 3,
  cloudSync: {
    enabled: false,
    provider: "local_folder",
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    localSyncPath: "",
  },
});
const showSettings = ref(false);
const showReport = ref(false);

provide("settings", settings);

onMounted(async () => {
  await initTodos();
  await initSettings();
  todos.value = await getAllTodos();
  settings.value = await getSettings();
});

async function handleAddTodo() {
  const newTodo: TodoItem = {
    id: crypto.randomUUID(),
    content: "",
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: todos.value.length,
  };
  await addTodo(newTodo);
  todos.value = await getAllTodos();
}

async function handleUpdateTodo(id: string, content: string) {
  await updateTodo(id, { content });
  todos.value = await getAllTodos();
}

async function handleToggleComplete(id: string) {
  const todo = todos.value.find((t) => t.id === id);
  if (!todo) return;
  await updateTodo(id, {
    completed: !todo.completed,
    completedAt: !todo.completed ? new Date().toISOString() : null,
  });
  todos.value = await getAllTodos();
}

async function handleReorder(newOrder: string[]) {
  await reorderTodos(newOrder);
  todos.value = await getAllTodos();
}

async function handleDeleteTodo(id: string) {
  await deleteTodo(id);
  todos.value = await getAllTodos();
}

async function handleSaveSettings(newSettings: AppSettings) {
  await saveSettings(newSettings);
  settings.value = newSettings;
  showSettings.value = false;
}
</script>

<template>
  <div class="flex flex-col h-full bg-[var(--background)]">
    <TitleBar @open-settings="showSettings = true" @open-report="showReport = true" />
    <TodoList
      :todos="todos"
      :settings="settings"
      @add-todo="handleAddTodo"
      @update-todo="handleUpdateTodo"
      @toggle-complete="handleToggleComplete"
      @reorder="handleReorder"
      @delete-todo="handleDeleteTodo"
    />
    <SettingsDialog
      v-if="showSettings"
      :settings="settings"
      @save="handleSaveSettings"
      @close="showSettings = false"
    />
    <ReportDialog
      v-if="showReport"
      :todos="todos"
      @close="showReport = false"
    />
  </div>
</template>
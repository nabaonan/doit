<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, provide } from "vue";
import { theme as antTheme } from "antdv-next";
import { HappyProvider } from "@antdv-next/happy-work-theme";
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
  theme: "system",
  happyMode: false,
  addTodoShortcut: {
    key: "Enter",
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  },
  tags: [],
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

const currentAlgorithm = ref(antTheme.defaultAlgorithm);

function applyTheme(theme: "system" | "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    currentAlgorithm.value = antTheme.darkAlgorithm;
  } else if (theme === "light") {
    root.classList.remove("dark");
    currentAlgorithm.value = antTheme.defaultAlgorithm;
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    currentAlgorithm.value = prefersDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
  }
}

let systemThemeQuery: MediaQueryList | null = null;

function watchSystemTheme() {
  systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (settings.value.theme === "system") {
      const prefersDark = systemThemeQuery!.matches;
      document.documentElement.classList.toggle("dark", prefersDark);
      currentAlgorithm.value = prefersDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
    }
  };
  systemThemeQuery.addEventListener("change", handler);
}

onMounted(async () => {
  await initTodos();
  await initSettings();
  todos.value = await getAllTodos();
  settings.value = await getSettings();
  applyTheme(settings.value.theme);
  watchSystemTheme();
});

onUnmounted(() => {
  if (systemThemeQuery) {
    systemThemeQuery.removeEventListener("change", () => {});
  }
});

watch(() => settings.value.theme, (newTheme) => {
  applyTheme(newTheme);
});

async function handleAddTodo(content: string) {
  const newTodo: TodoItem = {
    id: crypto.randomUUID(),
    content,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: todos.value.length,
    tagId: null,
  };
  await addTodo(newTodo);
  todos.value = await getAllTodos();
}

async function handleUpdateTodo(id: string, content: string) {
  await updateTodo(id, { content });
  todos.value = await getAllTodos();
}

async function handleSetTag(id: string, tagId: string | null) {
  await updateTodo(id, { tagId });
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
  <HappyProvider :enabled="settings.happyMode" v-slot="{ wave }">
    <a-config-provider :theme="{ algorithm: currentAlgorithm }" :wave="wave">
      <a-app>
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
            @set-tag="handleSetTag"
          />
          <SettingsDialog
            v-model:open="showSettings"
            :settings="settings"
            @save="handleSaveSettings"
          />
          <ReportDialog
            v-model:open="showReport"
            :todos="todos"
          />
        </div>
      </a-app>
    </a-config-provider>
  </HappyProvider>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, provide } from "vue";
import { theme as antTheme } from "antdv-next";
import zhCN from "antdv-next/locale/zh_CN";
import { HappyProvider } from "@antdv-next/happy-work-theme";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");
import TitleBar from "./components/TitleBar.vue";
import TodoList from "./components/TodoList.vue";
import TimeView from "./components/TimeView.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import ReportDialog from "./components/ReportDialog.vue";
import type { TodoItem, AppSettings } from "./types";
import { init as initTodos, getAllTodos, addTodo, updateTodo, deleteTodo, reorderTodos, sortTodos } from "./services/todoService";
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
const currentView = ref<"today" | "time">("today");

const todayStr = computed(() => dayjs().format("YYYY-MM-DD"));

const activeTodos = computed(() =>
  todos.value.filter((t) => dayjs(t.createdAt).format("YYYY-MM-DD") === todayStr.value)
);

const completedTodos = computed(() =>
  todos.value.filter((t) => t.completed)
);

provide("settings", settings);

const currentAlgorithm = ref(antTheme.defaultAlgorithm);

function isBeijingNight(): boolean {
  const now = new Date();
  const bjHour = (now.getUTCHours() + 8) % 24;
  return bjHour >= 18 || bjHour < 6;
}

function applyTheme(theme: "system" | "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    currentAlgorithm.value = antTheme.darkAlgorithm;
  } else if (theme === "light") {
    root.classList.remove("dark");
    currentAlgorithm.value = antTheme.defaultAlgorithm;
  } else {
    const dark = isBeijingNight();
    root.classList.toggle("dark", dark);
    currentAlgorithm.value = dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
  }
}

let systemThemeTimer: ReturnType<typeof setInterval> | null = null;

function startSystemThemeTimer() {
  systemThemeTimer = setInterval(() => {
    if (settings.value.theme === "system") {
      const dark = isBeijingNight();
      document.documentElement.classList.toggle("dark", dark);
      currentAlgorithm.value = dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
    }
  }, 60_000);
}

onMounted(async () => {
  await initTodos();
  await initSettings();
  todos.value = await getAllTodos();
  settings.value = await getSettings();
  applyTheme(settings.value.theme);
  startSystemThemeTimer();
});

onUnmounted(() => {
  if (systemThemeTimer) {
    clearInterval(systemThemeTimer);
    systemThemeTimer = null;
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
    parentId: null,
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
  if (todo.parentId === null) {
    const hasChildren = todos.value.some((t) => t.parentId === id);
    if (hasChildren) return;
  }
  const newCompleted = !todo.completed;
  todo.completed = newCompleted;
  todo.completedAt = newCompleted ? new Date().toISOString() : null;
  todos.value = sortTodos(todos.value);
  await updateTodo(id, {
    completed: newCompleted,
    completedAt: todo.completedAt,
  });
  if (todo.parentId) {
    await syncParentCompletion(todo.parentId);
  }
}

async function syncParentCompletion(parentId: string) {
  const children = todos.value.filter((t) => t.parentId === parentId);
  if (children.length === 0) return;
  const allCompleted = children.every((c) => c.completed);
  const parent = todos.value.find((t) => t.id === parentId);
  if (parent && parent.completed !== allCompleted) {
    parent.completed = allCompleted;
    parent.completedAt = allCompleted ? new Date().toISOString() : null;
    todos.value = sortTodos(todos.value);
    await updateTodo(parentId, {
      completed: allCompleted,
      completedAt: parent.completedAt,
    });
  }
  if (parent && parent.parentId) {
    await syncParentCompletion(parent.parentId);
  }
}

async function handleReorder(ids: string[], parentIds?: Record<string, string | null>) {
  const oldParentIds = new Map<string, string | null>();

  if (parentIds) {
    for (const [id, newParentId] of Object.entries(parentIds)) {
      const todo = todos.value.find((t) => t.id === id);
      oldParentIds.set(id, todo?.parentId ?? null);
      await updateTodo(id, { parentId: newParentId });
    }
  }
  await reorderTodos(ids);
  todos.value = await getAllTodos();

  if (parentIds) {
    const affectedParents = new Set<string>();
    for (const [id, newParentId] of Object.entries(parentIds)) {
      const oldParentId = oldParentIds.get(id);
      if (oldParentId) affectedParents.add(oldParentId);
      if (newParentId) affectedParents.add(newParentId);
    }
    for (const parentId of affectedParents) {
      await syncParentCompletion(parentId);
    }
  }
}

async function handleAddSubTodo(parentId: string, content: string) {
  const siblings = todos.value.filter((t) => t.parentId === parentId);
  const newTodo: TodoItem = {
    id: crypto.randomUUID(),
    content,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: siblings.length,
    tagId: null,
    parentId,
  };
  await addTodo(newTodo);
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
    <a-config-provider :theme="{ algorithm: currentAlgorithm }" :wave="wave" :locale="zhCN">
      <a-app>
        <div class="flex flex-col h-screen bg-[var(--background)]">
          <TitleBar @open-settings="showSettings = true" @open-report="showReport = true" @update:view="(v) => currentView = v as 'today' | 'time'" />
          <TodoList
            v-if="currentView === 'today'"
            :todos="activeTodos"
            :settings="settings"
            @add-todo="handleAddTodo"
            @update-todo="handleUpdateTodo"
            @toggle-complete="handleToggleComplete"
            @reorder="handleReorder"
            @delete-todo="handleDeleteTodo"
            @set-tag="handleSetTag"
            @add-sub-todo="handleAddSubTodo"
          />
          <TimeView
            v-if="currentView === 'time'"
            :todos="completedTodos"
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
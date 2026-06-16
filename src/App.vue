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
import CategoryDialog from "./components/CategoryDialog.vue";
import BackupDialog from "./components/BackupDialog.vue";
import type { TodoItem, AppSettings, Category } from "./types";
import { init as initTodos, getAllTodos, addTodo, updateTodo, deleteTodo, reorderTodos, sortTodos, clearAllTodos } from "./services/todoService";
import { init as initSettings, getSettings, saveSettings } from "./services/settingsService";
import { exportDatabase, importDatabase } from "./services/dbService";

const todos = ref<TodoItem[]>([]);
const togglingIds = new Set<string>();
const settings = ref<AppSettings>({
  completionMode: "longpress",
  longPressDuration: 3,
  theme: "system",
  happyMode: false,
  fontFamily: "default",
  addTodoShortcut: {
    key: "Enter",
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  },
  tags: [],
  categories: [],
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
const showBackup = ref(false);
const currentView = ref<"today" | "time">("today");
const selectedCatId = ref<string>("__none__");
const showCategoryDialog = ref(false);

const todayStr = computed(() => dayjs().format("YYYY-MM-DD"));

function toLocalDateStr(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const activeTodos = computed(() => {
  let filtered = todos.value.filter((t) => !t.completed || (t.completedAt && toLocalDateStr(t.completedAt) === todayStr.value));
  if (selectedCatId.value === "__none__") {
    filtered = filtered.filter((t) => t.catId === null);
  } else {
    filtered = filtered.filter((t) => t.catId === selectedCatId.value);
  }
  return filtered;
});

const completedTodos = computed(() =>
  todos.value.filter((t) => t.completed && t.completedAt && toLocalDateStr(t.completedAt) !== todayStr.value)
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

function handleSelectCat(catId: string | null) {
  selectedCatId.value = catId ?? "__none__";
}

async function handleSaveCategories(categories: Category[]) {
  const oldIds = new Set(settings.value.categories.map((c) => c.id));
  const newIds = new Set(categories.map((c) => c.id));
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  settings.value.categories = categories;
  await saveSettings(settings.value);
  if (removedIds.length > 0) {
    for (const todo of todos.value) {
      if (todo.catId && removedIds.includes(todo.catId)) {
        await updateTodo(todo.id, { catId: null });
      }
    }
    todos.value = await getAllTodos();
  }
  showCategoryDialog.value = false;
}

async function handleAddTodo(content: string) {
  const newTodo: TodoItem = {
    id: crypto.randomUUID(),
    content,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: todos.value.length,
    tagId: null,
    catId: selectedCatId.value === "__none__" ? null : selectedCatId.value,
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

async function handleSetCat(id: string, catId: string | null) {
  const idsToUpdate = [id];
  const childIds = getDescendantIds(id);
  idsToUpdate.push(...childIds);
  for (const todoId of idsToUpdate) {
    await updateTodo(todoId, { catId });
  }
  todos.value = await getAllTodos();
}

function getDescendantIds(parentId: string): string[] {
  const ids: string[] = [];
  for (const t of todos.value) {
    if (t.parentId === parentId) {
      ids.push(t.id);
      ids.push(...getDescendantIds(t.id));
    }
  }
  return ids;
}

async function handleToggleComplete(id: string) {
  if (togglingIds.has(id)) return;
  const todo = todos.value.find((t) => t.id === id);
  if (!todo) return;
  if (todo.parentId === null) {
    const hasChildren = todos.value.some((t) => t.parentId === id);
    if (hasChildren) return;
  }
  togglingIds.add(id);
  const newCompleted = !todo.completed;
  todo.completed = newCompleted;
  todo.completedAt = newCompleted ? new Date().toISOString() : null;
  todos.value = sortTodos(todos.value);
  try {
    await updateTodo(id, {
      completed: newCompleted,
      completedAt: todo.completedAt,
    });
    if (todo.parentId) {
      await syncParentCompletion(todo.parentId);
    }
  } finally {
    togglingIds.delete(id);
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
    catId: null,
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

async function handleClearData() {
  await clearAllTodos();
  todos.value = await getAllTodos();
}

async function handleExportDb() {
  try {
    await exportDatabase();
  } catch (e) {
    console.error("导出数据库失败", e);
  }
}

async function handleImportDb() {
  try {
    await importDatabase();
    todos.value = await getAllTodos();
    settings.value = await getSettings();
  } catch (e) {
    console.error("导入数据库失败", e);
  }
}

async function handleRestoreBackup(data: { todos: TodoItem[]; settings: AppSettings }) {
  await clearAllTodos();
  for (const todo of data.todos) {
    await addTodo(todo);
  }
  await saveSettings(data.settings);
  todos.value = await getAllTodos();
  settings.value = await getSettings();
  showBackup.value = false;
}
</script>

<template>
  <HappyProvider :enabled="settings.happyMode" v-slot="{ wave }">
    <a-config-provider :theme="{ algorithm: currentAlgorithm }" :wave="wave" :locale="zhCN">
      <a-app>
        <div class="flex flex-col h-screen bg-[var(--background)]" :class="settings.fontFamily === 'cartoon' ? 'font-cartoon' : ''">
          <TitleBar
            :categories="settings.categories"
            :selected-cat-id="selectedCatId"
            @open-settings="showSettings = true"
            @open-report="showReport = true"
            @open-backup="showBackup = true"
            @update:view="(v) => currentView = v as 'today' | 'time'"
            @select-cat="handleSelectCat"
            @manage-categories="showCategoryDialog = true"
          />
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
            @set-cat="handleSetCat"
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
            @clear-data="handleClearData"
            @export-db="handleExportDb"
            @import-db="handleImportDb"
          />
          <ReportDialog
            v-model:open="showReport"
            :todos="todos"
          />
          <CategoryDialog
            v-model:open="showCategoryDialog"
            :categories="settings.categories"
            :todos="todos"
            @save="handleSaveCategories"
          />
          <BackupDialog
            v-model:open="showBackup"
            :todos="todos"
            :settings="settings"
            @restore="handleRestoreBackup"
          />
        </div>
      </a-app>
    </a-config-provider>
  </HappyProvider>
</template>
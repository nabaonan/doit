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
import TagDialog from "./components/TagDialog.vue";
import BackupDialog from "./components/BackupDialog.vue";
import ReminderDialog from "./components/ReminderDialog.vue";
import type { TodoItem, AppSettings, Category } from "./types";
import { init as initTodos, getAllTodos, addTodo, updateTodo, deleteTodo, reorderTodos, sortTodos, clearAllTodos } from "./services/todoService";
import { init as initSettings, getSettings, saveSettings } from "./services/settingsService";
import { exportDatabase, importDatabase } from "./services/dbService";
import { startScheduler, stopScheduler, setCallbacks as setSchedulerCallbacks } from "./services/autoSyncService";
import { loadReminders, scheduleReminder, cancelReminder as cancelReminderService, setNotificationCallback } from "./services/reminderService";
import { message } from "antdv-next";
import type { Tag } from "./types";

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
    provider: "webdav",
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
  },
  autoBackup: {
    enabled: false,
    interval: 30,
    unit: "minute",
  },
  autoRestore: {
    enabled: false,
    interval: 30,
    unit: "minute",
  },
});
const showSettings = ref(false);
const showReport = ref(false);
const showBackup = ref(false);
const currentView = ref<"today" | "time">("today");
const selectedCatId = ref<string>("__none__");
const showCategoryDialog = ref(false);
const showTagDialog = ref(false);
const reminderTodoId = ref<string | null>(null);
const showReminder = ref(false);

const reminderTodo = computed(() => {
  if (!reminderTodoId.value) return null;
  return todos.value.find((t) => t.id === reminderTodoId.value) ?? null;
});

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
  try {
    await initTodos();
    await initSettings();
    todos.value = await getAllTodos();
    settings.value = await getSettings();
    console.log("[doit] DB initialized, todos:", todos.value.length, "settings loaded");
  } catch (e) {
    console.warn("[doit] DB unavailable:", e);
  }
  applyTheme(settings.value.theme);
  startSystemThemeTimer();

  // 启动自动备份/恢复调度器
  setSchedulerCallbacks({
    onBackupStatus: (s) => {
      if (s === "自动备份完成") message.success(s);
      else if (s === "自动备份失败") message.error(s);
    },
    onRestoreStatus: (s) => {
      if (s === "自动恢复完成") message.success(s);
      else if (s === "自动恢复失败") message.error(s);
    },
    onDataChanged: async () => {
      // 自动恢复后重新加载 todos 和 settings
      try {
        todos.value = await getAllTodos();
        settings.value = await getSettings();
      } catch (e) {
        console.warn("[doit] 刷新数据失败:", e);
      }
    },
  });
  setNotificationCallback(async (todoId: string, content: string) => {
    cancelReminderService(todoId);
    const todo = todos.value.find((t) => t.id === todoId);
    if (todo) {
      todo.remindAt = null;
      await updateTodo(todoId, { remindAt: null } as any);
    }

    const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
    if (isTauri) {
      const { sendNotification, isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      if (granted) {
        sendNotification({ title: "待办提醒", body: content, icon: "icons/icon.png" });
      }
    } else if ("Notification" in window) {
      const icon = "/icon.png";
      if (Notification.permission === "granted") {
        new Notification("待办提醒", { body: content, icon });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification("待办提醒", { body: content, icon });
        }
      }
    }
  });
  if (settings.value.cloudSync.enabled) {
    startScheduler(() => settings.value);
  }
  loadReminders(todos.value);
});

onUnmounted(() => {
  if (systemThemeTimer) {
    clearInterval(systemThemeTimer);
    systemThemeTimer = null;
  }
  stopScheduler();
});

// 监听 settings 变化，启停调度器
watch(
  () => [
    settings.value.cloudSync.enabled,
    settings.value.cloudSync.webdavUrl,
    JSON.stringify(settings.value.autoBackup),
    JSON.stringify(settings.value.autoRestore),
  ],
  () => {
    if (settings.value.cloudSync.enabled) {
      startScheduler(() => settings.value);
    } else {
      stopScheduler();
    }
  }
);

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
  try {
    await saveSettings(settings.value);
  } catch {
    try {
      settings.value = await getSettings();
    } catch {}
  }
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

async function handleSaveTags(tags: Tag[]) {
  const oldIds = new Set((settings.value.tags || []).map((t) => t.id));
  const newIds = new Set(tags.map((t) => t.id));
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  settings.value.tags = tags;
  try {
    await saveSettings(settings.value);
  } catch {
    try {
      settings.value = await getSettings();
    } catch {}
  }
  if (removedIds.length > 0) {
    for (const todo of todos.value) {
      if (todo.tagId && removedIds.includes(todo.tagId)) {
        await updateTodo(todo.id, { tagId: null });
      }
    }
    todos.value = await getAllTodos();
  }
  showTagDialog.value = false;
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
    remindAt: null,
  };
  const ok = await addTodo(newTodo);
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    // DB unavailable (e.g. browser dev mode) — keep in memory
    todos.value = sortTodos([...todos.value, newTodo]);
  }
}

async function handleUpdateTodo(id: string, content: string) {
  const ok = await updateTodo(id, { content });
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    const todo = todos.value.find((t) => t.id === id);
    if (todo) todo.content = content;
  }
}

async function handleSetTag(id: string, tagId: string | null) {
  const ok = await updateTodo(id, { tagId });
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    const todo = todos.value.find((t) => t.id === id);
    if (todo) todo.tagId = tagId;
  }
}

async function handleSetCat(id: string, catId: string | null) {
  const idsToUpdate = [id];
  const childIds = getDescendantIds(id);
  idsToUpdate.push(...childIds);
  let allOk = true;
  for (const todoId of idsToUpdate) {
    const ok = await updateTodo(todoId, { catId });
    if (!ok) allOk = false;
  }
  if (allOk) {
    todos.value = await getAllTodos();
  } else {
    for (const todoId of idsToUpdate) {
      const todo = todos.value.find((t) => t.id === todoId);
      if (todo) todo.catId = catId;
    }
  }
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
  if (newCompleted && todo.remindAt) {
    cancelReminderService(id);
  }
  todo.completed = newCompleted;
  todo.completedAt = newCompleted ? new Date().toISOString() : null;
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
  todos.value = sortTodos(todos.value);
}

async function syncParentCompletion(parentId: string) {
  const children = todos.value.filter((t) => t.parentId === parentId);
  if (children.length === 0) return;
  const allCompleted = children.every((c) => c.completed);
  const parent = todos.value.find((t) => t.id === parentId);
  if (parent && parent.completed !== allCompleted) {
    parent.completed = allCompleted;
    parent.completedAt = allCompleted ? new Date().toISOString() : null;
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
  let allOk = true;

  if (parentIds) {
    for (const [id, newParentId] of Object.entries(parentIds)) {
      const todo = todos.value.find((t) => t.id === id);
      oldParentIds.set(id, todo?.parentId ?? null);
      const ok = await updateTodo(id, { parentId: newParentId });
      if (!ok) allOk = false;
    }
  }
  const reorderOk = await reorderTodos(ids);
  if (!reorderOk) allOk = false;

  if (allOk) {
    todos.value = await getAllTodos();
  } else {
    todos.value = sortTodos(todos.value);
  }

  if (parentIds && allOk) {
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
  const parent = todos.value.find((t) => t.id === parentId);
  const newTodo: TodoItem = {
    id: crypto.randomUUID(),
    content,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: siblings.length,
    tagId: null,
    catId: parent?.catId ?? null,
    parentId,
    remindAt: null,
  };
  const ok = await addTodo(newTodo);
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    todos.value = sortTodos([...todos.value, newTodo]);
  }
}

async function handleDeleteTodo(id: string) {
  cancelReminderService(id);
  const ok = await deleteTodo(id);
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    const idsToDelete = new Set([id]);
    for (const t of todos.value) {
      if (t.parentId === id) idsToDelete.add(t.id);
    }
    todos.value = sortTodos(todos.value.filter((t) => !idsToDelete.has(t.id)));
  }
}

async function handleSaveSettings(newSettings: AppSettings) {
  await saveSettings(newSettings);
  settings.value = newSettings;
  // 不在此处关闭弹框，由 SettingsDialog 自身的 onClose 控制
  // 否则实时保存会立即关闭弹框
}

async function handleClearData() {
  const ok = await clearAllTodos();
  if (ok) {
    todos.value = await getAllTodos();
    // 同步清空 settings 状态中的 categories 和 tags
    settings.value = {
      ...settings.value,
      categories: [],
      tags: [],
    };
  } else {
    todos.value = [];
  }
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

async function handleDataChanged() {
  todos.value = await getAllTodos();
  settings.value = await getSettings();
  showBackup.value = false;
}

function handleSetReminder(id: string) {
  reminderTodoId.value = id;
  showReminder.value = true;
}

async function handleSetReminderConfirm(remindAt: string) {
  const id = reminderTodoId.value;
  if (!id) return;
  cancelReminderService(id);
  const ok = await updateTodo(id, { remindAt });
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    const todo = todos.value.find((t) => t.id === id);
    if (todo) todo.remindAt = remindAt;
  }
  scheduleReminder(id, remindAt, todos.value.find((t) => t.id === id)?.content ?? "");
  reminderTodoId.value = null;
  showReminder.value = false;
}

async function handleCancelReminder(id: string) {
  cancelReminderService(id);
  const ok = await updateTodo(id, { remindAt: null } as any);
  if (ok) {
    todos.value = await getAllTodos();
  } else {
    const todo = todos.value.find((t) => t.id === id);
    if (todo) todo.remindAt = null;
  }
  reminderTodoId.value = null;
  showReminder.value = false;
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
            @manage-tags="showTagDialog = true"
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
            @set-reminder="handleSetReminder"
            @cancel-reminder="handleCancelReminder"
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
          <TagDialog
            v-model:open="showTagDialog"
            :tags="settings.tags || []"
            @save="handleSaveTags"
          />
          <!-- 同步状态栏 -->
          <BackupDialog
            v-model:open="showBackup"
            :settings="settings"
            @data-changed="handleDataChanged"
          />
          <ReminderDialog
            v-if="reminderTodo"
            v-model:open="showReminder"
            :todo-id="reminderTodo.id"
            :todo-content="reminderTodo.content"
            :current-remind-at="reminderTodo.remindAt"
            @confirm="handleSetReminderConfirm"
            @cancel-reminder="() => handleCancelReminder(reminderTodo!.id)"
            @update:open="(val) => { if (!val) { showReminder = false; reminderTodoId = null } }"
          />
        </div>
      </a-app>
    </a-config-provider>
  </HappyProvider>
</template>
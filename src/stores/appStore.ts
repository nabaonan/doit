import { defineStore } from "pinia";
import type { TodoItem, AppSettings } from "../types";

const defaultSettings: AppSettings = {
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
  defaultCategoryId: null,
  cloudSync: {
    enabled: false,
    provider: "webdav",
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    fetchOnStartup: true,
    uploadOnExit: true,
    keepRecent: 3,
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
};

export const useAppStore = defineStore("app", {
  state: () => ({
    todos: [] as TodoItem[],
    settings: { ...defaultSettings },
    selectedCatId: "__none__" as string,
  }),
  getters: {},
  actions: {
    setTodos(todos: TodoItem[]) {
      this.todos = todos;
    },
    setSettings(settings: AppSettings) {
      this.settings = settings;
    },
    setSelectedCatId(id: string) {
      this.selectedCatId = id;
    },
    resetAll() {
      this.todos = [];
      this.settings = { ...defaultSettings };
      this.selectedCatId = "__none__";
    },
  },
});

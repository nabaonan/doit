import type { TodoItem } from "../types"

const timers = new Map<string, ReturnType<typeof setTimeout>>()

type NotifyCallback = (todoId: string, content: string) => void

let notifyCallback: NotifyCallback | null = null

export function setNotificationCallback(cb: NotifyCallback) {
  notifyCallback = cb
}

export function scheduleReminder(todoId: string, remindAt: string, content: string) {
  cancelReminder(todoId)
  const target = new Date(remindAt).getTime()
  const now = Date.now()
  const delay = target - now
  if (delay <= 0) return
  const timer = setTimeout(() => {
    notifyCallback?.(todoId, content)
    timers.delete(todoId)
  }, delay)
  timers.set(todoId, timer)
}

export function cancelReminder(todoId: string) {
  const timer = timers.get(todoId)
  if (timer) {
    clearTimeout(timer)
    timers.delete(todoId)
  }
}

export function loadReminders(todos: TodoItem[]) {
  for (const todo of todos) {
    if (todo.remindAt && !todo.completed) {
      scheduleReminder(todo.id, todo.remindAt, todo.content)
    }
  }
}

export function clearAllReminders() {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}

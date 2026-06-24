import type { BackupUnit } from "../types"

/**
 * 根据间隔单位和数值生成 5 段 cron 表达式
 * - minute: star/N * * * *
 * - hour:   0 star/N * * *
 * - day:    0 0 star/N * *
 */
export function intervalToCron(unit: BackupUnit, interval: number): string {
  const n = Math.max(1, Math.floor(interval))
  switch (unit) {
    case "minute":
      return `*/${n} * * * *`
    case "hour":
      return `0 */${n} * * *`
    case "day":
      return `0 0 */${n} * *`
  }
}

/**
 * 根据 (unit, interval) 计算下次执行时间
 */
export function getNextRunTime(
  unit: BackupUnit,
  interval: number,
  after: Date = new Date()
): Date {
  const n = Math.max(1, Math.floor(interval))
  const next = new Date(after.getTime())
  switch (unit) {
    case "minute":
      next.setMinutes(next.getMinutes() + n)
      break
    case "hour":
      next.setHours(next.getHours() + n)
      break
    case "day":
      next.setDate(next.getDate() + n)
      break
  }
  return next
}

let db: unknown = null

export async function getDb() {
  if (db) return db
  const mod = await import("@tauri-apps/plugin-sql")
  const Database = mod.default
  db = await Database.load("sqlite:doit.db")
  const exec = (sql: string, params?: unknown[]) =>
    (db as { execute: (sql: string, params?: unknown[]) => Promise<void> }).execute(sql, params)
  const select = (sql: string, params?: unknown[]) =>
    (db as { select: (sql: string, params?: unknown[]) => Promise<unknown> }).select(sql, params)

  await cleanupDuplicateTables(exec, select)

  await exec(
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      tag_id TEXT,
      cat_id TEXT,
      parent_id TEXT
    )`
  )
  await exec(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  )

  // 添加 remind_at 列（旧数据库迁移）
  try {
    await exec("ALTER TABLE todos ADD COLUMN remind_at TEXT")
  } catch {
    // 列已存在，忽略
  }

  // 把 localStorage 中残留的旧数据迁移到 SQLite（一次性，迁移后保留 localStorage 备份 7 天）
  await migrateFromLocalStorage(exec, select)

  // 自检：尝试写入 + 读取一次，看 SQLite 是否真的能工作
  try {
    await exec("CREATE TABLE IF NOT EXISTS _diagnostic (id INTEGER PRIMARY KEY, msg TEXT)")
    await exec("DELETE FROM _diagnostic")
    await exec("INSERT INTO _diagnostic (id, msg) VALUES (1, $1)", ["test"])
    const rows = (await select("SELECT count(*) AS c FROM _diagnostic")) as Array<{ c: number }>
    if (rows[0]?.c === 1) {
      console.log("[doit] SQLite 自检通过: 写入 + 读取正常, db =", (db as { path: string }).path)
    } else {
      console.warn("[doit] SQLite 自检异常: count =", rows[0]?.c)
    }
    await exec("DROP TABLE _diagnostic")
  } catch (e) {
    console.error("[doit] SQLite 自检失败:", e)
  }

  return db
}

/**
 * 把 localStorage 中可能存在的旧数据（doit_todos / doit_settings）迁移到 SQLite。
 * 仅在 SQLite 中尚无数据且 localStorage 存在数据时执行。
 */
async function migrateFromLocalStorage(
  exec: (sql: string, params?: unknown[]) => Promise<void>,
  select: (sql: string, params?: unknown[]) => Promise<unknown>
) {
  try {
    const existingTodos = (await select("SELECT count(*) AS c FROM todos")) as Array<{ c: number }>
    if (existingTodos.length > 0 && existingTodos[0].c > 0) {
      return
    }
    const rawTodos = localStorage.getItem("doit_todos")
    const rawSettings = localStorage.getItem("doit_settings")
    if (!rawTodos && !rawSettings) {
      return
    }
    console.log("[doit] 从 localStorage 迁移数据到 SQLite")

    if (rawTodos) {
      try {
        const items = JSON.parse(rawTodos) as Array<Record<string, unknown>>
        for (const it of items) {
          await exec(
            `INSERT OR IGNORE INTO todos
              (id, content, completed, created_at, completed_at, sort_order, tag_id, cat_id, parent_id, remind_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              it.id ?? crypto.randomUUID(),
              it.content ?? "",
              it.completed ? 1 : 0,
              it.created_at ?? new Date().toISOString(),
              it.completed_at ?? null,
              it.sort_order ?? 0,
              it.tag_id ?? null,
              it.cat_id ?? null,
              it.parent_id ?? null,
              it.remind_at ?? null,
            ]
          )
        }
      } catch (e) {
        console.warn("[doit] 迁移 todos 失败:", e)
      }
    }

    if (rawSettings) {
      try {
        const rows = JSON.parse(rawSettings) as Array<{ key: string; value: string }>
        for (const r of rows) {
          await exec(
            `INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)`,
            [r.key, r.value]
          )
        }
      } catch (e) {
        console.warn("[doit] 迁移 settings 失败:", e)
      }
    }
  } catch (e) {
    console.warn("[doit] localStorage 迁移过程失败:", e)
  }
}

async function cleanupDuplicateTables(
  exec: (sql: string) => Promise<void>,
  select: (sql: string) => Promise<unknown>
) {
  try {
    const tables = (await select(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )) as Array<{ name: string }>
    const todoTables = tables
      .map((t) => t.name)
      .filter((n) => n === "todos" || /^todos_\d+$/.test(n) || /^todos\d+$/.test(n))
    const settingsTables = tables
      .map((t) => t.name)
      .filter((n) => n === "settings" || /^settings_\d+$/.test(n) || /^settings\d+$/.test(n))

    if (todoTables.length > 1 || settingsTables.length > 1) {
      console.warn("[doit] 发现重复表，开始合并:", { todoTables, settingsTables })

      if (todoTables.length > 1) {
        const keep = "todos"
        const dups = todoTables.filter((n) => n !== keep)
        for (const dup of dups) {
          try {
            await exec(`INSERT OR IGNORE INTO "${keep}" SELECT * FROM "${dup}"`)
            await exec(`DROP TABLE "${dup}"`)
            console.log(`[doit] 已合并并删除重复表 ${dup}`)
          } catch (e) {
            console.warn(`[doit] 处理重复表 ${dup} 失败:`, e)
          }
        }
      }

      if (settingsTables.length > 1) {
        const keep = "settings"
        const dups = settingsTables.filter((n) => n !== keep)
        for (const dup of dups) {
          try {
            await exec(`INSERT OR REPLACE INTO "${keep}" SELECT * FROM "${dup}"`)
            await exec(`DROP TABLE "${dup}"`)
            console.log(`[doit] 已合并并删除重复表 ${dup}`)
          } catch (e) {
            console.warn(`[doit] 处理重复表 ${dup} 失败:`, e)
          }
        }
      }
    }
  } catch (e) {
    console.warn("[doit] 清理重复表失败:", e)
  }
}

export async function closeDb() {
  if (db) {
    try {
      await (db as { close: () => Promise<void> }).close()
    } catch {
      // ignore
    }
    db = null
  }
}

# 增加大版本发布指令

## 需求描述

在现有的 `release` 脚本基础上，增加一个大版本发布功能。当前 `release` 执行 `npm version patch`（从 0.1.1 → 0.1.2），需要新增一个 `release:major` 指令执行 `npm version minor`（从 0.1.1 → 0.2.0）。

## 当前状态分析

### 现有 release 流程

[release.mjs](file:///c:/Users/nbn/workspace/github/doit/scripts/release.mjs) 执行：
1. `npm version patch -m "chore: release v%s"` — 自动 bump patch 版本号、更新 package.json、创建 git commit + tag
2. `git push origin HEAD --follow-tags` — 推送代码和 tag
3. 打印发布版本号

`npm version patch` 会自动更新 `package.json` 的 `version` 字段，然后 `version` script（`node scripts/sync-version.mjs`）会同步版本到 `tauri.conf.json`、`Cargo.toml`、`Cargo.lock`。

### 触发 CI

推送 `v*` tag 到 GitHub 会触发 [release.yml](file:///c:/Users/nbn/workspace/github/doit/.github/workflows/release.yml) 构建。

## 实现方案

### 方案：修改 release.mjs 支持参数

给 `release.mjs` 增加一个命令行参数 `--minor`（或 `-m`），当传入时执行 `npm version minor` 代替 `npm version patch`。

同时在 `package.json` 中新增 `release:minor` script。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `scripts/release.mjs` | 解析命令行参数，根据参数选择 `patch` 或 `minor` |
| `package.json` | 新增 `release:minor` script |

### 实现步骤

#### Step 1: 修改 release.mjs

```js
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const isMinor = process.argv.includes("--minor") || process.argv.includes("-m")
const bumpType = isMinor ? "minor" : "patch"

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { cwd: root, stdio: "inherit" })
}

run(`npm version ${bumpType} -m "chore: release v%s"`)

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"))

run("git push origin HEAD --follow-tags")

console.log(`Released v${pkg.version}`)
```

#### Step 2: 在 package.json 中添加 script

```json
"release": "node scripts/release.mjs",
"release:minor": "node scripts/release.mjs --minor",
```

### 使用方式

```bash
# 小版本发布 (patch): 0.1.1 → 0.1.2
npm run release

# 大版本发布 (minor): 0.1.1 → 0.2.0
npm run release:minor
```

### 注意事项

- `npm version minor` 会自动增加次版本号并将补丁号归零（如 0.1.29 → 0.2.0）
- `version` script（`sync-version.mjs`）会在 `npm version` 之后自动执行，同步版本到 Tauri 配置和 Cargo.toml
- CI 通过 tag `v*` 触发，无论 patch 还是 minor 都会触发构建

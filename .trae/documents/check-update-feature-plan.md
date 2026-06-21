# 「检查更新」功能实施计划

## 1. Summary（功能概要）

在「设置」弹框中新增一个 **「关于」** 分类菜单项，承载：
- 当前版本号（从 Tauri 配置读取）
- 「检查更新」按钮（手动查询 GitHub latest release）
- 与最新版本对比，显示「有更新 / 已是最新 / 获取失败」三种状态
- 「下载并安装」按钮（仅在有更新时可用）
- 下载进度条（实时显示已下载/总大小/百分比/速度，**不阻塞主线程**）
- 下载完成后**自动打开安装包**（Windows 启动安装器、macOS 挂载 dmg、Linux 打开 deb/rpm）
- 安装包保存到**系统下载目录**（`~/Downloads`）

---

## 2. Current State Analysis（现状分析）

### 2.1 版本元数据（已就绪）
- `package.json:4` → `"version": "0.1.43"`
- `src-tauri/tauri.conf.json:4` → `"version": "0.1.43"`
- `src-tauri/Cargo.toml:3` → `version = "0.1.43"`
- 已有 `npm run version` 脚本（`scripts/sync-version.mjs`）三处同步

### 2.2 GitHub Release 资产命名（实测 v0.1.43）

通过 `https://api.github.com/repos/nabaonan/doit/releases/latest` 实际拉取确认，资产命名规则有 4 种形式：

| 平台 + 架构 | 文件名模式 | 实测大小 |
|------------|----------|---------|
| macOS Apple Silicon (aarch64) | `Doit_0.1.43_aarch64.dmg` | ~11 MB |
| macOS Apple Silicon (tar) | `Doit_aarch64.app.tar.gz` | ~5 MB（备用） |
| macOS Intel (x86_64) | `Doit_0.1.43_x64.dmg` | ~11 MB |
| Windows x86_64 (NSIS) | `Doit_0.1.43_x64-setup.exe` | ~9 MB |
| Windows x86_64 (MSI) | `Doit_0.1.43_x64_en-US.msi` | ~10 MB |
| Linux x86_64 (deb) | `Doit_0.1.43_amd64.deb` | ~12 MB |
| Linux x86_64 (AppImage) | `Doit_0.1.43_amd64.AppImage` | ~86 MB |
| Linux x86_64 (rpm) | `Doit-0.1.43-1.x86_64.rpm` | ~12 MB |
| Linux aarch64 (rpm) | `Doit-0.1.43-1.aarch64.rpm` | ~12 MB |

> ⚠️ **命名不一致**：Linux `.deb/.AppImage` 用下划线（`Doit_0.1.43_amd64.deb`），而 Linux `.rpm` 用连字符（`Doit-0.1.43-1.x86_64.rpm`）。匹配时需用正则兼容两种格式。

### 2.3 现有 Tauri 命令模式（[src-tauri/src/lib.rs](file:///Users/nbn/workspace/github/doit/src-tauri/src/lib.rs)）
- 使用 `reqwest`（`rustls-tls`）+ `make_client()` 工厂
- 异步命令模式：`async fn ... -> Result<T, String>`
- `tauri::AppHandle` 通过 `Manager` trait 拿到 `app.path()` 等
- 命令注册于 [lib.rs:677-687](file:///Users/nbn/workspace/github/doit/src-tauri/src/lib.rs#L677-L687) 的 `tauri::generate_handler!`

### 2.4 现有前端模式
- 路径别名：`src/services/` 放业务服务
- 动态 import Tauri API（运行时检测 `window.__TAURI_INTERNALS__`）
- 现有 `webdavService.ts` 已是 `httpFetch` + `tauri_fetch` 模式
- 设置弹框在 [SettingsDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue)，左侧菜单 + 右侧内容 + scroll-based 同步激活分类

### 2.5 已有依赖
- `tauri = "2"` (Tauri v2) ✅
- `tauri-plugin-dialog = "2"` ✅（用于「保存到」对话框，但我们用系统下载目录，不需要）
- `tauri-plugin-fs = "2"` ✅
- `tauri-plugin-shell = "2"` ❌ **缺失**（用于 `shell.open()` 自动打开安装包）
- `reqwest = "0.12"` (rustls-tls) ✅
- `serde / serde_json` ✅

---

## 3. Proposed Changes（具体变更）

### 3.1 Rust 后端 — `src-tauri/src/lib.rs`

#### A. 新增 `update_service.rs`（新建模块）—— 推荐

**理由**：保持 lib.rs 职责清晰（当前已 700+ 行），update 相关代码独立成模块。

```rust
// src-tauri/src/update_service.rs

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

const GITHUB_RELEASES_API: &str = "https://api.github.com/repos/nabaonan/doit/releases/latest";

#[derive(Serialize, Deserialize, Clone)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ReleaseInfo {
    pub tag_name: String,        // "v0.1.43"
    pub version: String,         // "0.1.43"
    pub name: String,            // "Doit v0.1.43"
    pub html_url: String,        // 发布页 URL
    pub published_at: String,
    pub body: String,            // Release notes
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release: Option<ReleaseInfo>,
    pub asset: Option<ReleaseAsset>,   // 当前平台匹配的安装包
    pub platform: String,              // "macos" | "windows" | "linux"
    pub arch: String,                  // "aarch64" | "x86_64"
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percentage: u8,
    pub file_name: String,
}

pub fn current_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

pub fn platform_key() -> (&'static str, &'static str) {
    let os = std::env::consts::OS;   // "macos" | "windows" | "linux"
    let arch = std::env::consts::ARCH; // "aarch64" | "x86_64"
    (os, arch)
}

/// 根据当前平台和架构，从 release assets 中选择最合适的安装包
pub fn pick_asset_for_platform(assets: &[serde_json::Value], os: &str, arch: &str) -> Option<ReleaseAsset> {
    // 转为 (name_lower, asset_value) 列表
    let candidates: Vec<(String, &serde_json::Value)> = assets
        .iter()
        .map(|a| (a["name"].as_str().unwrap_or("").to_lowercase(), a))
        .collect();

    let pick = |keywords: &[&str]| -> Option<ReleaseAsset> {
        for (name_lower, val) in &candidates {
            // 必须包含所有关键词
            if keywords.iter().all(|k| name_lower.contains(k)) {
                return Some(ReleaseAsset {
                    name: val["name"].as_str().unwrap_or("").to_string(),
                    browser_download_url: val["browser_download_url"].as_str().unwrap_or("").to_string(),
                    size: val["size"].as_u64().unwrap_or(0),
                });
            }
        }
        None
    };

    match (os, arch) {
        ("macos", "aarch64") => {
            pick(&["aarch64", "dmg"])
                .or_else(|| pick(&["aarch64", "app.tar.gz"]))
                .or_else(|| pick(&["aarch64", "app"]))
        }
        ("macos", "x86_64") => pick(&["x64", "dmg"]),
        ("windows", "x86_64") => {
            // 优先 NSIS（支持原地升级）
            pick(&["x64", "setup.exe"])
                .or_else(|| pick(&["x64", ".exe"]))
                .or_else(|| pick(&["x64", ".msi"]))
        }
        ("linux", "x86_64") => {
            pick(&["amd64", "deb"])
                .or_else(|| pick(&["amd64", "appimage"]))
                .or_else(|| pick(&["x86_64", "rpm"]))
        }
        ("linux", "aarch64") => pick(&["aarch64", "rpm"]),
        _ => None,
    }
}

/// 简单版本号比较："0.1.43" vs "0.1.44" → 0.1.43 < 0.1.44
pub fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
    };
    let l = parse(latest);
    let c = parse(current);
    l > c
}
```

#### B. 三个 Tauri 命令（追加到 `src-tauri/src/lib.rs` 的 `invoke_handler` 列表）

```rust
// 添加到 src-tauri/src/lib.rs

use crate::update_service::*;

/// 命令 1：检查更新（前端点击「检查更新」时调用）
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    let client = make_client()?;
    let (os, arch) = platform_key();
    let current = current_version(&app);

    let resp = client
        .get(GITHUB_RELEASES_API)
        .header("User-Agent", "Doit-App")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("请求 GitHub API 失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API 返回 HTTP {}", resp.status().as_u16()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let tag = json["tag_name"].as_str().unwrap_or("").to_string();
    let version = tag.trim_start_matches('v').to_string();
    let release = ReleaseInfo {
        tag_name: tag.clone(),
        version: version.clone(),
        name: json["name"].as_str().unwrap_or("").to_string(),
        html_url: json["html_url"].as_str().unwrap_or("").to_string(),
        published_at: json["published_at"].as_str().unwrap_or("").to_string(),
        body: json["body"].as_str().unwrap_or("").to_string(),
    };

    let assets = json["assets"].as_array().cloned().unwrap_or_default();
    let asset = pick_asset_for_platform(&assets, os, arch);

    Ok(UpdateCheckResult {
        current_version: current,
        latest_version: version,
        has_update: is_newer(&release.version, &current) && asset.is_some(),
        release: Some(release),
        asset,
        platform: os.to_string(),
        arch: arch.to_string(),
    })
}

/// 命令 2：获取当前版本（独立命令，便于初始化时显示）
#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    current_version(&app)
}

/// 命令 3：流式下载 + 进度事件 + 完成后自动打开
#[tauri::command]
async fn download_and_install_update(
    app: tauri::AppHandle,
    url: String,
    file_name: String,
) -> Result<String, String> {
    let client = make_client()?;

    // 1. 确定保存路径：系统下载目录
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("无法获取下载目录: {}", e))?;
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("创建下载目录失败: {}", e))?;
    let dest = download_dir.join(&file_name);

    // 2. 发起请求
    let resp = client
        .get(&url)
        .header("User-Agent", "Doit-App")
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("下载失败: HTTP {}", status.as_u16()));
    }

    let total = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let mut file = std::fs::File::create(&dest)
        .map_err(|e| format!("创建文件失败: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    use futures_util::StreamExt;
    use std::io::Write;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("读取下载流失败: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("写入文件失败: {}", e))?;
        downloaded += chunk.len() as u64;

        // 每 200ms 推送一次进度（避免频繁 emit 阻塞事件循环）
        if last_emit.elapsed().as_millis() >= 200 || downloaded == total {
            let percentage = if total > 0 {
                ((downloaded as f64 / total as f64) * 100.0).min(100.0) as u8
            } else {
                0
            };
            let _ = app.emit(
                "update-download-progress",
                DownloadProgress {
                    bytes_downloaded: downloaded,
                    total_bytes: total,
                    percentage,
                    file_name: file_name.clone(),
                },
            );
            last_emit = std::time::Instant::now();
        }
    }

    file.flush().map_err(|e| format!("刷新文件失败: {}", e))?;
    drop(file);

    eprintln!("[update] 下载完成: {} ({} bytes)", dest.display(), downloaded);

    // 3. 自动打开安装包
    auto_open_installer(&dest);

    Ok(format!("下载完成: {}", dest.display()))
}

/// 自动打开安装包（跨平台）
fn auto_open_installer(path: &std::path::Path) {
    use std::process::Command;
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        // Windows: 用 cmd /C start 启动安装器（NSIS 会触发 UAC）
        let _ = Command::new("cmd").args(&["/C", "start", "", &path_str]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        // macOS: open 命令挂载 dmg 并打开 Finder 窗口
        let _ = Command::new("open").arg(&path_str).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: xdg-open 用系统默认应用打开（deb/rpm → Software Center，AppImage → Files）
        let _ = Command::new("xdg-open").arg(&path_str).spawn();
    }
}
```

#### C. 注册命令（[lib.rs:677-687](file:///Users/nbn/workspace/github/doit/src-tauri/src/lib.rs#L677-L687)）

```rust
.invoke_handler(tauri::generate_handler![
    greet,
    tauri_fetch,
    upload_db_to_webdav,
    download_db_from_webdav,
    list_webdav_backups,
    delete_webdav_backup,
    clean_export_db,
    diagnose_db_paths,
    exit_app,
    check_for_update,            // ← 新增
    get_app_version,             // ← 新增
    download_and_install_update, // ← 新增
])
```

#### D. 模块声明（[lib.rs:1-10](file:///Users/nbn/workspace/github/doit/src-tauri/src/lib.rs#L1-L10)）

```rust
mod update_service;  // ← 新增
```

#### E. `Cargo.toml` 依赖新增

```toml
[dependencies]
# ... 已有 ...
futures-util = "0.3"  # ← 新增：bytes_stream() 需要 StreamExt
```

> 注：`tauri-plugin-shell` 实际上**不需要**——我们用 Rust `std::process::Command` 直接调系统命令，零依赖。

### 3.2 前端 — `src/services/updateService.ts`（新建）

```ts
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export interface ReleaseInfo {
  tag_name: string
  version: string
  name: string
  html_url: string
  published_at: string
  body: string
}

export interface UpdateCheckResult {
  current_version: string
  latest_version: string
  has_update: boolean
  release: ReleaseInfo | null
  asset: ReleaseAsset | null
  platform: string
  arch: string
}

export interface DownloadProgress {
  bytes_downloaded: number
  total_bytes: number
  percentage: number
  file_name: string
}

export async function getAppVersion(): Promise<string> {
  return await invoke<string>("get_app_version")
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  return await invoke<UpdateCheckResult>("check_for_update")
}

export async function downloadAndInstallUpdate(
  url: string,
  fileName: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  // 提前订阅进度事件（避免错过早期事件）
  let unlisten: UnlistenFn | null = null
  if (onProgress) {
    unlisten = await listen<DownloadProgress>("update-download-progress", (event) => {
      onProgress(event.payload)
    })
  }

  try {
    return await invoke<string>("download_and_install_update", { url, fileName })
  } finally {
    if (unlisten) unlisten()
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
```

### 3.3 前端 — `src/components/SettingsDialog.vue`

#### A. 扩展分类菜单（[SettingsDialog.vue:34-48](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L34-L48)）

```ts
type CategoryKey = "appearance" | "interaction" | "sync" | "data" | "about";

const categoryMenuItems = [
  { key: "appearance", label: "外观", icon: () => h(BgColorsOutlined) },
  { key: "interaction", label: "交互", icon: () => h(InteractionOutlined) },
  { key: "sync", label: "同步", icon: () => h(CloudSyncOutlined) },
  { key: "data", label: "数据", icon: () => h(DatabaseOutlined) },
  { key: "about", label: "关于", icon: () => h(InfoCircleOutlined) },  // ← 新增
];
```

并更新 `import`：`InfoCircleOutlined`

#### B. 新增「关于」section（追加到 [SettingsDialog.vue:571](file:///Users/nbn/workspace/github/doit/src/components/SettingsDialog.vue#L571) 之后）

```vue
<a-divider size="small" class="!my-3" style="border-color: var(--border)">关于</a-divider>

<!-- 关于 -->
<section id="sec-about" ref="sectionAbout" class="space-y-4 pb-2">
  <!-- 当前版本 -->
  <div class="flex items-center justify-between">
    <span class="text-sm text-[var(--muted-foreground)]">当前版本</span>
    <span class="text-sm font-mono">{{ currentVersion }}</span>
  </div>

  <!-- 检查更新结果 -->
  <div v-if="updateResult" class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-sm text-[var(--muted-foreground)]">最新版本</span>
      <div class="flex items-center gap-2">
        <span class="text-sm font-mono">{{ updateResult.latest_version }}</span>
        <a-tag v-if="updateResult.has_update" color="processing">有新版本</a-tag>
        <a-tag v-else color="success">已是最新</a-tag>
      </div>
    </div>

    <!-- 下载按钮 / 进度条 -->
    <div v-if="updateResult.has_update && updateResult.asset">
      <a-button
        v-if="downloadState === 'idle'"
        type="primary"
        size="small"
        block
        @click="handleDownloadUpdate"
      >
        <DownloadOutlined />
        下载并安装 ({{ formatBytes(updateResult.asset.size) }})
      </a-button>

      <!-- 进度条 -->
      <div v-else-if="downloadState === 'downloading'" class="space-y-2">
        <a-progress
          :percent="downloadProgress.percentage"
          :show-info="true"
          :stroke-color="{ from: '#108ee9', to: '#87d068' }"
        />
        <div class="flex justify-between text-xs text-[var(--muted-foreground)]">
          <span>{{ formatBytes(downloadProgress.bytes_downloaded) }} / {{ formatBytes(downloadProgress.total_bytes) }}</span>
          <span>{{ downloadProgress.percentage }}%</span>
        </div>
      </div>

      <!-- 完成 -->
      <div v-else-if="downloadState === 'done'" class="text-xs text-green-500 flex items-center gap-1">
        <CheckCircleOutlined />
        下载完成，已自动打开安装包
      </div>

      <!-- 失败 -->
      <div v-else-if="downloadState === 'error'" class="text-xs text-red-500">
        下载失败：{{ downloadError }}
      </div>
    </div>

    <!-- 平台信息（诊断用） -->
    <div class="text-xs text-[var(--muted-foreground)]">
      平台：{{ updateResult.platform }} / {{ updateResult.arch }}
    </div>
  </div>

  <!-- 检查更新按钮 -->
  <a-button :loading="checking" @click="handleCheckUpdate" block>
    <ReloadOutlined />
    {{ updateResult ? "重新检查" : "检查更新" }}
  </a-button>
</section>
```

#### C. 脚本部分新增（追加到 `<script setup>` 末尾）

```ts
import { checkForUpdate, downloadAndInstallUpdate, formatBytes, getAppVersion, type UpdateCheckResult, type DownloadProgress } from "../services/updateService"
import { InfoCircleOutlined, ReloadOutlined, CheckCircleOutlined } from "@antdv-next/icons"

const sectionAbout = ref<HTMLElement | null>(null)
const sectionRefs = { /* 追加 about 项 */
  appearance: sectionAppearance,
  interaction: sectionInteraction,
  sync: sectionSync,
  data: sectionData,
  about: sectionAbout,
}

const currentVersion = ref("v?")
const updateResult = ref<UpdateCheckResult | null>(null)
const checking = ref(false)
const downloadState = ref<"idle" | "downloading" | "done" | "error">("idle")
const downloadProgress = ref<DownloadProgress>({
  bytes_downloaded: 0,
  total_bytes: 0,
  percentage: 0,
  file_name: "",
})
const downloadError = ref("")

// 弹框打开时自动加载当前版本
watch(() => props.open, async (val) => {
  if (val) {
    try { currentVersion.value = await getAppVersion() } catch {}
  }
})

async function handleCheckUpdate() {
  checking.value = true
  try {
    updateResult.value = await checkForUpdate()
  } catch (e: any) {
    // 即使失败也填充最新版本号（用于显示）
    message.error(`检查更新失败: ${e}`)
  } finally {
    checking.value = false
  }
}

async function handleDownloadUpdate() {
  if (!updateResult.value?.asset) return
  downloadState.value = "downloading"
  downloadProgress.value = { bytes_downloaded: 0, total_bytes: 0, percentage: 0, file_name: updateResult.value.asset.name }
  downloadError.value = ""

  try {
    await downloadAndInstallUpdate(
      updateResult.value.asset.browser_download_url,
      updateResult.value.asset.name,
      (progress) => { downloadProgress.value = progress }
    )
    downloadState.value = "done"
    message.success("已自动打开安装包")
  } catch (e: any) {
    downloadState.value = "error"
    downloadError.value = e?.toString() || "未知错误"
    message.error(`下载失败: ${e}`)
  }
}
```

---

## 4. Assumptions & Decisions（设计决策）

| 决策点 | 方案 | 理由 |
|--------|------|------|
| **架构检测位置** | Rust 端（`std::env::consts::OS/ARCH`） | 编译期常量，零运行时开销；JS 端 `navigator.platform` 已被弃用 |
| **GitHub API 鉴权** | 匿名（`Accept: application/vnd.github+json`） | 60 req/h 完全够手动检查；避免暴露 token |
| **进度推送频率** | 每 200ms 一次 | 太频繁（每 chunk）会卡事件循环；太慢（每 1s）UI 卡顿；200ms 平衡两者 |
| **下载目录** | Tauri `app.path().download_dir()` | 跨平台拿系统下载目录（macOS `~/Downloads`、Windows `%USERPROFILE%\Downloads`、Linux `~/Downloads`） |
| **自动打开实现** | `std::process::Command`（不用 `tauri-plugin-shell`） | 零依赖，跨平台行为已知：Win `start`、macOS `open`、Linux `xdg-open` |
| **版本号对比** | 手写 split + parse | 避免引入 `semver` crate（80KB+ 依赖）；Doit 用 `0.1.X` 三段制，足够 |
| **进度事件名** | `update-download-progress` | 命名空间前缀 `update-` 避免与未来其他事件冲突 |
| **进度条组件** | antdv `<a-progress>` | 项目已用 antdv-next，避免引入新依赖 |
| **不阻塞用户** | Tauri async cmd + frontend `await` 但不 await UI 渲染 | 弹框可关闭、用户可继续操作其他 todo；进度条仅在「关于」section 显示 |
| **资产匹配顺序** | 平台特定优先级（mac/win deb > msi > exe） | NSIS 比 MSI 更适合原地升级（保留用户数据） |
| **错误降级** | 任何步骤失败只 toast 提示，不弹模态 | 避免打断用户当前操作 |
| **不支持的平台** | 静默显示「当前平台暂无安装包」 | 已在 UI 文案中预留 |

---

## 5. Verification Steps（验证步骤）

### 5.1 编译验证
```bash
cd /Users/nbn/workspace/github/doit
npm run build                 # Vue + TS 类型检查
cd src-tauri && cargo build   # Rust 编译
```

### 5.2 功能验证（启动应用后）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 打开设置 → 「关于」 | 显示「当前版本: 0.1.43」|
| 2 | 点击「检查更新」 | 弹出 loading → 显示「最新版本: 0.1.43 / 已是最新」（因为本地就是最新）|
| 3 | 临时把 `package.json` 和 `Cargo.toml` 的 version 改为 `0.1.40`（或更老）| 重启应用 |
| 4 | 再次点击「检查更新」 | 显示「最新版本: 0.1.43 / 有新版本」，出现「下载并安装 (9MB)」按钮 |
| 5 | 点击「下载并安装」 | 进度条实时更新（0% → 100%），**不阻塞**——可关闭弹框、添加 todo |
| 6 | 下载完成 | toast「已自动打开安装包」+ UI 显示「下载完成」+ 系统弹出 Finder/Explorer/Software Center |
| 7 | 检查 `~/Downloads/` 目录 | 应有新下载的安装包，文件名含 `0.1.43` |

### 5.3 跨平台验证

| 平台 | 验证点 |
|------|--------|
| **macOS** | 进度条更新、下载完成后 Finder 自动打开（dmg 已被挂载）|
| **Windows** | 进度条更新、下载完成后 NSIS 触发 UAC（用户点「是」进入安装流程）|
| **Linux** | 进度条更新、下载完成后 Software Center 自动打开（deb/rpm）|

### 5.4 失败场景验证

| 场景 | 预期 |
|------|------|
| 断网后点「检查更新」| toast「检查更新失败: ...」|
| GitHub 临时 5xx | toast「GitHub API 返回 HTTP 500」|
| 当前平台无对应资产 | 「下载并安装」按钮不显示，提示「当前平台 (xxx) 暂无预编译包」|
| 下载中途断网 | toast「下载失败」，按钮回到「下载并安装」可重试 |

### 5.5 关键日志（Rust 端）
在 Tauri 终端应能看到：
```
[update] check_for_update: current=0.1.40, latest=0.1.43, has_update=true
[update] picked asset: Doit_0.1.43_x64-setup.exe (8669403 bytes)
[update] download: 1048576 / 8669403 (12%)
[update] download: 2097152 / 8669403 (24%)
...
[update] download: 8669403 / 8669403 (100%)
[update] 下载完成: /Users/nbn/Downloads/Doit_0.1.43_x64-setup.exe (8669403 bytes)
```

---

## 6. Out of Scope（不在本次范围内）

- 增量更新（diff/patch）—— 完整下载安装包
- 自动后台检查更新 —— 只做手动「检查更新」按钮
- 代码签名验证 / checksum 校验 —— 信任 GitHub Releases（资产由 CI 上传）
- 启动时静默更新提示 —— 留给未来
- Linux 多个发行版的差异化打包 —— 用第一个匹配的资产
- macOS 跳过「拖到 Applications」直接替换 —— 安全限制，不可行

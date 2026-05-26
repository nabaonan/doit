# 项目迁移到 GitHub 并配置多平台构建流水线

## 目标

将 Doit 项目从 Gitee 迁移到 GitHub（`git@github.com:nabaonan/doit.git`），配置 GitHub Actions 自动构建流水线，实现打 tag 后自动构建多平台安装包并发布到 Release 页面供下载。

参考项目：[t8y2/dbx](https://github.com/t8y2/dbx/releases)

***

## 执行步骤

### Step 1: 移动项目目录

将项目从 `C:\Users\nbn\workspace\gitee\doit` 移动到 `C:\Users\nbn\workspace\github\doit`。

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\nbn\workspace\github"
Move-Item "C:\Users\nbn\workspace\gitee\doit" "C:\Users\nbn\workspace\github\doit"
cd C:\Users\nbn\workspace\github\doit
```

### Step 2: 修改 Git Remote

```powershell
git remote remove origin
git remote add origin git@github.com:nabaonan/doit.git
git remote -v
```

### Step 3: 创建 `.github/workflows/release.yml`

创建 GitHub Actions 工作流文件，触发条件为 `v*` 格式 tag 推送。

**工作流结构：**

```
push tag v* → release job
                │
                ├── Step 1: checkout (fetch-depth: 0)
                ├── Step 2: Setup Node.js 20
                ├── Step 3: Install npm dependencies
                ├── Step 4: Setup Rust toolchain (dtolnay/rust-toolchain@stable)
                ├── Step 5: Rust cache (swatinem/rust-cache@v2)
                ├── Step 6: Install Linux deps (libwebkit2gtk etc.) [Linux only]
                ├── Step 7: Generate Release Notes (gh api generate-notes)
                ├── Step 8: Build Tauri (tauri-apps/tauri-action@v0)
                │           └── releaseDraft: true, prerelease: false
                │           └── args: --target ${{ matrix.target }}
                └── Step 9: Upload portable ZIP [Windows only]
```

**多平台构建矩阵（6 个目标）：**

| Runner           | Target                      | 产物                     |
| ---------------- | --------------------------- | ---------------------- |
| `windows-latest` | `x86_64-pc-windows-msvc`    | `.exe` (NSIS), `.msi`  |
| `macos-latest`   | `x86_64-apple-darwin`       | `.dmg` (Intel)         |
| `macos-latest`   | `aarch64-apple-darwin`      | `.dmg` (Apple Silicon) |
| `ubuntu-latest`  | `x86_64-unknown-linux-gnu`  | `.deb`, `.AppImage`    |
| `ubuntu-latest`  | `aarch64-unknown-linux-gnu` | `.deb`, `.AppImage`    |

**关键差异 vs 原 Gitee 流水线：**

| 项目            | Gitee 原方案                 | GitHub 新方案                         |
| ------------- | ------------------------- | ---------------------------------- |
| Rust 工具链      | actions-rs/toolchain（已废弃） | dtolnay/rust-toolchain（官方推荐）       |
| Rust 缓存       | 无                         | swatinem/rust-cache\@v2            |
| Release 创建    | tauri-action 直接发布         | `releaseDraft: true`（先草稿后发布）       |
| Release Notes | 手动跑 generate-changelog.js | `gh api generate-notes`（GitHub 原生） |
| CI 文件         | `.gitee-ci.yml`           | `.github/workflows/release.yml`    |

### Step 4: 更新 package.json（如需）

确认 `package.json` 中 build 脚本适用于 CI。当前 `build: vue-tsc --noEmit && vite build` 已满足。

检查是否需要如下方的 `build:dmg` 脚本（macOS 特殊处理），当前可跳过：

```json
"build:dmg": "tauri build --bundles dmg --ci"
```

### Step 5: 清理旧 CI 文件

删除 `.gitee-ci.yml`（已不再需要）。

### Step 6: 提交并推送到 GitHub

```powershell
git add -A
git commit -m "build: 迁移到 GitHub Actions，配置多平台构建流水线"
git push -u origin master
```

### Step 7: 打 Tag 触发构建

```powershell
git tag -a v0.1.0 -m "v0.1.0: 首个 GitHub Release 版本"
git push origin v0.1.0
```

推送 tag 后，GitHub Actions 自动触发。可在 `https://github.com/nabaonan/doit/actions` 查看构建进度。

构建完成后进入 `https://github.com/nabaonan/doit/releases` —— Draft Release 已自动创建，包含：

* 各平台安装包附件（`.exe`、`.msi`、`.dmg`、`.deb`、`.AppImage`）

* 自动生成的 Release Notes（基于 commit 历史）

* 每个附件的 SHA256 checksum

手动点击 Publish Release 即可公开下载。

***

## Release 页面预期效果（对标 dbx）

```
## v0.1.0 (2026-05-26)

### 新功能
- Todo 桌面应用初始版本 (`abc1234` by @nabaonan)
- 极简便签风格界面，支持新增/编辑/删除/勾选完成 (`def5678` by @nabaonan)
- ...

### Bug 修复
- ...

### 下载安装

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `Doit_0.1.0_x64-setup.exe` | NSIS 安装包 |
| Windows | `Doit_0.1.0_x64_en-US.msi` | MSI 安装包 |
| macOS Intel | `Doit_0.1.0_x64.dmg` | Intel Mac |
| macOS Apple Silicon | `Doit_0.1.0_aarch64.dmg` | M1/M2/M3/M4 |
| Linux x64 | `doit_0.1.0_amd64.deb` | Ubuntu/Debian |
| Linux x64 | `doit_0.1.0_amd64.AppImage` | 通用 Linux |
| Linux ARM | `doit_0.1.0_arm64.deb` | ARM Linux |

Assets
- Doit_0.1.0_x64-setup.exe    sha256:...
- Doit_0.1.0_x64_en-US.msi    sha256:...
- Doit_0.1.0_aarch64.dmg      sha256:...
- Doit_0.1.0_x64.dmg          sha256:...
- doit_0.1.0_amd64.deb        sha256:...
- doit_0.1.0_amd64.AppImage   sha256:...
- doit_0.1.0_arm64.deb        sha256:...
- doit_0.1.0_arm64.AppImage   sha256:...
- Source code (zip)
- Source code (tar.gz)
```

***

## 关键 YouTube 配置要点

### tauri-action\@v0 参数

```yaml
with:
  tagName: ${{ github.ref_name }}
  releaseName: 'Doit ${{ github.ref_name }}'
  releaseBody: ${{ steps.release-notes.outputs.body }}
  releaseDraft: true        # 先创建草稿，人工确认后发布
  prerelease: false          # 正式版本
  args: --target ${{ matrix.target }}
```

### GitHub Release Notes 自动生成

使用 GitHub 原生 API（无需额外脚本）：

```bash
gh api "repos/${GITHUB_REPOSITORY}/releases/generate-notes" \
  -f tag_name="${GITHUB_REF_NAME}" \
  --jq '.body'
```

### 权限

```yaml
permissions:
  contents: write
```

内置于 workflow 文件顶部即可。

### Rust 缓存

```yaml
- uses: swatinem/rust-cache@v2
  with:
    workspaces: './src-tauri -> target'
    shared-key: release-${{ matrix.target }}
    cache-on-failure: true
```

***

## 注意事项

1. **GitHub 仓库必须已存在**：`nabaonan/doit` 需要先在 GitHub 上创建（公开仓库），否则 push 时报 404
2. **SSH Key**：确保本地已配置 GitHub SSH Key，否则 `git@github.com` 无法推送
3. **首次构建**：macOS 和 Linux ARM 目标需要交叉编译，首次 build 较慢（约 20-40 分钟），后续有缓存会加速
4. **代码签名**：当前不配置 macOS / Windows 代码签名（需要开发者证书），用户首次运行时会有系统安全提示
5. **GitHub Actions 计费**：公开仓库免费，无限制分钟数


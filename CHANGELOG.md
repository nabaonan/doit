# Changelog

## v0.1.19 (2026-05-30)

### 新功能

- 增加导出功能 (`b414404` by @内小子)
- 增加日期视图 (`f0aec77` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.18 (`a28fdf9` by @github-actions[bot])

### 构建/工具

- release v0.1.19 (`08444eb` by @内小子)
- release v0.1.18 (`bd59ce5` by @内小子)
- 替换字体文件 (`27bcf15` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`13dfc87` by @内小子)

---


## v0.1.18 (2026-05-30)

### 构建/工具

- release v0.1.18 (`3a9a6c1` by @内小子)
- 简化发布脚本流程 (`6c54f1c` by @内小子)
- release v0.1.17 (`ac1955c` by @内小子)
- 替换release脚本为独立的release.mjs (`14d4ca8` by @内小子)
- release v0.1.16 (`182dcf6` by @内小子)
- 修复release脚本的标签推送问题 (`bedfca6` by @内小子)
- release v0.1.15 (`4173ba9` by @内小子)
- 同步版本号到Cargo.lock文件 (`440cd39` by @内小子)
- release v0.1.14 (`ee6ab38` by @内小子)
- 更新依赖版本并修复发布流程 (`e98a985` by @内小子)

---


## v0.1.12 (2026-05-28)

### 构建/工具

- release v0.1.12 (`49cc802` by @内小子)
- 移除pnpmlock (`e7a0504` by @内小子)

---


## v0.1.4 (2026-05-26)

### 文档更新

- 更新 Changelog for v0.1.3 (`e791723` by @github-actions[bot])

### 构建/工具

- release v0.1.4 (`0ee3e35` by @内小子)
- bump version to 0.1.3 (`90dd243` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`dae307e` by @内小子)

---


## v0.1.3 (2026-05-26)

### 文档更新

- 更新 Changelog for v0.1.2 (`bbdbaad` by @github-actions[bot])

### 构建/工具

- release v0.1.3 (`af56eeb` by @内小子)
- 发布v0.1.2版本，同步版本号并完善配置 (`1b9b870` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`5831f4d` by @内小子)

---


## v0.1.2 (2026-05-26)

### Bug 修复

- 提交lock (`e0df2d4` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.1 (`697905e` by @github-actions[bot])

### 构建/工具

- release v0.1.2 (`4177597` by @内小子)
- add release and fix build:dmg script format (`a37c607` by @内小子)
- 升级依赖并替换lucide-vue-next为@lucide/vue (`a694d5c` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`730d0ef` by @内小子)

---


## v0.1.1 (2026-05-26)

### 新功能

- add todo tag management feature (`be0a57c` by @nabaonan)
- 新增主题切换和添加待办快捷键功能 (`8398fda` by @nabaonan)
- add default capabilities schema file (`8387625` by @内小子)
- Todo 桌面应用初始版本 (`8a3be6d` by @内小子)
- 初始化 Doit 待办事项桌面应用 (`fb9dcf9` by @内小子)

### Bug 修复

- 用 Node.js 脚本替代 bash 生成 release notes，解决 Windows runner 兼容性问题 (`34cdc07` by @内小子)
- 修复 icon.ico 非标准 ICO 格式导致 Windows RC.EXE 编译失败 (`52f0631` by @内小子)
- 修复 CI 跨平台兼容性问题 - Generate release notes 添加 shell:bash，移除不支持的 aarch64-linux 目标 (`2164fc2` by @内小子)
- 更改打包指令 (`b1b55fe` by @nabaonan)
- 增加打包脚本 (`ad5a737` by @nabaonan)

### 重构

- 调整拖拽配置并修复快捷键监听 (`4e859c3` by @nabaonan)

### 文档更新

- 添加 AGENT.md 和 CLAUDE.md 开发规范文档 (`19ced36` by @内小子)

### 构建/工具

- 统一版本号至 0.1.1，Release 改为正式发布，新增自动 Changelog 和分类 Release Notes (`2e9b52d` by @内小子)
- 迁移到 GitHub Actions，配置多平台构建流水线 (`9337c6f` by @内小子)
- 添加sharp依赖并新增图标生成脚本 (`f488c08` by @nabaonan)
- add lightningcss dependency and adjust its package metadata (`3608d94` by @nabaonan)
- 添加应用图标文件和图标生成脚本 (`e3507e2` by @内小子)

---


## v0.1.1 (2026-05-26)

### 新功能

- add todo tag management feature (`be0a57c` by @nabaonan)
- 新增主题切换和添加待办快捷键功能 (`8398fda` by @nabaonan)
- add default capabilities schema file (`8387625` by @内小子)
- Todo 桌面应用初始版本 (`8a3be6d` by @内小子)
- 初始化 Doit 待办事项桌面应用 (`fb9dcf9` by @内小子)

### Bug 修复

- 修复 icon.ico 非标准 ICO 格式导致 Windows RC.EXE 编译失败 (`52f0631` by @内小子)
- 修复 CI 跨平台兼容性问题 - Generate release notes 添加 shell:bash，移除不支持的 aarch64-linux 目标 (`2164fc2` by @内小子)
- 更改打包指令 (`b1b55fe` by @nabaonan)
- 增加打包脚本 (`ad5a737` by @nabaonan)

### 重构

- 调整拖拽配置并修复快捷键监听 (`4e859c3` by @nabaonan)

### 文档更新

- 添加 AGENT.md 和 CLAUDE.md 开发规范文档 (`19ced36` by @内小子)

### 构建/工具

- 迁移到 GitHub Actions，配置多平台构建流水线 (`9337c6f` by @内小子)
- 添加sharp依赖并新增图标生成脚本 (`f488c08` by @nabaonan)
- add lightningcss dependency and adjust its package metadata (`3608d94` by @nabaonan)
- 添加应用图标文件和图标生成脚本 (`e3507e2` by @内小子)

---


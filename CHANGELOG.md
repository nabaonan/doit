# Changelog

## v0.1.48 (2026-07-15)

### Bug 修复

- 修复今日待办逻辑 (`e4892cc` by @nabaonan)
- 修复编辑状态无法选择的问题 (`48468b2` by @nabaonan)

### 文档更新

- 更新 Changelog for v0.1.47 (`5bafef1` by @github-actions[bot])

### 构建/工具

- release v0.1.48 (`ac97169` by @nabaonan)

---


## v0.1.47 (2026-07-02)

### 新功能

- 增加时间轴视图展示 (`3e32a53` by @nabaonan)
- 为父任务添加展开/收起功能 (`96f3e6b` by @nabaonan)

### 文档更新

- 更新 Changelog for v0.1.46 (`3c1369d` by @github-actions[bot])

### 构建/工具

- release v0.1.47 (`59c801b` by @nabaonan)

---


## v0.1.46 (2026-06-24)

### 新功能

- 增加热力图和环形统计图 (`f6c2e63` by @nabaonan)
- 实现报告预览框Markdown渲染 (`a421689` by @nabaonan)

### Bug 修复

- 修复周报没有显示未完成的项目 (`2c204a5` by @nabaonan)
- 修复没有启动加载数据的问题 (`79cbafa` by @nabaonan)

### 文档更新

- 增加截图 (`9169652` by @nabaonan)
- 更新 Changelog for v0.1.45 (`c702099` by @github-actions[bot])

### 构建/工具

- release v0.1.46 (`35096f4` by @nabaonan)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`4c25ecc` by @nabaonan)
- Merge branch 'main' of github.com:nabaonan/doit (`10ddf26` by @nabaonan)

---


## v0.1.45 (2026-06-23)

### 重构

- 优化任务过滤逻辑，按第一级任务状态处理跨天显示 (`31fd2f1` by @nabaonan)

### 文档更新

- 更新 Changelog for v0.1.44 (`f0ff6f0` by @github-actions[bot])

### 构建/工具

- release v0.1.45 (`45d5c01` by @nabaonan)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`c9c3174` by @nabaonan)

---


## v0.1.44 (2026-06-21)

### 新功能

- 添加应用内自动更新功能 (`8ba0927` by @nabaonan)
- 增加自动清理备份数量的设置 (`8d26e0f` by @nabaonan)
- 增加关闭时候同步的提示 (`c4d5361` by @nabaonan)
- 报告支持分类选择 (`7434ce3` by @nabaonan)
- 增加默认分类 (`94aac3f` by @nabaonan)

### Bug 修复

- 消除警告 (`4d60309` by @nabaonan)

### 重构

- 优化默认分类应用逻辑 (`ac5c1ec` by @nabaonan)

### 样式调整

- 统一配置侧边菜单的样式参数 (`17e0f5e` by @nabaonan)
- 优化WebDAV连接测试区域UI布局 (`efb11ad` by @nabaonan)

### 文档更新

- 更新 Changelog for v0.1.43 (`1b8a2e4` by @github-actions[bot])

### 构建/工具

- release v0.1.44 (`ea8f9c9` by @nabaonan)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`afb90bd` by @nabaonan)

---


## v0.1.43 (2026-06-21)

### 新功能

- 独立标签设置，增加编辑标签的功能 (`894ad3e` by @nabaonan)

### 重构

- 提取通用删除逻辑到ColorLabelRow组件 (`4f06095` by @nabaonan)
- 重构分类/标签管理弹窗，复用颜色标签组件 (`870455d` by @nabaonan)
- 优化标签编辑交互与代码结构 (`e3e4428` by @nabaonan)
- 重构设置弹窗为左右分栏布局，配置unplugin-vue-components实现antdv组件自动导入 (`fe7433f` by @nabaonan)

### 文档更新

- 更新 Changelog for v0.1.42 (`adb847f` by @github-actions[bot])

### 构建/工具

- release v0.1.43 (`6b7640c` by @内小子)
- release v0.1.42 (`669d803` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`d8695d5` by @内小子)

---


## v0.1.42 (2026-06-19)

### 新功能

- 增加嗲办事项倒计时显示 (`472f193` by @nabaonan)
- 新增待办事项定时提醒功能 (`5df345a` by @nabaonan)

### 样式调整

- 优化倒计时样式 (`22d0cc9` by @nabaonan)

### 文档更新

- 更新 Changelog for v0.1.41 (`9c3be03` by @github-actions[bot])

### 构建/工具

- release v0.1.42 (`f1f5c07` by @nabaonan)

---


## v0.1.41 (2026-06-19)

### 新功能

- 增加定时任务备份和恢复 (`7839e5d` by @内小子)
- 实现完整的WebDAV云同步功能 (`ace35b3` by @内小子)

### Bug 修复

- 修改ui顶部显示图标 (`dca3b51` by @内小子)
- 修复webdav恢复的问题 (`7f8d822` by @内小子)
- sqllite备份能力，优化数据库路径诊断与迁移 (`bae6b2a` by @内小子)
- 修复排序问题并优化空内容子任务处理 (`f318d3e` by @内小子)

### 重构

- 重构数据库备份同步逻辑，修复重复表问题 (`1cd8f93` by @内小子)
- 迁移数据库备份逻辑到Rust侧，优化上传下载流程 (`e75373d` by @内小子)
- 重构云同步逻辑，改用直接备份SQLite数据库 (`bc351b0` by @内小子)

### 样式调整

- 优化样式 (`304ff65` by @内小子)
- 替换全局字体引入为自定义font-face配置 (`b6052e0` by @内小子)

### 文档更新

- 去掉ip显示 (`5be421d` by @内小子)
- 更新 Changelog for v0.1.40 (`4b75b5e` by @github-actions[bot])

### 构建/工具

- release v0.1.41 (`2da95e5` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`30d0438` by @内小子)

---


## v0.1.40 (2026-06-17)

### 新功能

- 新增sql.js支持，实现浏览器端SQLite备份导入导出 (`c518609` by @内小子)

### 重构

- 合并重复的删除SQL语句 (`eb3bb34` by @内小子)
- 调整DELETE语句处理逻辑顺序并提取重复代码 (`7c61ed0` by @内小子)
- 移除tauriEnv.ts并重构数据存储逻辑 (`fcb4fca` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.39 (`cec671f` by @github-actions[bot])

### 构建/工具

- release v0.1.40 (`01db94d` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`52b3afc` by @内小子)

---


## v0.1.39 (2026-06-16)

### Bug 修复

- 修复子任务分类继承和列表排序问题 (`f13b2ef` by @内小子)
- 修改在某个分类下添加待办则属于某个分类 (`b9177a1` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.38 (`8542b9e` by @github-actions[bot])

### 构建/工具

- release v0.1.39 (`bf7aece` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`9c1c93c` by @内小子)

---


## v0.1.38 (2026-06-16)

### Bug 修复

- 修复快速点击checkbox无法勾选的问题 (`94bea8b` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.37 (`ca7618b` by @github-actions[bot])

### 构建/工具

- release v0.1.38 (`1914f7f` by @内小子)

### 其他变更

- Merge branches 'main' and 'main' of github.com:nabaonan/doit (`276def4` by @内小子)

---


## v0.1.37 (2026-06-16)

### Bug 修复

- 修复待办事项无法选中的问题 (`96568e8` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.36 (`cd71e12` by @github-actions[bot])

### 构建/工具

- release v0.1.37 (`2edac11` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`b7de267` by @内小子)

---


## v0.1.36 (2026-06-07)

### 新功能

- 新增WebDAV云备份功能 (`40d8786` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.35 (`120d90b` by @github-actions[bot])

### 构建/工具

- release v0.1.36 (`790237b` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`da7174c` by @内小子)

---


## v0.1.35 (2026-06-07)

### Bug 修复

- 修复Tauri环境下数据库导出逻辑 (`f8e038c` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.34 (`0cfa065` by @github-actions[bot])

### 构建/工具

- release v0.1.35 (`81ab4ca` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`ed125c7` by @内小子)

---


## v0.1.34 (2026-06-07)

### Bug 修复

- 优化弹框两次的问题 (`655ee86` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.33 (`1de2a2f` by @github-actions[bot])

### 构建/工具

- release v0.1.34 (`3302225` by @内小子)

---


## v0.1.33 (2026-06-06)

### Bug 修复

- 修复构建报错 (`0f78655` by @内小子)

### 构建/工具

- release v0.1.33 (`13e460a` by @内小子)

---


## v0.1.31 (2026-06-06)

### 新功能

- 增加导入导出 (`e70b3a0` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.30 (`37fbb7e` by @github-actions[bot])

### 构建/工具

- release v0.1.31 (`b28e3eb` by @内小子)

---


## v0.1.30 (2026-06-03)

### 新功能

- 增加分类功能 (`52ac52c` by @内小子)

### Bug 修复

- 优化今日待办时间导致的显示问题 (`1ace987` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.29 (`b8c4483` by @github-actions[bot])

### 构建/工具

- release v0.1.30 (`2d36173` by @内小子)
- 新增minor版本发布支持 (`ed6991d` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`634ff8c` by @内小子)

---


## v0.1.29 (2026-06-02)

### Bug 修复

- 添加Windows NSIS安装包图标配置 (`f4969bc` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.28 (`29d56f3` by @github-actions[bot])

### 构建/工具

- release v0.1.29 (`cad02cc` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`65c46b6` by @内小子)

---


## v0.1.28 (2026-06-02)

### 文档更新

- 更新 Changelog for v0.1.27 (`b347aec` by @github-actions[bot])

### 构建/工具

- release v0.1.28 (`3965215` by @内小子)
- 重写图标生成脚本并更新所有应用图标 (`597fd8e` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`e4e38c5` by @内小子)

---


## v0.1.27 (2026-06-02)

### 新功能

- 添加清空待办数据功能，优化子任务快捷键支持 (`42051f8` by @内小子)

### Bug 修复

- 修复win平台图标显示不对的问题 (`741339b` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.26 (`af13241` by @github-actions[bot])

### 构建/工具

- release v0.1.27 (`431c771` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`b50e926` by @内小子)

---


## v0.1.26 (2026-06-01)

### Bug 修复

- 筛选今日未完成和今日已完成的待办事项 (`57c40fe` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.25 (`0f7622c` by @github-actions[bot])

### 构建/工具

- release v0.1.26 (`92642ea` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`ce692fc` by @内小子)

---


## v0.1.25 (2026-06-01)

### 新功能

- 增加版本对比链接 (`f410093` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.24 (`cfd5e63` by @github-actions[bot])

### 构建/工具

- release v0.1.25 (`9002052` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`7467742` by @内小子)

---


## v0.1.24 (2026-06-01)

### Bug 修复

- 修复已完成待办筛选逻辑并添加嵌套子任务展示 (`be01111` by @内小子)
- 修复待办项点击完成后的UI更新和点击错位问题 (`a7206c4` by @内小子)

### 样式调整

- 全局化滚动条样式，移除冗余自定义类 (`82483bb` by @内小子)

### 文档更新

- 更新README文档，补充功能说明与截图 (`82008cc` by @内小子)
- 更新 Changelog for v0.1.23 (`2e7612f` by @github-actions[bot])

### 构建/工具

- release v0.1.24 (`ee40f7a` by @内小子)

---


## v0.1.23 (2026-05-31)

### 新功能

- 实现嵌套todo拖拽功能并修复多项bug (`b5d1396` by @内小子)
- 支持子任务创建 (`c22fba9` by @内小子)

### Bug 修复

- 解决无限层级嵌套问题 (`5d7b3c2` by @内小子)
- 完善父子任务拖拽错乱问题 (`0a9e318` by @内小子)
- 修复总是显示暂无标签的tag选项 (`3c9e240` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.22 (`44d42b6` by @github-actions[bot])

### 构建/工具

- release v0.1.23 (`cdcafeb` by @内小子)

### 其他变更

- Merge branch 'main' of github.com:nabaonan/doit (`c2bfc5a` by @内小子)

---


## v0.1.22 (2026-05-31)

### Bug 修复

- 添加全平台所需的应用图标资源，包括Windows、iOS、Android各尺寸适配图标以及替换了原有图标文件 (`897a752` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.21 (`4826a32` by @github-actions[bot])

### 构建/工具

- release v0.1.22 (`ec48d3b` by @内小子)

---


## v0.1.21 (2026-05-31)

### 重构

- 替换系统主题检测逻辑为北京时间时段判断 (`a202cc8` by @内小子)

### 样式调整

- 移除待办计数展示并调整侧边栏宽度 (`2af97ae` by @内小子)
- 为侧边菜单添加自定义滚动条样式 (`2fca1dd` by @内小子)
- 调整布局样式和菜单样式 (`95c1ba7` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.20 (`d5ab009` by @github-actions[bot])

### 构建/工具

- release v0.1.21 (`73f0367` by @内小子)
- 配置dayjs为中文本地化 (`cc14f6e` by @内小子)

---


## v0.1.20 (2026-05-30)

### Bug 修复

- 修复导出问题 (`4f9daa6` by @内小子)

### 文档更新

- 更新 Changelog for v0.1.19 (`9abddec` by @github-actions[bot])

### 构建/工具

- release v0.1.20 (`d92e91d` by @内小子)

---


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


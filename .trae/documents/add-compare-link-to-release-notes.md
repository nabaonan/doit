# 在 Release Notes 末尾增加版本对比链接

## 目标

在 GitHub Release 的 release notes 末尾，自动追加一个从上一个版本到当前版本的提交对比链接，方便用户点击跳转查看所有提交记录。

例如：
```
**完整变更记录**: [v0.1.22...v0.1.23](https://github.com/nabaonan/doit/compare/v0.1.22...v0.1.23)
```

## 分析

### 当前流程

1. CI 触发 `release.yml` → 运行 `scripts/generate-release-notes.mjs`
2. 该脚本获取当前 tag（`GITHUB_REF_NAME`）和上一个 tag
3. 解析两个 tag 之间的 commit messages，分类生成 release notes
4. 通过 `GITHUB_OUTPUT` 输出 `body` 变量
5. `tauri-action` 使用 `releaseBody: ${{ steps.release-notes.outputs.body }}` 创建 Release

### 关键信息

- GitHub 仓库: `nabaonan/doit`
- 当前 tag: `process.env.GITHUB_REF_NAME`（如 `v0.1.23`）
- 上一个 tag: 脚本中已通过 `git tag --sort=-v:refname` 获取到 `prevTag`
- GitHub compare URL 格式: `https://github.com/nabaonan/doit/compare/{prevTag}...{currentTag}`

## 修改步骤

### 步骤 1: 修改 `scripts/generate-release-notes.mjs`

在生成 release notes body 的末尾，追加版本对比链接：

- 如果存在 `prevTag`，追加一行：
  ```
  \n---\n**完整变更记录**: [${prevTag}...${tagName}](https://github.com/nabaonan/doit/compare/${prevTag}...${tagName})
  ```
- 如果不存在 `prevTag`（首个版本），则不追加

### 步骤 2: 验证

- 检查脚本逻辑：确保 `prevTag` 排除当前 tag 的逻辑正确
- 确认 URL 格式正确

## 涉及文件

- `scripts/generate-release-notes.mjs` — 唯一需要修改的文件

# 分类筛选与分类管理功能计划

## 概述

在 Doit 顶部栏右侧增加分类下拉筛选和分类管理功能。使用新增的 `catId` 属性（而非现有的 `tagId`）实现按分类筛选待办列表，以及独立的分类管理弹窗。

---

## 当前状态分析

- **已有标签系统**: `Tag { id, name, color }` 定义在 `src/types/index.ts`，`TodoItem.tagId` 作为外键，`AppSettings.tags` 存储标签列表
- **已有标签管理**: 在 `SettingsDialog.vue` 中可以添加/删除标签
- **已有标签赋值**: 在 `TodoItem.vue` 右键菜单中可设置标签
- **缺少的功能**: 没有按分类筛选待办的 UI，没有独立的分类管理入口
- **顶部栏布局**: `TitleBar.vue` 右侧已有报告和设置两个图标按钮

**关键决策**: 不使用现有的 `tagId`/`tags` 体系，而是新增 `catId` 属性和独立的 `categories` 配置，与标签系统完全解耦。

---

## 变更方案

### 1. `src/types/index.ts` — 新增 Category 数据模型

**变更**:
- 新增 `Category` 接口: `{ id: string, name: string, color: string }`
- `TodoItem` 新增 `catId: string | null` 字段
- `TodoItemNode` 同步新增 `catId` 字段
- `AppSettings` 新增 `categories: Category[]` 字段

### 2. `src/services/todoService.ts` — 数据库 schema 增加 cat_id 列

**变更**:
- SQLite `CREATE TABLE` 增加 `cat_id TEXT` 列
- `getAllTodos()` 的 SQL SELECT 和映射增加 `cat_id` → `catId`
- `addTodo()` 的 INSERT 增加 `cat_id` 参数
- `updateTodo()` 的 SET 子句增加 `catId` → `cat_id` 映射
- localStorage 存储自动包含新字段（JSON 序列化天然支持）

### 3. `src/App.vue` — 新增分类筛选状态与逻辑

**变更**:
- 新增 `selectedCatId: ref<string | null>(null)` — 当前选中的分类 ID
- 新增 `showCategoryDialog: ref(false)` — 分类管理弹窗可见性
- 修改 `activeTodos` computed — 当 `selectedCatId` 不为 `null` 时，按 `catId` 过滤
- 新增 `handleSelectCat(catId: string | null)` 方法
- 新增 `handleSaveCategories(cats: Category[])` 方法 — 更新 settings 中的 categories
- 向 `TitleBar` 传递 `categories`、`selectedCatId`，监听 `select-cat`、`manage-categories`
- 添加 `CategoryDialog` 组件

### 4. `src/components/TitleBar.vue` — 新增分类下拉 + 管理按钮

**变更**:
- 新增 props: `categories: Category[]`, `selectedCatId: string | null`
- 新增 emits: `select-cat(catId: string | null)`, `manage-categories()`
- 在右侧按钮组中（报告按钮左侧）增加：
  - **分类下拉选择器** (`a-select`): 选项为"全部分类" + 各分类（显示 colored dot + 名称），选中后 emit `select-cat`
  - **分类管理按钮** (`a-button` type="text" shape="circle"): 图标按钮，点击 emit `manage-categories`

### 5. `src/components/CategoryDialog.vue` — 新建分类管理弹窗

**Props**:
- `open: boolean`
- `categories: Category[]`

**Emits**:
- `update:open(open: boolean)`
- `save(categories: Category[])`

**UI**:
- 使用 `a-modal`，标题"分类管理"，宽度 420px
- 添加区域：颜色选择器（16 色预设）+ 输入框 + 添加按钮
- 分类列表：**列表样式**（非 tag 标签样式），每行显示 colored dot + 分类名称，右侧有删除按钮
- 空状态提示
- 底部：取消 + 保存按钮

### 6. `src/components/TodoItem.vue` — 显示分类标签

**变更**:
- 新增 `currentCategory` computed — 根据 `todo.catId` 从 `settings.categories` 查找
- 在模板中，在现有 `currentTag` 旁边显示分类 colored dot + 名称
- 右键菜单中"设置标签"保持不变（标签和分类是两个独立体系）

---

## 数据流

```
TitleBar (分类下拉选择)
  │ emit select-cat(catId)
  ▼
App.vue (selectedCatId 更新)
  │ activeTodos computed 重新计算（按 catId 过滤）
  ▼
TodoList (只显示过滤后的待办)

TitleBar (分类管理按钮)
  │ emit manage-categories
  ▼
App.vue (showCategoryDialog = true)
  │
  ▼
CategoryDialog (编辑分类)
  │ emit save(categories)
  ▼
App.vue (handleSaveCategories → saveSettings → 刷新)
```

---

## 具体实现步骤

### Step 1: 修改 `src/types/index.ts`
- 新增 `Category` 接口
- `TodoItem` 增加 `catId: string | null`
- `TodoItemNode` 增加 `catId: string | null`
- `AppSettings` 增加 `categories: Category[]`

### Step 2: 修改 `src/services/todoService.ts`
- SQLite schema 增加 `cat_id TEXT`
- 所有 SQL 查询/写入增加 `cat_id` 字段映射

### Step 3: 修改 `src/App.vue`
- 新增状态、computed 过滤、事件处理、模板

### Step 4: 修改 `src/components/TitleBar.vue`
- 新增 props/emits、下拉选择器、管理按钮

### Step 5: 新建 `src/components/CategoryDialog.vue`
- 分类管理弹窗，分类列表用 list 样式，每行右侧有删除按钮

### Step 6: 修改 `src/components/TodoItem.vue`
- 显示分类标签

### Step 7: 验证
- `npm run build` 确保类型检查通过

---

## 涉及文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/index.ts` | 修改 | 新增 `Category` 接口，`TodoItem`/`TodoItemNode` 增加 `catId`，`AppSettings` 增加 `categories` |
| `src/services/todoService.ts` | 修改 | SQLite schema 和所有 SQL 操作增加 `cat_id` 列 |
| `src/App.vue` | 修改 | 新增分类筛选状态、computed 过滤、事件处理、模板 |
| `src/components/TitleBar.vue` | 修改 | 新增分类下拉选择器 + 管理按钮 |
| `src/components/CategoryDialog.vue` | 新建 | 分类管理弹窗，列表样式 + 每行删除按钮 |
| `src/components/TodoItem.vue` | 修改 | 显示分类标签 |

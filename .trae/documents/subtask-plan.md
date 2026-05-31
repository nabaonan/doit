# 子任务功能实现计划

## 核心约束

- 只支持一层嵌套：子任务不能再有子任务
- 子任务有自己的 checkbox，可独立勾选
- 子任务可被拖拽到其他父任务下
- 父任务 checkbox 由子任务状态自动决定，不可手动变更

---

## 数据模型变更

### 1. `src/types/index.ts` — TodoItem 增加 `parentId` 字段

```ts
export interface TodoItem {
  id: string
  content: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  tagId: string | null
  parentId: string | null  // 新增：null=顶层任务，非null=子任务
}
```

### 2. `src/services/todoService.ts` — 数据库/存储层适配

- SQLite 建表语句增加 `parent_id TEXT` 列
- `getAllTodos()` 映射 `parent_id` → `parentId`
- `addTodo()` 插入时包含 `parent_id`
- `updateTodo()` 支持 `parentId` 字段更新
- `deleteTodo()` 删除父任务时级联删除所有子任务
- **排序逻辑调整**：`sortTodos()` 需要按 `parentId` 分组排序——先排顶层任务，每个顶层任务后面紧跟其子任务。子任务之间按 `order` 排序。

---

## 业务逻辑

### 3. 父任务完成状态自动控制

- **判定规则**：父任务有子任务时，其 `completed` 完全由子任务决定
  - 所有子任务都完成 → 父任务自动标记为完成
  - 任一子任务未完成 → 父任务自动标记为未完成
- **实现位置**：`App.vue` 的 `handleToggleComplete`
  - 子任务 toggle 后，查找父任务，检查所有子任务状态，同步更新父任务 `completed`
  - 父任务自身的 checkbox 标记为 `disabled`（有子任务时不可手动点击）

### 4. 新增子任务

- 右键菜单增加"子任务"选项（仅顶层任务 `parentId === null` 显示）
- 点击后在当前父任务下方添加一个缩进的空子任务项
- 子任务 `parentId` 指向父任务

### 5. 删除逻辑

- 删除父任务时，级联删除所有 `parentId` 指向它的子任务
- 删除子任务时，仅删除该子任务，同时更新父任务完成状态

### 6. 拖拽逻辑

- 子任务和顶层任务在同一个 draggable 列表中
- 子任务在列表中紧随其父任务，有缩进视觉效果
- 拖拽子任务到另一个父任务位置时，更新其 `parentId`
- 拖拽结束时，重新计算所有任务的 `order`
- 拖拽顺序规则：`onDragEnd` 中根据最终列表位置重新分配 `order`，同时智能推断 `parentId`（如果被拖到另一个父任务下方，则归属该父任务）

---

## 组件变更

### 7. `src/components/TodoItem.vue`

- 右键菜单增加 `{ key: "subtask", label: "子任务", icon: h(PlusOutlined) }`（仅当 `!todo.parentId` 时显示）
- 新增 prop `hasChildren: boolean`（是否有子任务，用于判断 checkbox 是否 disabled）
- 新增 emit `add-sub-todo`
- 父任务 checkbox：
  - 有子任务时：`disabled`，`checked` 由 App.vue 传入（已经由子任务状态计算）
  - 无子任务时：正常可点击
- 子任务条目：左侧缩进 `pl-8`，有一根竖线连接装饰（`border-l-2 border-[var(--border)]`）
- 子任务条目显示正常 checkbox，无"子任务"右键菜单项

### 8. `src/components/TodoList.vue`

- 不再区分"顶层/子任务"分别渲染，**所有任务**（顶层 + 子任务）都在同一个 `draggableList` 中
- 列表构建：遍历 `props.todos`，按 `parentId` 分组构建扁平列表（父任务 → 子任务 → 下一个父任务...）
- 向 `TodoItem` 传递：
  - `hasChildren`：是否有子任务
  - `isSubTask`：是否为子任务（用于缩进显示）
- 新增 emit `add-sub-todo`，向上传递到 App.vue
- `onDragEnd`：根据拖拽后列表顺序，重新计算每个子任务的 `parentId`（找到最近的顶层父任务作为归属），更新 `order` 和 `parentId`

### 9. `src/App.vue`

- `handleAddSubTodo(parentId, content)`：创建子任务
- `handleToggleComplete` 修改：
  - 如果 toggle 的是子任务，检查父任务所有子任务状态，同步更新父任务 `completed`
  - 如果 toggle 的是父任务且它有子任务，阻止操作
- `handleDeleteTodo` 修改：删除父任务时级联删除所有子任务
- `activeTodos` 过滤：`parentId === null` 或 `parentId 指向的父任务也属于今日`（子任务跟随父任务显示）
- `completedTodos`：保持原样（用于 TimeView，子任务独立显示）

### 10. `src/components/TimeView.vue`

- 不需要改动，子任务作为独立完成的 todo 展示即可

---

## 实施步骤

1. 修改 `src/types/index.ts`：`TodoItem` 增加 `parentId`
2. 修改 `src/services/todoService.ts`：数据库 schema + CRUD + 级联删除 + 排序适配
3. 修改 `src/App.vue`：`handleAddSubTodo`、`handleToggleComplete` 父任务联动、`handleDeleteTodo` 级联删除、过滤逻辑
4. 修改 `src/components/TodoList.vue`：扁平列表构建、传递 `hasChildren`/`isSubTask`、`onDragEnd` 重新计算 parentId、新增 `add-sub-todo` emit
5. 修改 `src/components/TodoItem.vue`：菜单增加"子任务"、子任务缩进样式、父级 checkbox 禁用逻辑
6. 类型检查验证
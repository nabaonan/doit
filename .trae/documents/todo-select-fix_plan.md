# 待办事项选中优化计划

## 问题分析

通过代码审查，发现待办事项点击选中存在以下问题：

1. **FLIP 动画干扰点击**：`TodoList.vue` 中的 FLIP 动画在更新 `todos` 时给元素设置 `transform` 属性，导致点击事件命中位置偏移
2. **事件处理冲突**：`TodoItem.vue` 中 checkbox 的 `@mousedown.stop` 可能阻止了 checkbox 的原生选中行为
3. **缺少独立点击事件**：checkbox 的 `@click.stop="onCheckboxClick"` 依赖事件冒泡，可能被上层拦截

## 修改方案

### 1. TodoItem.vue - 优化 checkbox 事件处理

**文件**: `src/components/TodoItem.vue`

**修改内容**:
- 将 `@click.stop="onCheckboxClick"` 改为直接绑定 `@click="onCheckboxClick"`（去掉 `.stop`）
- 保持 `@mousedown.stop` 防止拖拽库拦截
- 添加 `@change` 事件作为备选触发方式

### 2. TodoList.vue - 优化 FLIP 动画

**文件**: `src/components/TodoList.vue`

**修改内容**:
- 在 FLIP 动画完成后确保 `transform` 属性被完全清除
- 添加防抖机制避免频繁的动画干扰

### 3. NestedTodoList.vue - 优化拖拽配置

**文件**: `src/components/NestedTodoList.vue`

**修改内容**:
- 添加 `handle` 配置，指定拖拽手柄，避免整个 item 都可拖拽

## 实施步骤

1. 修改 `TodoItem.vue` 中的 checkbox 事件绑定
2. 修改 `TodoList.vue` 中的 FLIP 动画逻辑
3. 修改 `NestedTodoList.vue` 中的拖拽配置
4. 测试验证修复效果

## 风险评估

- 低风险：修改主要涉及事件处理，不影响数据结构和业务逻辑
- 需要确保拖拽功能不受影响
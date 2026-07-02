# Super Productivity 问题处理方法速查

> 最后更新：2026-07-03
> 用途：记录开发和排查问题的诊断方法，方便后续遇到相同问题时快速定位

---

## 1. Widget 矩阵偶发只显示 2/4 面板

**症状**：艾森豪威尔矩阵 4 个象限面板偶发只渲染 2 个，刷新后有时恢复。

**根因**：`task-widget-renderer.ts` 第 113 行在脚本加载时立即调用 `applyRatios()`，此时 Electron 窗口可能尚未完成首次布局，`matrixGrid.clientWidth` 和 `clientHeight` 均为 0。

计算过程：

```
w=0, h=0 → availW=-10, availH=-10 → col1W=-5, col2W=-5, row1H=-5, row2H=-5
→ gridTemplateColumns: "-5px -5px" (inline style, 覆盖 CSS 默认 1fr 1fr)
```

负值 grid track 在 Chromium/Electron 中行为未定义，会导致 grid 容器塌陷为近似零尺寸，面板不可见。

**修复**：

1. `applyRatios()` 开头添加 guard：`if (w <= 0 || h <= 0) return;`
2. 删除脚本顶层提前调用的 `applyRatios()`（已有 ResizeObserver 和 renderPanels 末尾调用覆盖）

**诊断步骤**（如果再次出现）：

1. 打开 Widget DevTools（`F12` → 在 Widget 窗口中右键检查）
2. 检查 `#matrix-grid` 的 computed style → `grid-template-columns` 是否为负值
3. 检查 `clientWidth/clientHeight` 是否为 0
4. 执行 `localStorage.removeItem('taskWidgetMatrixRatios'); location.reload();`

**相关文件**：`electron/task-widget/task-widget-renderer.ts`

---

## 2. 实际时间块 resize 拖动无效

**症状**：鼠标拖动实际块（红色/已完成计划块）底部的 resize handle，松开后时间不变。

**根因**：`_onResizeEnd()` 使用 `this._elRef.nativeElement.offsetHeight` 计算高度变化，但 Angular OnPush + signal 变更检测下，`_resizeHeight` signal 的 DOM 更新可能在 `mouseup` 事件触发时尚未完成渲染，导致 `offsetHeight` 返回的是 resize 前的值，delta = 0，不满足 `Math.abs(timeChangeInMs) > 30000` 的阈值。

**修复**：改用 `clientY` delta（`this._lastClientY - this._startY`）替代 `offsetHeight` delta，直接基于鼠标指针移动距离计算时间变化。指针位置是同步可用的，不依赖 DOM 渲染。

**诊断步骤**（如果再次出现）：

1. 在 `_onResizeEnd` 加 `console.log(timeChangeInMs, heightDelta, clientDelta)`
2. 如果 `heightDelta ≈ 0` 但 `clientDelta` 很大 → DOM 更新时序问题
3. 如果两者都 ≈ 0 → 检查 `isResizable()` 返回值

**相关文件**：`src/app/features/schedule/schedule-event/schedule-event.component.ts`

---

## 3. Angular OnPush 组件的 DOM 读取时序问题

**通用问题**：在 OnPush 组件中，通过 event listener 读取 DOM（offsetHeight/offsetWidth 等）时，Angular signal 更新可能尚未渲染到 DOM。

**诊断方法**：

1. 在事件回调中打印 `nativeElement.offsetHeight`
2. 对比手动计算的期望值
3. 如果差值显著 → 说明 DOM 尚未更新

**解决方案（按优先级）**：

1. 首选：使用事件携带的数据（clientX/clientY 等），不依赖 DOM
2. 备选：在 `requestAnimationFrame()` 回调中读取 DOM
3. 最后手段：手动调用 `ChangeDetectorRef.detectChanges()` 强制同步

---

## 4. Electron Widget 调试方法

**打开 Widget DevTools**：

```javascript
// 在主窗口 DevTools Console 中执行
require('electron').remote.getGlobal('taskWidgetWin').webContents.openDevTools();
```

或使用 `--inspect` 启动参数。

**Widget 代码位置**：

- `electron/task-widget/` — 独立于 Angular 的纯 Web 渲染进程
- 使用 `contextBridge` 暴露 API，`window.taskWidgetAPI.*`
- 无 Angular，直接操作 DOM

**热重载**：Widget 修改后需重新 `npm start` 或重建 `app.asar`

---

## 5. 时间表事件类型识别

**实际块 vs 规划块判断**：

```typescript
// 在 schedule-event.component.ts 中
const isActualOrCompleted =
  evt.type === SVEType.ActualTask || evt.type === SVEType.CompletedPlannedTask;
```

**各类型含义**：
| SVEType | 含义 | 可拖拽 | 可 Resize |
|---|---|---|---|
| Task | 未规划任务 | 是 | 否 |
| TaskPlannedForDay | 计划当天 | 是 | 否 |
| ScheduledTask | 有具体时间 | 是 | 否 |
| ActualTask | 自动追踪的时间块 | **否** | **是（实际块）** |
| CompletedPlannedTask | 手动补记的时间块 | **否** | **是（实际块）** |

**关键区分变量**：

- `isManualRecordAvailable()` → 规划块为 true（显示"手动记录"菜单项）
- `isActualRecord()` → 实际块为 true（显示"调整记录"菜单项）

---

## 6. 上下文菜单的条件显示

**文件**：`src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.html`

**新增的 input**：

- `isManualRecordAvailable` — 是否显示"时间记录"按钮
- `isActualRecord` — 是否显示"调整实际记录"按钮 + 隐藏"删除任务"按钮

**调用处**：`schedule-event.component.html` 第 96-106 行

**原则**：

- 实际块 = 只调整时间记录，不删除任务本身
- 规划块 = 可以手动记录时间、删除任务

---

## 7. 时间编辑逻辑

**两个入口**：

1. **左侧任务详情面板** → `task-detail-panel.component.ts` → `estimateTime()` → `DialogTimeEstimateComponent`
2. **时间表右击菜单** → `task-context-menu-inner` → `requestManualRecord()` / `requestAdjustActualRecord()`

**原则**：

- 详情面板只能编辑预估时间（`isEstimateOnly: true`），不允许编辑已花费时间
- 已花费时间通过系统计时器自动累积
- 时间表上的实际块通过 resize 或右键"调整记录"修改

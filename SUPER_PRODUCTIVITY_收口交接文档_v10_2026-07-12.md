# Super Productivity 收口交接文档 v10

> 最后更新：2026-07-12
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 交接文档路径：`F:\AgentData\codex\super-productivity-custom\`
> 备份路径：`D:\DevelopTools\Super Productivity\rollbacks\`
> 当前分支：`main` (已提交 + 已推送)
> 当前 HEAD：`28755aa35`
> 最新 Release：`Desktop Plan v0.3.0` (tag: `desktop-plan-v0.3.0`, 2026-07-07)
> CI 状态：`success` ✅
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`
> 工作目录：`F:\Documents\claude code project\super productivity\` (Claude Code 配置 + 开发文档)
> v10 特点：**全项目源码深度分析版** — 覆盖 6 大系统、45 个 feature 模块、完整数据流

---

## 目录

1. [项目概览](#1-项目概览)
2. [版本历史](#2-版本历史)
3. [顶层架构](#3-顶层架构)
4. [Tasks 任务系统](#4-tasks-任务系统)
5. [Schedule 日程视图系统](#5-schedule-日程视图系统)
6. [Time Tracking 时间追踪系统](#6-time-tracking-时间追踪系统)
7. [Boards 看板系统](#7-boards-看板系统)
8. [Tag 标签系统](#8-tag-标签系统)
9. [Config 配置系统](#9-config-配置系统)
10. [Op-Log 同步系统](#10-op-log-同步系统)
11. [Root-Store 状态管理](#11-root-store-状态管理)
12. [UI 组件系统](#12-ui-组件系统)
13. [Mentions 自动补全系统](#13-mentions-自动补全系统)
14. [Core 核心服务](#14-core-核心服务)
15. [Electron 桌面系统](#15-electron-桌面系统)
16. [Task Widget 小组件](#16-task-widget-小组件)
17. [数据流全景图](#17-数据流全景图)
18. [已知 Bug 与待办](#18-已知-bug-与待办)
19. [CI 测试体系](#19-ci-测试体系)
20. [Git 安全约束](#20-git-安全约束)
21. [发布与部署流程](#21-发布与部署流程)
22. [常见坑与注意事项](#22-常见坑与注意事项)
23. [关键文件索引](#23-关键文件索引)
24. [Agent 与工具配置](#24-agent-与工具配置)

---

## 1. 项目概览

### 1.1 基本信息

| 项目 | 值 |
|------|-----|
| 名称 | Super Productivity (Desktop Plan 定制版) |
| 版本 | `18.13.1-desktop-plan-v0.3.0` |
| 描述 | 带艾森豪威尔小组件和实际时间线的 Windows 桌面效率工具 |
| 技术栈 | Angular 19 + NgRx + Electron 41 + Electron Builder 26 (NSIS) + IndexedDB + TypeScript + SCSS |
| 测试 | Jasmine/Karma (11433 用例) + Playwright (E2E) + Node test (Electron 188 用例) + Vitest (sync 包) |
| Node | 22.18.0 (Volta) |
| 上游 | `johannesjo/super-productivity` |
| Fork | `LarryHeng/super-productivity-desktop-plan` |

### 1.2 目录结构

```
F:\AgentData\codex\super-productivity-custom\
├── src/app/                    # Angular 应用源码
│   ├── features/               # 45 个功能模块
│   ├── root-store/             # NgRx 根状态 + meta-reducer
│   ├── op-log/                 # 操作日志同步系统
│   ├── core/                   # 27 个核心服务
│   ├── core-ui/                # 11 个核心 UI 组件
│   ├── ui/                     # 55+ 可复用 UI 组件
│   ├── pages/                  # 路由页面
│   ├── plugins/                # 插件系统
│   ├── imex/                   # 导入导出/备份
│   ├── util/                   # 工具函数 (315+ 文件)
│   └── pfapi/                  # 平板/手机 API
├── electron/                   # Electron 主进程 (~40+ TS 文件)
│   ├── task-widget/            # 桌面小组件
│   ├── ipc-handlers/           # IPC 处理器
│   └── shared-with-frontend/   # 前后端共享代码
├── packages/                   # 7 个独立子包 (monorepo)
│   ├── sync-core/              # 同步核心库
│   ├── sync-providers/         # 同步提供者实现
│   ├── plugin-api/             # 插件 API 定义
│   ├── plugin-dev/             # 插件开发工具
│   ├── shared-schema/          # 共享数据模型
│   ├── super-sync-server/      # SuperSync 服务端
│   └── vite-plugin/            # 插件打包 Vite 插件
├── e2e/                        # Playwright E2E 测试
├── build/                      # 构建资源
├── docs/                       # 开发文档
├── tools/                      # 构建/CI 工具
├── android/ & ios/             # 移动端 Capacitor 项目
└── .claude/                    # Claude Code 配置 (仅 launch.json)
```

### 1.3 当前工作目录

`F:\Documents\claude code project\super productivity\` 是 Claude Code 的 **配置和文档辅助目录** (非源码目录)，包含：

- `.claude/agents/` — 7 个专业 Agent
- `.claude/commands/` — 3 个自定义 slash 命令
- `.claude/hooks/` — anti-loop stop hook
- `.claude/skills/` — frontend-design skill
- `DEVELOPMENT.md` — 开发文档 (版本较旧)
- `TROUBLESHOOTING.md` — 排障速查手册
- `package.json` — 源码 package.json 的快照副本
- `electron/task-widget/task-widget-renderer.js/` — 调试快照

**真正开发应在源码目录进行**。工作目录的 `launch.json` 已配置 `cwd` 指向源码目录。

---

## 2. 版本历史

### 2.1 版本演进总览

| 版本 | Tag | 日期 | 关键内容 |
|------|-----|------|----------|
| v0.1.12 | - | 2026-07-03 | 小组件矩阵拖动、splash 可配置、git-version 修复 |
| v0.1.13 | - | 2026-07-03 | 计划块 resize 禁用、实际块双向 resize、调整记录右键菜单 |
| v0.1.14 | - | 2026-07-03 | 补偿修复 v0.1.13 的编译错误 (--no-verify 导致) |
| v0.1.15 | - | 2026-07-03 | Widget 矩阵截断/面板 2/4 修复、实际块删除/励志语句截断修复 |
| v0.1.16 | `a7e3cbf49` | 2026-07-03 | Bug 1(标签搜索)+Bug 2(移除矩阵标签) 第一轮修复 |
| v0.1.17 | `2a45a7427` | 2026-07-03 | Bug 1+Bug 2 第二轮修复 + 版本号 `.11W` |
| v0.2.0 | `desktop-plan-v0.2.0` | 2026-07-04 | 过渡版本 |
| **v0.3.0** | `desktop-plan-v0.3.0` | **2026-07-07** | **倒数日、分段改造、Dark Mode、CI 全绿** |
| v0.3.0+ | `01844005d` | 2026-07-07 | CI 修复文档补充 |
| **HEAD** | `28755aa35` | **2026-07-12** | 交接文档路径更新 |

### 2.2 v0.3.0 完整提交历史

```
28755aa35 docs(desktop-plan): add handover docs paths to header
5bb3d30ea docs(desktop-plan): finalize handover doc v9 — CI all green
01844005d docs(desktop-plan): add detailed 11-round CI failure analysis
84ae33269 docs(desktop-plan): finalize handover doc v9
64ead3e38 docs(desktop-plan): update DEVELOPMENT.md with v0.3.0 release
f0830442c fix(desktop-plan): revert dialog-track-time to native datetime-local input  ← CI SUCCESS
6b4529b77 fix(desktop-plan): unwrap mat-form-field around datetime-picker
60f792997 fix(desktop-plan): remove mat-form-field wrapping datetime-picker
c3cd574c2 ci: trigger CI run
2fe98ac40 fix(desktop-plan): replace all orphan <mat-error> with plain div
da839d892 fix(desktop-plan): replace orphan <mat-error> with plain div
880d5f545 docs(desktop-plan): update handover doc post v0.3.0 release
18e02af8e fix(desktop-plan): update test expectations for v0.3.0
ea65fe512 fix(desktop-plan): add updateTaskWidgetCountdown to spec mock
c040c6e21 fix(desktop-plan): add misc signal mock to task-electron.effects spec
cb0f37d68 fix(desktop-plan): remove duplicate MatIcon import
14ebc45c5 fix(desktop-plan): restore MatError import
ecf0b5a4c feat(desktop-plan): v0.3.0 — countdown, segment refactor, widget dark mode, bug fixes
```

### 2.3 v0.3.0 修改汇总 (35 文件, +851/-135 行)

**Bug 修复 (6 项):**
| 问题 | 修复 | 涉及文件 |
|------|------|----------|
| 实际块删除按钮失效 | dayStr 推导修复 + 删除前确认对话框 | `schedule-event.component.ts` |
| 部分块"调整记录"无响应 | timeSpentOnDay 为空时 fallback 到 evt.duration | `schedule-event.component.ts` |
| Formly datepicker 未注册 | 日期输入改为 `type: 'date'` | config form-cfgs |
| 新 actions 未注册 op-log | Remove/Update segment 加入 ActionType 枚举 | `action-types.enum.ts` |
| 月视图不显示补记 | 新增 CompletedPlannedTask 匹配 | `schedule-month-summary.util.ts` |
| 真实块修改时长无上限 | originalDuration 硬上限，只减不增 | `schedule-event.component.ts` |

**新功能 (5 项):**
| 功能 | 说明 |
|------|------|
| 倒数日 | 替换励志语句，分块样式：名称/天数/通用字独立颜色和字体大小 |
| 小组件倒数日 | 独立开关 + 8 个独立样式字段 |
| 倒计时超时红色 | 归零后 mode→task-overtime，红色正向计时 |
| 小组件 dark mode | 完整适配 |
| 小组件导航栏重构 | 左：倒数日+标题，右：计时+按钮；窄屏两行 |

**改造 (4 项):**
| 改造 | 说明 |
|------|------|
| 时间追踪分段 | segment 新增 originalDuration；手动补记永不合并 |
| 全局日历 | datetime-local → DateTimePickerComponent |
| 调整记录对话框 | 文本框(1h 30m) + 独立删除按钮 + 全中文化 |
| 手动补记对话框 | 起始/结束时间改用 DateTimePickerComponent |

---

## 3. 顶层架构

### 3.1 技术栈详细

```
前端: Angular 19 + NgRx (Signal 优先) + Angular Material + SCSS
桌面: Electron 41 + contextBridge (contextIsolation: true, nodeIntegration: false)
构建: Electron Builder 26 (NSIS for Windows), Angular CLI
存储: IndexedDB (op-log) + localStorage (UI 状态) + sessionStorage
测试: Jasmine/Karma (单元) + Playwright (E2E) + Node test (Electron) + Vitest (sync)
同步: CRDT/Op-Log + 向量时钟 + LWW 冲突解决
语言: TypeScript 5.9 (strict), ES2022 target
```

### 3.2 src/app/ 架构树

```
src/app/
├── config/                          # 应用初始化配置
├── core/ (27 模块)                  # 核心服务层
│   ├── date/date.service.ts         # 逻辑时钟 (DateService)
│   ├── persistence/                 # IndexedDB 持久化层
│   ├── theme/                       # 主题系统 (亮/暗/自定义)
│   ├── global-tracking-interval/    # 全局计时 tick
│   ├── startup/startup.service.ts   # 启动初始化 (483行)
│   ├── electron/                    # Electron API 封装 + 环境检测
│   ├── language/                    # 多语言支持
│   ├── notify/                      # 通知系统
│   └── ...
├── core-ui/ (11 模块)               # 核心 UI 组件
│   └── main-header/
│       ├── main-header.component.*  # 主 Header (352行 ts + 141行 html)
│       └── header-countdown/        # 倒数日组件 (160行)
├── features/ (45 模块)              # 功能模块
│   ├── tasks/                       # ★ 任务核心
│   ├── schedule/                    # ★ 日程视图 (最复杂的数据管线)
│   ├── time-tracking/               # ★ 时间追踪状态
│   ├── boards/                      # 看板 (艾森豪威尔矩阵 + Kanban)
│   ├── tag/                         # 标签系统
│   ├── project/                     # 项目管理
│   ├── planner/                     # 规划器
│   ├── config/                      # 全局配置模型和表单
│   ├── work-context/                # 工作上下文
│   ├── daily-settlement/            # 每日结算
│   ├── task-repeat-cfg/             # 重复任务配置
│   ├── issue/                       # 问题追踪 (Jira/GitHub 集成)
│   ├── focus-mode/                  # 专注模式
│   ├── idle/                        # 空闲检测
│   ├── note/                        # 笔记
│   ├── metric/                      # 指标/统计
│   ├── reminder/                    # 提醒
│   ├── calendar-integration/        # 日历集成
│   └── ...
├── root-store/                      # NgRx 根状态
│   ├── meta/task-shared-meta-reducers/  # 14 个 meta-reducer (核心)
│   └── app-state/                   # AppState (todayStr + offset)
├── op-log/                          # 操作日志同步系统
│   ├── core/                        # 核心: ActionType, Operation, Entity Registry
│   ├── capture/                     # 操作捕获 (meta-reducer + effect)
│   ├── sync/                        # LWW 冲突解决
│   ├── apply/                       # 操作应用 (批量 hydration)
│   ├── persistence/compact/         # 持久化: 压缩编码, IndexedDB adapter
│   ├── model/                       # 完整数据模型配置
│   └── validation/                  # payload 校验
├── ui/ (55+ 组件)                   # 可复用 UI 组件
│   ├── mentions/                    # ★ 标签/日期/项目自动补全
│   ├── datatime-picker/             # DateTimePickerComponent
│   ├── duration/                    # 时长输入组件
│   ├── dialog-prompt/               # 文本输入对话框
│   ├── dialog-confirm/              # 确认对话框
│   ├── pipes/                       # 管道
│   └── ...
├── pages/                           # 路由页面容器
├── plugins/                         # 插件系统
├── imex/                            # 导入导出/备份/同步
├── pfapi/                           # 平板/手机 API
├── routes/                          # 路由定义
└── util/ (315+ 文件)                # 工具函数
```

### 3.3 9 条 Sync 核心规则 (来自 CLAUDE.md)

1. **Effects 注入 `LOCAL_ACTIONS`**，不用 `Actions`；`ALL_ACTIONS` 仅 op-log capture effect
2. **选 Selector 的 effect 需 `skipDuringSyncWindow()`**（lint 强制 `require-hydration-guard`）
3. **多实体变更 = meta-reducer**，非 effect fan-out（一条 op = 一个用户意图）
4. **逻辑时钟**: `DateService` 统一入口；纯 reducer/selector 接受 `startOfNextDayDiffMs` 参数保证回放确定性
5. **`TODAY_TAG` 是虚拟标签** — 永不加到 `task.tagIds`（由 `dueDay`/`dueWithTime` 决定）
6. **批量 dispatch 循环后加 `await setTimeout(0)`**（50+ 连续 dispatch 会丢状态）
7. **`SYNC_IMPORT`/`BACKUP_IMPORT`** 替换全部状态，故意丢弃并发 ops（设计中行为）
8. **`MAX_VECTOR_CLOCK_SIZE = 20`**，Server 端裁剪
9. **Log.log({ id: task.id })**，永不用 `Log.log(task)` 或 `Log.log(title)`（日志可导出）

---

## 4. Tasks 任务系统

### 4.1 Task 数据模型 (`task.model.ts`)

**核心接口**：`TaskCopy extends PluginTask`，最终类型 `Task = Readonly<TaskCopy>`

**时间相关字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `timeSpentOnDay` | `{[dateStr]: number}` | 每日耗时映射 (YYYY-MM-DD → ms)，**必需字段** |
| `timeSpent` | `number` | 累计耗时 (由 timeSpentOnDay 求和) |
| `timeEstimate` | `number` | 预估时间，默认 0 |
| `dueDay` | `string \| null` | 仅日期排程 (YYYY-MM-DD)，与 dueWithTime **互斥** |
| `dueWithTime` | `number \| null` | 带时间排程 (Unix ms)，读取时优先检查 |
| `hasPlannedTime` | `boolean?` | false=仅排到某天但不指定具体时间 |
| `deadlineDay` | `string \| null` | 仅日期截止日 |
| `deadlineWithTime` | `number \| null` | 带时间截止日 |
| `deadlineRemindAt` | `number \| null` | 截止日提醒时间戳 |
| `remindAt` | `number?` | 排程提醒时间戳 |
| `repeatCfgId` | `string?` | 重复任务配置 ID |
| `tagIds` | `string[]` | 关联标签 ID |
| `projectId` | `string?` | 关联项目 ID |
| `parentId` / `subTaskIds` | `string?` / `string[]` | 父子任务关系 |
| `isDone` / `doneOn` | `boolean` / `number?` | 完成状态和时间 |
| `_hideSubTasksMode` | `number` | UI 折叠: 0=Show/1=HideDone/2=HideAll |
| `attachments` | `TaskAttachment[]` | 附件列表 |
| `notes` | `string?` | Markdown 笔记 |

**互斥模式 `dueDay ↔ dueWithTime`**: 
- 设置 `dueWithTime` 时，meta-reducer 自动清除 `dueDay`
- 读取时优先检查 `dueWithTime`
- 遗留数据可能两者共存，按优先级处理

**`actualTimeSegments` 不在 TaskCopy 中** — 它在 `TimeTrackingState.taskSegments[date]` 里

### 4.2 TaskService (`task.service.ts`, 1523 行)

最大的服务文件。关键方法分组：

**状态管理**:
- `setCurrentId(id)` — 设置当前计时的任务 (null=停止)
- `setSelectedId(id, panel?)` — 设置选中任务 (打开详情面板)
- `startFirstStartable()` / `pauseCurrent()` — 开始/暂停计时
- `flushAccumulatedTimeSpent()` — 强制刷新累积时间 (切后台/关闭前)

**任务 CRUD**:
- `add(title, isAddToBacklog, additional, isAddToBottom)` → 返回 taskId
- `addAndSchedule(title, additional, due, remindCfg)` — 创建并立即排程
- `remove(task)` / `removeMultipleTasks(taskIds)` — 删除
- `update(id, changedFields)` / `updateUi(id, changes)` — 更新
- `updateTags(task, newTagIds)` — 更新标签
- `removeTagsForAllTask(tagsToRemove)` — 批量移除标签

**时间追踪方法 (核心)**:
- `addTimeSpent(task, duration, date)` — 添加某日耗时
- `addActualTimeSegment(taskId, duration, end)` — 添加实际时间段 (计时停止时调用)
- `addManualTimeSegment(task, start, end)` — 手动录入时间段 (同时 addTimeSpent + syncTimeSpent + addActualTimeSegment{source:'manual'})
- `removeActualTimeSegment(taskId, date, start)` — 删除实际时间段
- `updateActualTimeSegment(taskId, date, start, newDuration)` — 修改时间段时长

**`_activeActualTimeSegment`** (service 内部信号，第228行):
- 当前任务变化时自动关闭上一个 segment (`_closeActualTimeSegment`)
- 开启新 segment 记录 `{taskId, date, start}`
- 保证每个活跃任务有精确的开始/结束时间

**`BatchedTimeSyncAccumulator`**:
- 每 5 分钟批量 dispatch `syncTimeSpent` (避免每次 tick 都同步)
- 任务切换/应用关闭时立即 flush

### 4.3 Add-Task-Bar 输入栏

**组件级 providers** (每实例独立状态):
- `AddTaskBarStateService` — 管理输入状态字段 (projectId, tagIds, date, time, estimate, newTagTitles 等)
- `AddTaskBarParserService` — 解析调度器

**短语法引擎** (`short-syntax.ts`, 719 行):
```
用户输入 "#tag +project @date !deadline t30m/1h"
    ↓ shortSyntax() 函数
解析输出: { taskChanges, newTagTitles, projectId, attachments }
```

- `#` → 标签 (mode: 'replace' 编辑时 / 'combine' 创建时)
- `+` → 项目 (前缀匹配，优先最短匹配)
- `@` → 排程日期 (使用 chrono-node 自然语言解析，含自定义 refiner 防 "90" 被解析为 1990)
- `!` → 截止日 (共用 parseShortSyntaxDate)
- `t` → 时间 (格式: `t30m/1h` = 已花费30min/预估1h)

**智能排程** (`_getNextDefaultScheduleStart`): 取当前时间+5分钟后，在已有排程任务间找空隙

**创建任务流程** (`addTask()`):
1. 防重入检查 → 2. 校验估算 → 3. 合并手动+短语法标签 → 4. 新标签弹窗确认 → 5. 处理截止日 → 6. 智能排程 → 7. 构建 taskData → 8. `_taskService.add()` → 9. scheduleTask/dueWithTime → 10. repeatQuickSetting → 11. resetAfterAdd()

### 4.4 Store 层

**task.actions.ts (181行)**:
| Action | 关键点 |
|--------|--------|
| `setCurrentTask` | 当前计时任务 |
| `setSelectedTask` | 选中任务 (打开详情面板) |
| `unsetCurrentTask` | 取消计时 |
| `updateTaskUi` | 仅 UI 更新 (不同步) |
| `removeTimeSpent` | 移除耗时 (持久化, OpType.Update) |
| `moveSubTask*` 系列 | 子任务排序 (持久化, OpType.Move) |
| `addSubTask` | 添加子任务 (持久化, OpType.Create) |
| `toggleStart` | 切换计时 |
| `roundTimeSpentForDay` | 每日耗时取整 (批量持久化) |

**持久化 action 特征**: `meta: { isPersistent: true, entityType: 'TASK', opType, ... }`

**task.reducer.ts (767行)**:
| Reducer | 关键逻辑 |
|---------|----------|
| `loadAllData` | 清理孤儿 ID, 规范化 timeSpentOnDay, 去重子任务 ID |
| `addTimeSpent` | 加 duration 到某日 timeSpentOnDay, NaN/Infinity 保护 |
| `syncTimeSpent` | **仅在 isRemote 时应用** (防重复计数) |
| `setCurrentTask` | 有子任务时自动选第一个未完成子任务; 已完成任务自动取消完成 |
| `moveSubTask` | 含循环引用检测 `wouldCreateCircularReference` |
| `toggleTaskHideSubTasks` | 三值状态循环 (0→1→2→0) |

**辅助函数** (`task.reducer.util.ts`):
- `reCalcTimeSpentForParentIfParent` / `reCalcTimeEstimateForParentIfParent` — 子任务汇总父任务
- `updateTimeSpentForTask` — 增量更新父任务 (非全量重算)
- `deleteTaskHelper` — 完整清理 (父任务副作用+孤儿子任务)
- `updateDoneOnForTask` — 完成/取消完成时设置 doneOn

**task.selectors.ts (730行)**:
| Selector | 用途 |
|----------|------|
| `selectCurrentTask` | 当前计时任务实体 |
| `selectOverdueTasks` | 逾期任务 (dueDay < todayStr) |
| `selectLaterTodayTasksWithSubTasks` | "稍后"视图 (今天带时间的未完成任务) |
| `selectTimeConflictTaskIds` | 时间冲突任务 ID 集合 |
| `selectAllTasksWithDueTime` | 所有带具体时间的排程任务 |
| `selectUnplannedDeadlineTasksForToday` | 今天到期但未排程的截止日任务 |

**Effects 文件**:
- `task-electron.effects.ts (328行)` — 与 Electron 主进程 IPC: 同步任务列表到 Widget, 托盘更新, 任务栏进度条
- `task-ui.effects.ts (330行)` — UI 副作用: snack 提示, 时间超估提醒, 音效, 截止日横幅
- `task-internal.effects.ts` — 内部联动: 子任务全完成→父任务完成, 默认估算, 自动开始下一个
- `task-due.effects.ts` — 日期变更: 创建重复任务, 移除逾期, 确保今日任务在列表中
- `short-syntax.effects.ts` — 短语法二次解析, 新标签创建
- `task-related-model.effects.ts` — 拖拽联动: DONE/BACKLOG/UNDONE 间移动时自动标记完成状态

### 4.5 TaskComponent (`task.component.ts`, 1395 行)

**性能优化核心**: TaskService 提供**共享信号** (`currentTaskId`, `selectedTaskId`, `todayListSet`, `timeConflictTaskIds`)，避免每个任务组件独立订阅 Store (200+ 任务→消除 200+ 订阅)

**核心 computed signals**:
| Signal | 说明 |
|--------|------|
| `isCurrent` | 是否为正在计时的任务 |
| `isSelected` | 是否为选中(详情面板打开)的任务 |
| `isTaskOnTodayList` | 是否在今日列表 |
| `hasTimeConflict` | dueWithTime 冲突 |
| `isOverdue` | 逾期判断 |
| `isScheduledToday` | 今天排程 |
| `isShowAddToToday/RemoveFromToday` | 今日按钮显隐 |
| `progress` | timeSpent / timeEstimate * 100 |
| `checklistProgress` | Markdown checklist 进度 |

**右键菜单集成**: 延迟加载 `TaskContextMenuComponent` (`isContextMenuLoaded` 信号)，首次打开才渲染

### 4.6 TaskContextMenuInnerComponent (`task-context-menu-inner.component.ts`, 847 行)

**关键方法**:
- `removeMatrixTags()` — 移除 URGENT_TAG/IMPORTANT_TAG + 添加 HIDDEN_MATRIX_TAG (三层防御)
- `deleteTask()` — 含确认对话框
- `startTask()` / `pauseTask()` — 计时控制
- `requestManualRecord()` — emit `manualRecord` output → 打开手动补记对话框
- `requestAdjustActualRecord()` — emit `adjustActualRecord` output → 打开调整实际记录对话框
- `scheduleTask()` / `unschedule()` — 排程/取消
- `duplicate()` — 复制任务(含子任务)

**isActualRecord / isManualRecordAvailable**: 通过 `input()` 传入，控制菜单项显示

---

## 5. Schedule 日程视图系统

这是**整个项目最复杂的数据管线**，从原始数据到最终视图渲染约 10+ 步。

### 5.1 类型体系 (`schedule.model.ts`, 219 行)

**SVE (Schedule View Entry) 图层级**:
```
SVEBase { id, type, start, duration, plannedForDay, isBeyondBudget }
├── SVETask              → Task/TaskPlannedForDay/ScheduledTask/ActualTask/CompletedPlannedTask
├── SVESplitTaskStart    → 被阻塞块打断的前半段
├── SVESplitTaskContinued → 被阻塞块打断的后半段
├── SVERepeatProjection  → 重复任务投影
├── SVERepeatProjectionSplit → 重复任务投影前段
├── SVERepeatProjectionSplitContinued → 重复任务投影后段
├── SVERepeatProjectionSplitContinuedLast → 重复任务投影尾段
├── SVECalendarEvent     → 第三方日历集成
├── SVEWorkStart/SVEWorkEnd → 工作/结束标记
└── SVELunchBreak        → 午休块
```

**ScheduleEvent** (最终渲染用的类型):
- `startHours` — CSS grid 行定位
- `timeLeftInHours` — 持续时长 (rowSpan)
- `overlap: { count, offset }` — 重叠检测结果 (多栏并排)

### 5.2 SVEType 枚举 (`schedule.const.ts`)

19 个枚举值，带排序权重表 `SCHEDULE_VIEW_TYPE_ORDER`。关键区分:
- `Task` — 无时间约束的"流动"任务
- `TaskPlannedForDay` — 已排程到某天
- `ScheduledTask` — 有精确时间
- `ActualTask` — 实际计时块 (红色调)
- `CompletedPlannedTask` — 手动补记 (source='manual')

**FH = 12** — 每小时 12 个 CSS Grid 行 (每行 5 分钟)，布局核心参数

### 5.3 核心数据管线

```
原始数据
  → mapToScheduleDays
    → createBlockedBlocksByDayMap（聚集所有阻塞块: ScheduledTasks, CalendarEvents, RepeatProjections, WorkStartEnd）
      → createSortedBlockerBlocks: 合并重叠区间 + 按天分配 + 跨天拆分
    → createScheduleDays（按天构建 SVE[]）
      → getTasksWithinAndBeyondBudget（当天预算计算）
      → createViewEntriesForDay
        → createScheduleViewEntriesForNormalTasks（流式任务→SVETask，依次摆放）
        → createViewEntriesForBlock（阻塞块→SVE）
        → insertBlockedBlocksViewEntriesForSchedule（★核心算法★ 阻塞块插入流式序列并拆分任务）
  → appendActualTimeSegmentsToScheduleDays（追记实际时间）
    → mergeNearbyActualTaskSegments（合并相邻段，但 manual 永不合并）
    → trimOverlappingActualTaskSegments
    → segment→SVE（ActualTask | CompletedPlannedTask 按 source 区分）
    → coalesceSplitPlannedEntries（聚合分散的计划条目）
    → shiftPlannedEntriesAfterActualTime（计划条目后移避免重叠）
    → splitPlannedEntriesAroundLunch（午休拆分）
  → mapScheduleDaysToScheduleEvents（SVE→最终渲染用 ScheduleEvent）
    → 重叠检测 + overlap count/offset 分配（槽位分配算法，LunchBreak 不参与）
```

### 5.4 阻塞块插入算法 (`insert-blocked-blocks-view-entries-for-schedule.ts`, 389 行)

遍历 blockedBlocks，对每个块找其在 viewEntries 中的位置:
- 块在条目之前 → 直接插入
- 块与条目不重叠 → 插入并 shift 后续
- 块与条目重叠 → **拆分条目**: 当前→Split 类型，溢出→ContinuedLast

支持 RepeatProjection 和其他各类型的对应 Split 变体。

### 5.5 ScheduleEventComponent (`schedule-event.component.ts`, 878 行)

**核心 computed signals**:
- `task()` — 提取 TaskCopy (仅任务类事件)
- `isActualRecord()` — ActualTask 或 CompletedPlannedTask
- `title()` — 事件标题
- `icoType()` — 图标类型 (REPEAT/FLOW/SCHEDULED_TASK/PLANNED_FOR_DAY 等)
- `style()` — 重叠布局: 动态计算 margin-left + width

**关键交互**:
- **isResizable**: 当前实现**对所有情况返回 false** (生产未启用 resize)，但有 ActualRecord 的限制逻辑 (只能缩小不能放大)
- **deleteActualRecordWithConfirm**: 弹出确认→调用 `removeActualTimeSegment` + 清除 `timeSpentOnDay`
- **adjustActualRecord**: 打开 `DialogAdjustActualRecordComponent`，originalDuration 为硬上限
- **openManualRecord**: 打开手动补记对话框
- **ResizeObserver**: 动态计算 `--title-line-clamp` CSS 变量适配块高度

### 5.6 手动补记与调整记录

**DialogManualTimeRecordComponent**:
- 输入: task(可选), start(默认 end-30min), end(默认 now), isFromPlannedBlock
- 校验: 必须同一天 + 不重叠 + 不未来 + isFromPlannedBlock 时需选 continuation
- 提交: `taskService.addManualTimeSegment(task, start, end)` (source='manual')

**DialogAdjustActualRecordComponent**:
- 输入: taskTitle, currentDurationMs, maxDurationMs (originalDuration), startTimestamp, dayStr, task
- 约束: `parsedMs <= maxDurationMs` (硬上限)
- 两个操作: save→`{action:'save', newDurationMs}`; delete→`{action:'delete'}`

---

## 6. Time Tracking 时间追踪系统

### 6.1 数据模型 (`time-tracking.model.ts`)

| 类型 | 字段 | 说明 |
|------|------|------|
| `TTActualTaskSegment` | taskId, start, end, source?, originalDuration | 一条完整的时间段记录 |
| `TTActiveTaskSegment` | taskId, date, start | 当前正在计时的活动段 (无 end) |
| `TTWorkContextData` | s, e, b, bt | 工作上下文按天数据 (属性缩写以减少存储) |
| `TimeTrackingState` | project, tag, taskSegments | 顶层状态 |

**`source: 'manual'`** — 手动补记标记，用于在视图中区分 `CompletedPlannedTask` 和 `ActualTask`

### 6.2 Actions 定义 (`time-tracking.actions.ts`, 127 行)

所有 action 都带 `persistent` 元数据。关键 actions:
- `addTimeSpent` — tick 触发，增加 task 耗时
- `addActualTimeSegment` — 计时完成或手动补记时调用，entityId 含 taskId/date/start/end/source
- `removeActualTimeSegment` — 按 taskId+date+start 定位删除
- `updateActualTimeSegment` — 修改 segment 的 end 字段
- `syncTimeSpent` — 定期同步，**仅 isRemote 时 reducer 处理** (防重复)
- `updateWorkContextData` — 手动编辑 worklog

### 6.3 Reducer (`time-tracking.reducer.ts`, 214 行)

- `addActualTimeSegment`: **防重复检查** (taskId+start+end+source 全匹配)，附带 `originalDuration: end-start`
- `removeActualTimeSegment`: 按 `taskId + start` 匹配过滤 (不含 end)
- `updateActualTimeSegment`: 改 `segment.end = segment.start + newDuration`
- `loadAllData`: 兼容旧数据无 `taskSegments` 字段

### 6.4 完整时间追踪数据流

```
[计时开始] → TaskService.trackTime()
  ├→ dispatch addTimeSpent (本地 tick, 每秒)
  └→ _timeAccumulator.accumulate

[每5分钟/任务切换/关闭] → _timeAccumulator.flush()
  └→ dispatch syncTimeSpent (持久化)

[计时停止] → TaskService.stopTracking()
  ├→ _closeActualTimeSegment → dispatch addActualTimeSegment {taskId, date, start, end}
  └→ dispatch syncTimeSpent (最终同步)

[手动补记] → DialogManualTimeRecordComponent.submit()
  ├→ taskService.addManualTimeSegment(task, start, end)
  │    ├→ addTimeSpent + syncTimeSpent
  │    └→ addActualTimeSegment {source:'manual'}
  └→ (若来自计划块) dispatch updateTask (isDone/timeEstimate)

[调整记录] → DialogAdjustActualRecordComponent.save()
  ├→ taskService.updateActualTimeSegment
  │    └→ dispatch updateActualTimeSegment (segment.end = start + newDuration)
  └→ dispatch updateTask (timeSpentOnDay)

[删除记录] → schedule-event.deleteActualRecord()
  ├→ taskService.removeActualTimeSegment
  │    └→ dispatch removeActualTimeSegment (filter out matching segment)
  └→ dispatch updateTask (timeSpentOnDay)
```

---

## 7. Boards 看板系统

### 7.1 核心组件 (`board.component.ts`, 124 行)

**`patchedBoardCfg` computed signal** (运行时兜底):
- 仅在 Eisenhower Matrix 时激活
- 对四个象限面板 (`EISENHOWER_PANEL_IDS`) 检查 `excludedTagIds` 是否已含 `HIDDEN_MATRIX_TAG`
- 缺失则追加 → 保证右键"从矩阵移除"后任务立刻消失
- 纯内存操作，不持久化

**看板数据流**:
```
task (含 tagIds, isDone, projectId 等)
    → BoardCfg → panels: BoardPanelCfg[]
        → filterTasksForPanel(allTasks, panelCfg)  (6 维度过滤)
            → 按 taskIds 预排 + sortBy 排序
                → BoardPanelComponent 渲染
```

### 7.2 Reducer (`boards.reducer.ts`, 265 行)

**`fixBuggyDefaultBoardFilters`** (数据迁移补丁):
1. Eisenhower 四象限 `taskDoneState: UnDone → All`
2. Kanban DONE 面板移除 `IN_PROGRESS_TAG` 排除
3. Eisenhower 面板追加 `HIDDEN_MATRIX_TAG` 到 `excludedTagIds` (持久化，幂等)

**加载管道**: `sanitizeBoardsState → fixBuggyDefaultBoardFilters → deduplicatePanelIds → normalizeLoadedBoardsState`

### 7.3 过滤引擎 (`boards.util.ts`, 283 行)

`filterTasksForPanel()`: 6 维组合过滤:
1. include/exclude tag (支持 all/any 匹配)
2. 仅父任务 (isParentTasksOnly)
3. 完成状态 (taskDoneState)
4. 项目过滤 (projectIds)
5. 日程状态 (scheduledState)
6. 积压状态 (backlogState)

结果先按 `taskIds` 预排 (保持拖拽顺序)，再按 `sortBy`/`sortDir` 排序

---

## 8. Tag 标签系统

### 8.1 系统标签 (`tag.const.ts`)

| 常量 | ID | 图标 | 颜色 | 说明 |
|------|----|------|------|------|
| `TODAY_TAG` | `TODAY` | `wb_sunny` | - | 虚拟标签，**不在 task.tagIds 中**，成员由 dueDay 决定 |
| `URGENT_TAG` | `EM_URGENT` | `emergency` | `#c618e1` | 紧急 |
| `IMPORTANT_TAG` | `EM_IMPORTANT` | `priority_high` | `#e11826` | 重要 |
| `IN_PROGRESS_TAG` | `KANBAN_IN_PROGRESS` | - | - | Kanban 进行中 |
| `HIDDEN_MATRIX_TAG` | `EM_HIDDEN` | `visibility_off` | `#9e9e9e` | 从矩阵移除 |
| `DEFAULT_TAG` | 空 | null | - | 新建标签模板 |

### 8.2 Reducer (`tag.reducer.ts`, 401 行)

**`_addSystemTagsIfNecessary`**: 检查 `[TODAY_TAG, URGENT_TAG, IMPORTANT_TAG, HIDDEN_MATRIX_TAG]` 是否存在，缺失则插入 (不含 IN_PROGRESS_TAG — Kanban 专用)

**调用时机**: `initialTagState` + `loadAllData` (保证系统标签始终存在)

**TODAY_TAG 虚拟排序**: `moveTaskInTodayList/Up/Down/ToTop/ToBottom` 仅修改 `TODAY_TAG.taskIds` 排序，不碰 `task.tagIds`

### 8.3 computeOrderedTaskIdsForTag

`task.tagIds` 是成员资格唯一真相源，`tag.taskIds` 仅用于排序。具有自愈性: 失效 ID 被过滤，新成员自动追加。

---

## 9. Config 配置系统

### 9.1 GlobalConfig 层级 (`global-config.model.ts`, 451 行)

顶层聚合: `GlobalConfigState` = `{ misc, pomodoro, focusMode, schedule, reminder, sync, keyboard, taskWidget, appFeatures, ... }`

### 9.2 MiscConfig (`misc` 段, 30+ 字段)

**倒数日相关** (新增于 v0.3.0):
| 字段 | 类型 | 说明 |
|------|------|------|
| `countdownTargetName` | `string` | 目标名称 |
| `countdownTargetDate` | `string` | 目标日期 |
| `countdownNameColor` | `string` | 名称颜色 (默认 `#e53935`) |
| `countdownNameFontSize` | `number` | 名称字号 (默认 14) |
| `countdownDaysColor` | `string` | 天数字颜色 (默认 `#e53935`) |
| `countdownDaysFontSize` | `number` | 天数字号 (默认 16) |
| `countdownIsBold` | `boolean` | 数字加粗 (默认 true) |
| `countdownCommonColor` | `string` | 通用文字颜色 (默认 `#888888`) |
| `countdownCommonFontSize` | `number` | 通用文字字号 (默认 13) |

**小组件倒数日独立样式** (8 个字段):
| 字段 | 说明 |
|------|------|
| `countdownShowInWidget` | 是否在小组件中显示 |
| `widgetCountdownNameColor/FontSize` | 小组件名称颜色/字号 |
| `widgetCountdownDaysColor/FontSize` | 小组件天数字颜色/字号 |
| `widgetCountdownIsBold` | 小组件数字加粗 |
| `widgetCountdownCommonColor/FontSize` | 小组件通用文字颜色/字号 |

**其他 MiscConfig 字段**: `startOfNextDay` (默认 `'04:00'`), `splashDuration` (默认 5000ms), `isMinimizeToTray`, `isConfirmBeforeExitWithoutFinishDay`, `isLocalRestApiEnabled`, `isDisableAnimations`, `globalBackgroundImage`, `isVerticalActionBar` 等

---

## 10. Op-Log 同步系统

### 10.1 核心概念

**操作日志 (Op-Log)**: 所有状态变更记录为 `Operation`，以向量时钟排序，支持多设备同步

**一条 Operation 的结构**:
```
{ id: uuidv7(), actionType, opType, entityType, entityId, payload, 
  clientId, vectorClock, timestamp, schemaVersion }
```

### 10.2 ActionType 枚举 (`action-types.enum.ts`, ~130 个值)

按实体分组，字符串值**永不修改** (编码到 IndexedDB + 用于同步)。编码规则: 首字符=实体前缀, 第二字符=操作类型。如 `HA` = Task Shared Add, `KA` = TimeTracking Add, `KR` = TimeTracking Remove。

### 10.3 完整同步流程

```
用户操作
  → dispatch action (meta: {isPersistent:true})
  → [Phase 1] operationCaptureMetaReducer 拦截
      ├── isApplyingRemoteOps → bufferDeferredAction()
      └── 正常 → captureService.incrementPending()
  → [Phase 2-7] 各 meta-reducer 依次处理
  → OperationLogEffects.persistOperation$
      ├── writeOperation() 在锁内:
      │     ├── 读取 clientId + 递增向量时钟
      │     ├── extractEntityChanges() 计算实体变更
      │     ├── 构建 Operation 对象
      │     ├── appendWithVectorClockUpdate (原子写入 IndexedDB)
      │     ├── 触发即时上传
      │     └── 检查 compaction 阈值
      └── finally: decrementPending()
  → [同步] upload / download
  → conflict-resolution.service.autoResolveConflictsLWW()
  → operation-applier.service.applyOperations()
      └── replayOperationBatch → bulkApplyOperations action
          └── bulkOperationsMetaReducer 逐个 convertOpToAction + reducer
  → processDeferredActions() 刷新缓冲
```

### 10.4 LWW 冲突解决 (`conflict-resolution.service.ts`, 1392 行)

**8 步流程**:
1. 对每个冲突调用 `_resolveConflictsWithLWW`
2. Remote 赢时连带 reject 同一实体的 pending local ops
3. 无冲突远程 ops 加入批量应用
4. 应用前标记 rejected ops (崩溃安全)
5. 批量应用所有远程胜出 ops
6. Local 赢时为实体创建新 LWW Update op (合并向量时钟)
7. 显示非阻塞通知
8. 校验并修复状态

**冲突判断**: `compareVectorClocks(localFrontier, remoteOp.vectorClock)`
- `GREATER_THAN/EQUAL` → 跳过
- `CONCURRENT` → LWW 解决
- 时钟损坏检测 → 强制 CONCURRENT

### 10.5 向量时钟

- `MAX_VECTOR_CLOCK_SIZE = 20`
- 客户端上传完整向量时钟 (不裁剪)
- **Server** 端比较后、存储前裁剪
- 客户端裁剪有害: 可能丢失 server 追踪的 client ID → false CONCURRENT → 无限拒绝循环

### 10.6 关键常量 (`operation-log.const.ts`)

| 常量 | 值 |
|------|-----|
| `COMPACTION_THRESHOLD` | 500 ops |
| `COMPACTION_RETENTION_MS` | 7 天 |
| `EMERGENCY_COMPACTION_RETENTION_MS` | 1 天 |
| `MAX_OPS_PER_UPLOAD_REQUEST` | 25 |
| `DOWNLOAD_PAGE_SIZE` | 500 |
| `LOCK_ACQUISITION_TIMEOUT_MS` | 30 秒 |
| `MAX_CONFLICT_RETRY_ATTEMPTS` | 5 |

---

## 11. Root-Store 状态管理

### 11.1 Meta-Reducer 执行顺序

**14 个 meta-reducer**，严格顺序 (Phase 1→8):

```
Phase 1  (最外层): operationCaptureMetaReducer          — 捕获操作前原始状态
Phase 2:           bulkOperationsMetaReducer            — 展开批量 hydration/sync
Phase 3:           undoTaskDeleteMetaReducer            — 删除前捕获 undo 上下文
Phase 3.5:         sectionSharedMetaReducer              — 预 CRUD 状态读取
Phase 4:           taskSharedCrudMetaReducer             — ★ Task CRUD + Project/Tag 级联
                   taskBatchUpdateMetaReducer            — 插件批量操作
                   taskSharedLifecycleMetaReducer        — 归档/恢复
                   taskSharedSchedulingMetaReducer       — 排程 (dueDay/dueWithTime)
                   taskSharedDeadlineMetaReducer         — 截止日
Phase 5:           projectSharedMetaReducer              — Project 删除级联
                   tagSharedMetaReducer                  — Tag 删除级联
                   issueProviderSharedMetaReducer        — Issue Provider 解绑
                   taskRepeatCfgSharedMetaReducer        — Repeat Cfg 解绑
Phase 6:           plannerSharedMetaReducer              — Planner 同步
Phase 7:           shortSyntaxSharedMetaReducer          — 短语法复合操作
                   lwwUpdateMetaReducer                  — LWW 冲突解决实体替换
Phase 8  (最内层): actionLoggerReducer                   — 纯日志
```

**关键约束**:
- `sectionShared` 必须在 `taskSharedCrud` 之前 (需要读取 CRUD 前的原始值)
- Phase 4 内部: CRUD→Lifecycle→Scheduling→Deadline (依赖链)
- Phase 5 必须在 Phase 4 后 (task 已被处理后才能级联清理)
- Phase 7 的 LWW 必须靠后 (依赖所有业务 reducer 准备好)

### 11.2 为什么多实体变更必须用 Meta-Reducer

1 个用户操作 ("新建任务") 可能改变 5 个 feature state (task + project + tag + planner + section)。若用 Effect fan-out → 多条独立 operation → sync replay 时不同步 → LWW 可能撕裂。

Meta-reducer 保证: **1 个 action = 1 条 operation**，单次 reducer pass 原子修改所有相关 state。

### 11.3 AppState

```typescript
interface AppState {
  todayStr: string;              // 今天日期 (YYYY-MM-DD)
  startOfNextDayDiffMs: number;  // 用户设定的"次日开始"偏移 (ms)
}
```

被几乎所有 meta-reducer 使用，通过 `state.appState?.todayStr ?? getDbDateStr()` 防御性读取。

---

## 12. UI 组件系统

### 12.1 DateTimePickerComponent (`ui/datetime-picker/`, 293 行)

- **自身不含** `<mat-form-field>` — 直接使用 `<mat-calendar>` + 时间输入 + 提醒选择
- Calendar 视图变化时重置初始焦点
- 首次聚焦时间输入: 自动填当前时间+1h (除非选了非今日日期→默认 09:00)
- 键盘导航检测: `isKeyboardNavigating` 宿主绑定 CSS 类

### 12.2 InputDurationSlider (`ui/duration/`, 391 行)

圆形拖拽时长选择器:
- <60分钟: 5-min snap (一圈=60min)
- >=60分钟: 15-min snap (一圈=360min)
- `bareRing` + `hideHandle` 模式用于 Pomodoro

### 12.3 Dialog 组件

**DialogPromptComponent** (47 行): 简单文本输入 + MatDialogRef.close(txtVal)
**DialogConfirmComponent** (67 行): 确认对话框，支持 `dontShowAgain` 复选框

---

## 13. Mentions 自动补全系统

### 13.1 MentionDirective (`mention.directive.ts`, 694 行)

**核心流程**:
1. `ngOnChanges` → `updateConfig()` → `addConfig()` → 重建 `triggerChars` 表
2. `keyHandler` → 检测触发字符 → `showSearchList` + `updateSearchList`
3. 搜索态: 按键更新 searchString → updateSearchList 过滤 → 赋值 `searchList.items.set(matches)`
4. 选择: Tab/Enter 触发 `mentionSelect` → 格式化插入文本 → stopSearch

**关键保护** (`ngOnChanges` 第251行):
```typescript
// [mention] items 变化但搜索进行中时，跳过 updateConfig()
if (!this.searching && this.mentionItems?.length) {
  this.updateConfig();
}
```

**Bug 1 相关点**: `updateConfig()` 浅拷贝 `{ ...this.mentionConfig }` 防止污染 `shareReplay` 缓存。`_fuzzyMatch`: 短搜索词(≤3字符)用 `includes`; 长搜索词按字符顺序匹配。

### 13.2 MentionListComponent (`mention-list.component.ts`, 243 行)

动态创建组件: `items = signal([])`, `hidden = signal(false)`, `activeIndex: number = 0`

### 13.3 MentionConfigService (`mention-config.service.ts`, 100 行)

```typescript
combineLatest([
  this._globalConfigService.shortSyntax$,
  this._tagService.tagsNoMyDayAndNoListSorted$,
  this._projectService.listSortedForUI$,
]).pipe(
  map(([cfg, tagSuggestions, projectSuggestions]) => {
    // # → Tag, @/! → Chrono 时间, + → 项目
    return { mentions, triggerChar: undefined } as MentionConfig;
  }),
  shareReplay({ bufferSize: 1, refCount: true }),
);
```

`shareReplay` 确保所有编辑器实例共享同一份数据。**但浅拷贝问题**: `addConfig` 中的 `{...this.mentionConfig}` 是浅拷贝，嵌套 `mentions` 数组引用共享可能导致残留。

---

## 14. Core 核心服务

### 14.1 DateService (`core/date/date.service.ts`, 89 行)

"逻辑时钟" — 支持用户自定义次日开始时间:

- `todayStr` — 偏移后的日期字符串
- `getLogicalTodayDate()` — `new Date(Date.now() - this.startOfNextDayDiff)`
- `isToday(ts)` — 时间戳减去偏移后判断是否为今天
- `getStartOfNextDayDiffMs()` — 暴露原始偏移值给纯函数

**关键**: 纯 reducer/selector 必须接受 `startOfNextDayDiffMs` 参数，不能直接 `new Date()` (sync replay 时确定性要求)

### 14.2 GlobalTrackingIntervalService (173 行)

- `tick$` — 合并 interval + `_wakeUpTick$` (后台恢复)
- `consumeCurrentTick` — 计算距上次 tick 的时间增量
- `triggerWakeUpTick` — 后台恢复时注入补偿 tick (带 maxDurationMs 上限)
- `todayDateStr$` — 5 源合并: timer, focus, visibilitychange, systemResume, startOfNextDayDiffChange

Android WebView: `isInBackground$` 为 true 时 unsubscribe interval (省电)

### 14.3 Theme 系统

**GlobalThemeService** (892 行): 亮/暗/跟随系统 + 背景图片 + 工作区色彩 + Body CSS 类管理 + iOS/Android 键盘处理

**CustomThemeService** (320 行): 17 个内置主题 + 用户自定义 CSS 主题 IndexedDB 存储

### 14.4 StartupService (483 行)

启动流程: 单实例检查 → 初始化备份 → 请求持久化权限 → 应用自定义主题 (500ms 超时) → 延迟初始化 (1000ms: 追踪提醒 + 存储检查 + 主题迁移 + 插件加载) → Electron IPC 注册

---

## 15. Electron 桌面系统

### 15.1 主进程架构

```
main.ts (单例锁) → startApp.ts (调度中心)
  ├── 协议处理 + 命令行参数解析
  ├── GPU 启动守卫
  ├── 空闲检测 (5 种跨平台方法)
  ├── 电源事件 (suspend/resume/lock)
  └── main-window.ts (主窗口, 696 行)
        ├── CORS 绕过
        ├── 导航安全防护
        ├── 应用关闭回调系统 (REGISTER_BEFORE_CLOSE)
        └── 主题同步 (titleBarOverlay)
```

**空闲检测** (5 种方法):
| 方法 | 场景 |
|------|------|
| `powerMonitor` | Windows, macOS, X11 |
| `gnomeDBus` | GNOME + Wayland |
| `waylandIdleNotify` | 任意 Wayland (Rust helper) |
| `xprintidle` | X11 兼容层 |
| `loginctl` | systemd-based |

**窗口关闭流程** (`appCloseHandler`): 渲染进程注册回调→关闭时通知→完成工作→BEFORE_CLOSE_DONE→真正退出。支持最小化到托盘 (除非 `isQuitRequested`)。

### 15.2 Preload (`preload.ts`, 320 行)

通过 `contextBridge.exposeInMainWorld('ea', ea)` 暴露 ~50 个 API:
- **send** (单向): relaunch, exit, flashFrame, showOrFocus, lockScreen, shutdownNow, reloadMainWin, openDevTools, openPath, openExternalUrl, registerGlobalShortcuts, updateCurrentTask, exec, updateTaskWidget*
- **invoke** (双向): getUserDataPath, getBackupPath, backup/restore, fileSync*, pickDirectory, showOpenDialog, saveFileDialog, clipboard image* (10个方法), imagePickAndImport*, Plugin OAuth, Node execution
- **同步调用**: setZoomFactor, getZoomFactor, 平台检测 (isLinux, isMacOS, isGnomeDesktop 等)
- **事件监听**: `ea.on()` 通用封装, onSwitchTask, onPluginOAuthCb, onLocalRestApiRequest

### 15.3 IPC 系统

`ipc-handler.ts` → `initIpcInterfaces()` 初始化 9 个模块:
- `app-control` — SHUTDOWN_NOW, EXIT, RELAUNCH, OPEN_DEV_TOOLS, RELOAD_MAIN_WIN, TRANSFER_SETTINGS
- `app-data` — GET_PATH, GET_BACKUP_PATH, GET_PRODUCTIVITY_QUOTES
- `system` — OPEN_PATH (路径安全校验), OPEN_EXTERNAL, SHOW_EMOJI_PANEL, SAVE_FILE_DIALOG
- `exec` — EXEC (命令白名单 + 危险提示)
- `global-shortcuts` — REGISTER_GLOBAL_SHORTCUTS (showHide, toggleTaskStart, addNote, addTask, toggleTaskWidget)
- `jira` — JIRA_SETUP_IMG_HEADERS, JIRA_MAKE_REQUEST_EVENT
- Clipboard image handlers (10 个方法)
- Local REST API
- Plugin OAuth

**安全包装器** (`ipc-handler-wrapper.ts`): `createValidatedHandler(handler, {validatePath: true})` → 验证 basePath 在 userData 内 + 文件名安全

### 15.4 Backup (`backup.ts`, 499 行)

- 备份路径: `userData/backups` (Windows Store 特殊路径)
- 支持软链接重定向 + symlink 原子替换 (含回滚)
- SHA256 文件哈希校验 + 大小校验
- **安全**: `BACKUP_LOAD_DATA` 通过 `isPathInsideDir` 校验 backupPath 必须在 BACKUP_DIR 内 (GHSA-x937-wf3j-88q3)

---

## 16. Task Widget 小组件

### 16.1 双进程架构

```
Electron Main Process (task-widget.ts, 1049 行)
  ├── createTaskWidgetWindow() — 独立 BrowserWindow (无边框, skipTaskbar)
  ├── IPC: update-content, update-opacity, update-background, update-countdown
  ├── 倒计时逻辑: updateTaskWidgetContent() 确定 mode (pomodoro/focus/task/task-overtime/idle)
  ├── 全局背景: 三层优先级 (当前Widget背景 > 全局背景 > 主题底色)
  └── Windows 桌面层级: PowerShell 获取桌面 Shell 窗口句柄 → moveAbove

Electron Renderer Process (task-widget-renderer.ts, 513 行)
  ├── renderPanels() — 构建艾森豪威尔矩阵 4 象限 DOM
  ├── applyRatios() — 矩阵拖动比例计算 + CSS Grid 像素值设置
  ├── updateResponsiveState() — 宽度<560px 切换窄屏单列布局
  └── 延期对话框: onCountdownExpired → 显示 #extend-dialog → extendTask API
```

### 16.2 矩阵拖动系统

- 3 个拖动元素: `#col-divider`, `#row-divider`, `#cross-center`
- 比例持久化到 `localStorage` (key: `taskWidgetMatrixRatios`)
- `ResizeObserver` 监听容器变化重新计算
- `snap()`: 比率在 0.5±0.06 以内自动吸附中心
- **已知问题**: 脚本加载时 `applyRatios()` 提前调用 → clientWidth=0 → 负值 grid track (v0.1.15 已修复 guard)

### 16.3 响应式布局

宽度 < 560px: 隐藏分割线 + 矩阵变单列 + header 变两行 grid (倒计时+按钮第一行, 任务标题+时间第二行)

### 16.4 Windows 桌面层级

`maintainTaskWidgetDesktopLayer`: 每 500ms 用 PowerShell 获取桌面 Shell 窗口句柄 → `win.moveAbove(desktopMediaSourceId)` → 保持在桌面图标之上但其他窗口之下

---

## 17. 数据流全景图

### 17.1 任务创建完整链路

```
用户输入 "task title #tag +project @today t30m/1h"
  → AddTaskBarComponent.onInputChange()
    → AddTaskBarParserService.parseAndUpdateText()
      → shortSyntax() 解析 → {taskChanges, newTagTitles, projectId}
    → AddTaskBarStateService 更新各字段 signal
  → AddTaskBarComponent.addTask()
    → TaskService.add(title, isAddToBacklog, additional)
      → createNewTaskWithDefaults() 工厂函数
      → dispatch TaskSharedActions.addTask
        → [Phase 4] taskSharedCrudMetaReducer 原子修改:
          ├── task entities: 添加新 Task
          ├── project.taskIds: 追加 taskId
          ├── tag.taskIds: 为每个 tagId 追加 taskId
          └── planner.days: 若 dueDay，更新 planner 日映射
  → ShortSyntaxEffects.shortSyntax$ 二次解析
    → dispatch applyShortSyntax (复合 action)
```

### 17.2 日程视图数据管线

```
ScheduleService.createScheduleDaysComputed() (computed signal, 每秒刷新)
  ← selectTimelineTasks, selectTaskRepeatCfgs, selectPlannerDayMap,
    selectTimeTrackingState ({taskSegments}), selectTaskEntities,
    calendarEvents, activeActualTimeSegment
  → mapToScheduleDays()
    → createBlockedBlocksByDayMap (阻塞块: ScheduledTasks, CalendarEvents, RepeatProjections, WorkStartEnd)
    → createScheduleDays (按天构建 SVE)
  → appendActualTimeSegmentsToScheduleDays()
    → mergeNearbyActualTaskSegments (manual 永不合并)
    → ActualTask | CompletedPlannedTask SVE
    → coalesceSplitPlannedEntries | shiftPlannedEntriesAfterActualTime | splitPlannedEntriesAroundLunch
  → mapScheduleDaysToScheduleEvents()
    → SVE → ScheduleEvent + 重叠检测 + CSS Grid 定位
  → [ScheduleWeekComponent] CSS Grid 渲染
  → [ScheduleEventComponent] 每个块为 <schedule-event>
```

### 17.3 时间追踪端到端

```
GlobalTrackingIntervalService.tick$ (每秒)
  → TaskService 订阅 → dispatch addTimeSpent
    → reducer: task.timeSpentOnDay[date] += duration
    → reducer: project[pid][date].e = now
    → _timeAccumulator.accumulate (每5分钟 flush → syncTimeSpent)
  → _activeActualTimeSegment 维护 (taskId, date, start)

计时停止
  → TaskService._closeActualTimeSegment()
    → dispatch addActualTimeSegment {taskId, date, start, end, originalDuration}
    → reducer: taskSegments[date].push(segment)

手动补记
  → addManualTimeSegment(task, start, end)
    → dispatch addActualTimeSegment {source:'manual'}
    → dispatch addTimeSpent + syncTimeSpent

视图渲染
  → appendActualTimeSegmentsToScheduleDays
    → manual → CompletedPlannedTask (蓝色)
    → 非manual → ActualTask (红色)
    → 合并/修剪/拆分 → ScheduleEvent
```

### 17.4 同步数据流

```
用户操作 → [Phase 1] 捕获 → [Phase 2-7] meta-reducers
  → OperationLogEffects.persistOperation$
    → 构建 Operation → 原子写入 IndexedDB (op + vector clock)
    → 触发上传
  → 同步: upload/download
    → LWW 冲突解决
      ├── Local wins → 创建新 LWW Update op
      └── Remote wins → 批量应用
  → processDeferredActions() 刷新缓冲
```

---

## 18. 已知 Bug 与待办

### 18.1 未验证 Bug (v0.1.17 修复, 功能未验证)

**Bug 1: 标签模糊搜索不实时筛选**

症状: 输入 `#` → 打字搜索标签 → 下拉不刷新; Backspace → 下拉消失

已尝试的修复 (两轮):
- 第一轮: mention.directive.ts — `ngOnChanges` 搜索进行中跳过 updateConfig + `updateConfig()` 浅拷贝 + IME 遍历全部字符 + Backspace 手动 trim
- 第二轮: mention-list.component.ts — `items`/`hidden` 改为 signal

数据流分析 (`BUG_FIX_ATTEMPTS_REPORT.md`):
```
用户输入 → inputTxt$ → tagMentions$ (每次按键都发新数组!)
  → [mention]="tagMentions$ | async" → MentionDirective
    → ngOnChanges → updateConfig → triggerChars 重建
    → keyHandler → updateSearchList → 过滤 → searchList.items.set()
```

4 层根因假设:
1. `ngOnChanges` 每次按键重建配置打断搜索
2. `updateConfig()` 浅拷贝 `shareReplay` 缓存污染
3. Backspace 在 `keydown` (DOM 更新前) 读取过时内容
4. IME 输入 `event.data.charCodeAt(0)` 只取首字符

**下一步排查**: 检查 `this.activeConfig` 是否正确指向 `#` 嵌套配置; 检查 `mentionCfg$` 的 `shareReplay` 首次发射延迟; 在 add-task-bar 层面排查

**Bug 2: "移除矩阵标签"按钮不生效**

已修复 (三层防御):
1. `removeMatrixTags()` 无条件添加 `HIDDEN_MATRIX_TAG` (代码层)
2. `fixBuggyDefaultBoardFilters()` 持久化数据迁移 (存储层)
3. `patchedBoardCfg` computed signal 运行时兜底 (视图层)

**状态**: 功能未验证，但三层防御架构完整

### 18.2 小组件矩阵偶发只显示 2/4 面板

**根因**: `applyRatios()` 在布局前调用，clientWidth=0 → 负值 grid track。v0.1.15 已修复 (guard + 删除提前调用)，但不能 100% 确定。

**快速修复** (如复现): `localStorage.removeItem('taskWidgetMatrixRatios'); location.reload();`

### 18.3 新发现 Bug: 倒计时 daysRemaining=0 不显示"今天就是"

`header-countdown.component.ts` 第46行:
```html
@if (daysRemaining() !== null) {
  <!-- "还剩 X 天" 分支 — 0 也是 !== null, 会命中这里! -->
} @else if (daysRemaining() === 0) {
  <!-- "今天就是" — 永远不会执行! -->
}
```

`!== null` 对 0 为 true，导致第二个分支永远不执行。

### 18.4 待办清单

| # | 事项 | 状态 |
|---|------|------|
| 1 | Bug 1 (标签搜索) 功能验证 | 待验证 |
| 2 | Bug 2 (移除矩阵标签) 功能验证 | 待验证 |
| 3 | 恢复"计组4.7结束"丢失的时间记录 | 备份已定位 |
| 4 | 修复倒计时 daysRemaining=0 文案 | 未开始 |
| 5 | 上游测试修复 | 未开始 |
| 6 | Dev 版本号区分 | 未开始 |

---

## 19. CI 测试体系

### 19.1 测试命令

| 命令 | 说明 | 规模 |
|------|------|------|
| `npm test` | Karma 单元测试 (Jasmine) | 11433/11435 |
| `npm run test:file <path>` | 单个 spec 测试 | - |
| `npm run test:electron` | Electron 测试 (Node test) | 188 用例 |
| `npm run sync-core:test` | sync-core (Vitest) | 12 文件, 206 用例 |
| `npm run sync-providers:test` | sync-providers (Vitest) | 16 文件, 376 用例 |
| `npm run e2e` | Playwright E2E | 40+ 目录 |
| `npm run e2e:file <path>` | 单个 E2E (~20s/test) | - |
| `npm run lint` | TS + SCSS + rules 检查 | 0 errors |
| `npm run checkFile <path>` | 单文件 prettier + lint | - |
| `npm run int:test` | 国际化检查 | - |

**注意**: Angular 单元测试使用柏林时区 `cross-env TZ='Europe/Berlin'`

### 19.2 v0.3.0 CI 修复历程 (11 轮)

| 轮次 | 失败类型 | 根因 | 修复 |
|------|----------|------|------|
| 1 | TS2304 `MatError` 未找到 | import 遗漏 | 恢复 MatError import, 去重 MatIcon |
| 2 | `misc is not a function` | GlobalConfigService mock 缺少 misc signal | 添加 misc spy |
| 3 | `updateTaskWidgetCountdown not a function` | window.ea mock 缺少方法 | 添加 spy |
| 4 | 6 FAILED (ActionType 计数+segment 断言+store.pipe) | 新 actions 未更新测试 + originalDuration + TestBed 未提供 | 各修复 |
| 5~8 | `mat-form-field must contain a MatFormFieldControl` | datetime-picker 自带 mat-form-field 被外层包裹 + 孤立 mat-error | 移除包裹 + div 替代 mat-error |
| 9 | **SUCCESS** | revert dialog-track-time 验证通过 | - |

**核心教训**:
- `<datetime-picker>` 内部自带 `<mat-form-field>`，外层不能再包裹
- `<mat-error>` 必须在 `<mat-form-field>` 内部
- Karma teardown 会运行全局变更检测 → 构造不当的 Material 组件会抛异常 → Chrome 断开

### 19.3 Pre-push Hook

Pre-push hook 运行**全量测试**。紧急情况可用 `--no-verify` 跳过 (但 v0.1.13 因此导致了编译错误)。

---

## 20. Git 安全约束

```
desktop-plan → https://github.com/LarryHeng/super-productivity-desktop-plan.git (唯一可推送)
larryheng    → https://github.com/LarryHeng/super-productivity.git (fetch only, push = NO_PUSH_FORK)
origin       → https://github.com/super-productivity/super-productivity.git (push = NO_PUSH_OFFICIAL_UPSTREAM)
```

**绝对不要改回 origin 的 push URL。**

### 禁止提交的内容
- `.codex/`, `codex/`, `.tmp/`, `node_modules/`
- 安装包 (`.exe`)
- 备份文件 (`.json` backup)
- 用户数据

### Commit 格式
`type(scope): description` — types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
**禁止** `fix(test):` 或 `fix(e2e):` — 测试变更用 `test:`

---

## 21. 发布与部署流程

### 21.1 完整发布流程

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 1. 测试
npm run lint && npm test && npm run test:electron && npm run sync-core:test && npm run sync-providers:test

# 2. 生产构建
npm run buildAllElectron:noTests:prod

# 3. Windows 打包
npm run dist:win:only

# 4. 覆盖 D 盘本地安装 (确保进程已退出)
cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"

# 5. 提交推送
git add <files>
git commit -m "type(scope): description"
git push desktop-plan HEAD:main

# 6. 发布 Release
git tag desktop-plan-vX.Y.Z
git push desktop-plan desktop-plan-vX.Y.Z
gh release create desktop-plan-vX.Y.Z ".tmp/app-builds/Super-Productivity-Setup-x64.exe" \
  -R LarryHeng/super-productivity-desktop-plan \
  --title "Desktop Plan vX.Y.Z" --notes "..."
```

### 21.2 常用命令速查

| 操作 | 命令 |
|------|------|
| 安装依赖 | `npm ci` |
| Web 开发 | `ng serve` 或 `npm run startFrontend` |
| Electron 开发 | `npm start` |
| 生产构建 | `npm run buildAllElectron:noTests:prod` |
| Windows 打包 | `npm run dist:win:only` |
| 覆盖 D 盘 | `cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"` |

### 21.3 部署路径

| 项目 | 路径 |
|------|------|
| 运行目录 | `D:\DevelopTools\Super Productivity\working\` |
| 可执行文件 | `D:\DevelopTools\Super Productivity\working\Super Productivity.exe` |
| 桌面快捷方式 | `C:\Users\LarryHeng\OneDrive\Desktop\Super Productivity.lnk` |
| 备份目录 | `D:\DevelopTools\Super Productivity\rollbacks\` |
| User Data | `%APPDATA%\superProductivity\` |
| 自定义名言 | `%APPDATA%\superProductivity\productivity-quotes.json` |

---

## 22. 常见坑与注意事项

### 22.1 JavaScript/TypeScript
- `[] || fallback` → `[]` (永远是 truthy!) → 正确写法: `arr?.length ? arr : fallback`
- 禁止 `any` → 用 `unknown` 替代
- 永不直接变异 NgRx state → 返回新对象

### 22.2 Angular
- 订阅必须清理 → `takeUntilDestroyed()` 或 async pipe
- 新代码用 standalone components，不用 NgModules
- Task component 是**性能热路径**: 避免 function/getter 在模板中, 避免额外变更检测
- OnPush 组件中通过 event listener 读 DOM (offsetHeight) 可能未更新 → 改用 clientY delta

### 22.3 Material 组件
- `<datetime-picker>` 内部自带 `<mat-form-field>` → 外层不能再包裹
- `<mat-error>` 必须在 `<mat-form-field>` 内部 → 独立时 CI 会失败
- 不要用 `@if` 代替 `[hidden]` 在 `display:none` 场景 (参考 #7666 死循环 bug)

### 22.4 Sync 同步
- Effect 注入 `LOCAL_ACTIONS`，不用 `Actions`
- Multi-entity change = meta-reducer，不用 effect fan-out
- `syncTimeSpent` 仅 isRemote 时 reducer 处理 (防重复)
- `detectChanges` 在 Karma teardown 会运行 → 任何构造不当的 Material 组件会抛异常

### 22.5 Git
- Pre-push hook 跑全量测试
- 紧急用 `--no-verify` 但极其危险 (v0.1.13 教训)

### 22.6 Electron
- 桌面层级管理仅在 Windows 平台
- Widget `applyRatios()` 不能在 layout 前调用
- workspace 单例检查: `app.requestSingleInstanceLock()` (macOS 跳过)

---

## 23. 关键文件索引

### 23.1 Tasks 系统
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src/app/features/tasks/task.model.ts` | ~230 | TaskCopy 接口, DEFAULT_TASK, dueDay/dueWithTime 互斥 |
| `src/app/features/tasks/task.service.ts` | 1523 | 所有 CRUD + 时间追踪方法 |
| `src/app/features/tasks/add-task-bar/short-syntax.ts` | 719 | # + @ ! t 短语法解析引擎 |
| `src/app/features/tasks/add-task-bar/add-task-bar.component.ts` | ~600 | 任务创建主流程 |
| `src/app/features/tasks/store/task.reducer.ts` | 767 | NgRx reducer + reducer util |
| `src/app/features/tasks/store/task.selectors.ts` | 730 | 20+ 选择器 |
| `src/app/features/tasks/store/task-electron.effects.ts` | 328 | Electron IPC 通信 |
| `src/app/features/tasks/store/task-ui.effects.ts` | 330 | UI 副作用 |
| `src/app/features/tasks/task/task.component.ts` | 1395 | 任务列表项渲染 (性能热路径) |
| `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` | 847 | 右键菜单 |

### 23.2 Schedule 系统
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src/app/features/schedule/schedule.model.ts` | 219 | SVE 类型层级, BlockedBlock 体系 |
| `src/app/features/schedule/schedule.const.ts` | 65 | SVEType 枚举 (19 个), FH=12 |
| `src/app/features/schedule/schedule-event/schedule-event.component.ts` | 878 | 事件块渲染+交互 |
| `src/app/features/schedule/map-schedule-data/map-to-schedule-days.ts` | 152 | 数据映射入口 |
| `src/app/features/schedule/map-schedule-data/insert-blocked-blocks-view-entries-for-schedule.ts` | 389 | 阻塞块插入算法 |
| `src/app/features/schedule/map-schedule-data/append-actual-time-segments-to-schedule-days.ts` | 398 | 实际段叠加 |
| `src/app/features/schedule/map-schedule-data/map-schedule-days-to-schedule-events.ts` | 141 | 重叠检测 |
| `src/app/features/schedule/manual-time-record/dialog-manual-time-record.component.ts` | 199 | 手动补记 |
| `src/app/features/schedule/manual-time-record/dialog-adjust-actual-record.component.ts` | 149 | 调整实际记录 |

### 23.3 Time Tracking
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src/app/features/time-tracking/time-tracking.model.ts` | 86 | TTActualTaskSegment, TimeTrackingState |
| `src/app/features/time-tracking/store/time-tracking.actions.ts` | 127 | add/remove/update segment actions |
| `src/app/features/time-tracking/store/time-tracking.reducer.ts` | 214 | 防重复+originalDuration |

### 23.4 Boards + Tag + Config
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src/app/features/boards/board/board.component.ts` | 124 | patchedBoardCfg computed signal |
| `src/app/features/boards/store/boards.reducer.ts` | 265 | fixBuggyDefaultBoardFilters |
| `src/app/features/boards/boards.util.ts` | 283 | filterTasksForPanel 6维过滤 |
| `src/app/features/tag/tag.const.ts` | 129 | 6 个系统标签定义 |
| `src/app/features/tag/store/tag.reducer.ts` | 401 | _addSystemTagsIfNecessary |
| `src/app/features/config/global-config.model.ts` | 451 | MiscConfig 倒数日字段 |
| `src/app/features/config/default-global-config.const.ts` | 305 | 完整默认配置 |
| `src/app/features/config/form-cfgs/countdown-form.const.ts` | 163 | 倒数日配置表单 (14 字段) |

### 23.5 Op-Log + Root-Store
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src/app/op-log/core/action-types.enum.ts` | ~210 | ~130 个 ActionType 枚举 |
| `src/app/op-log/sync/conflict-resolution.service.ts` | 1392 | LWW 8 步流程 |
| `src/app/op-log/capture/operation-capture.meta-reducer.ts` | 284 | 捕获 meta-reducer |
| `src/app/op-log/capture/operation-log.effects.ts` | 669 | 持久化 effect |
| `src/app/op-log/persistence/compact/action-type-codes.ts` | 257 | 编码表 (HA→Task Shared Add...) |
| `src/app/op-log/core/operation-log.const.ts` | 306 | 所有可调参数 |
| `src/app/root-store/meta/meta-reducer-registry.ts` | 199 | 14 个 meta-reducer 执行顺序 |
| `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.ts` | 1061 | 核心 CRUD |
| `src/app/root-store/meta/task-shared-meta-reducers/task-shared-scheduling.reducer.ts` | 400 | 排程 |

### 23.6 UI + Core
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `src/app/ui/mentions/mention.directive.ts` | 694 | 自动补全指令 (Bug 1 重点) |
| `src/app/ui/mentions/mention-list.component.ts` | 243 | 浮动列表 (signal 版) |
| `src/app/ui/datatime-picker/datetime-picker.component.ts` | 293 | DateTimePicker |
| `src/app/core/date/date.service.ts` | 89 | 逻辑时钟 |
| `src/app/core/global-tracking-interval/global-tracking-interval.service.ts` | 173 | 全局 tick |
| `src/app/core/startup/startup.service.ts` | 483 | 启动初始化 |
| `src/app/core/theme/global-theme.service.ts` | 892 | 主题系统 |
| `src/app/core-ui/main-header/header-countdown/header-countdown.component.ts` | 160 | 倒数日 (daysRemaining=0 Bug) |

### 23.7 Electron
| 文件 | 行数 | 关键内容 |
|------|------|----------|
| `electron/main.ts` | 25 | 入口 + 单例锁 |
| `electron/start-app.ts` | 529 | 启动调度中心 |
| `electron/main-window.ts` | 696 | 主窗口管理 |
| `electron/preload.ts` | 320 | contextBridge API |
| `electron/task-widget/task-widget.ts` | 1049 | 小组件主进程 |
| `electron/task-widget/task-widget-renderer.ts` | 513 | 小组件渲染 |
| `electron/task-widget/task-widget.css` | 637 | 小组件样式 |
| `electron/task-widget/task-widget-preload.ts` | 73 | 小组件 preload |
| `electron/idle-time-handler.ts` | 590 | 5 种空闲检测方法 |
| `electron/backup.ts` | 499 | 备份逻辑 |
| `electron/shared-with-frontend/ipc-events.const.ts` | 130 | ~70 个 IPC 事件 |
| `electron/CONFIG.ts` | 5 | Electron 配置常量 |

### 23.8 文档
| 文件 | 用途 |
|------|------|
| `CLAUDE.md` | Claude Code 行为规范 (必读) |
| `DEVELOPMENT.md` | 中文开发文档 (版本历史+架构) |
| `ARCHITECTURE-DECISIONS.md` | 架构决策记录 |
| `BUG_FIX_ATTEMPTS_REPORT.md` | Bug 1/2 修复技术复盘 |
| `TROUBLESHOOTING.md` | 7 个常见问题诊断 |
| `docs/styling-guide.md` | 样式指南 |
| `docs/sync-and-op-log/` | 同步系统详细文档 |
| `e2e/CLAUDE.md` | E2E 测试规范 |
| `AGENTS.md` | → "Please read CLAUDE.md!!" |

---

## 24. Agent 与工具配置

### 24.1 当前工作目录 Agent (`F:\Documents\claude code project\super productivity\.claude\agents\`)

| Agent | 用途 |
|-------|------|
| `angular-architect` | Angular 15+ 企业架构 |
| `code-reviewer` | 代码审查 (正确性/简化/模式) |
| `debugger` | 5 阶段系统调试 |
| `electron-pro` | Electron 专家 (主/渲染进程, IPC, 构建) |
| `node-specialist` | Node.js 后端 |
| `test-automator` | 测试自动化 |
| `typescript-pro` | 高级 TypeScript |

### 24.2 自定义 Slash Command

| 命令 | 功能 |
|------|------|
| `/focused-fix` | 5 阶段深度修复 (Scope→Trace→Diagnose→Fix→Verify) |
| `/karpathy-check` | Karpathy 4 原则代码审查 |
| `/changelog` | Git 历史生成 changelog |

### 24.3 开发服务器

```json
{
  "name": "Super Productivity",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["electron", "."],
  "port": 4242,
  "cwd": "F:\\AgentData\\codex\\super-productivity-custom"
}
```

---

> **版本说明**: v10 为全项目源码深度分析版。相比 v9 新增了 6 大系统的深入分析：Tasks、Schedule、Time Tracking、Op-Log/Root-Store、Electron/Widget、UI/Core/Mentions。每个系统包含数据模型、关键方法、数据流、执行顺序和已知问题。此后交接无需重新遍历项目。

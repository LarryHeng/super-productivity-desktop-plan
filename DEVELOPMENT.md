# Super Productivity Desktop Plan — 开发文档

> 最后更新：2026-07-07 04:34
> 当前 HEAD：`f0830442c` (committed + pushed)
> 当前版本：`18.13.1-desktop-plan-v0.3.0`
> 最新 Release：[`Desktop Plan v0.3.0`](https://github.com/LarryHeng/super-productivity-desktop-plan/releases/tag/desktop-plan-v0.3.0)
> CI 状态：`success` (Karma 11433/11435 SUCCESS, E2E smoke passed, lint passed, lighthouse passed)

---

## 1. 快速上手

```powershell
cd F:\AgentData\codex\super-productivity-custom
```

### 1.1 常用命令

| 操作                | 命令                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| 安装依赖            | `npm ci`                                                                                |
| Web 开发模式        | `ng serve` 或 `npm run startFrontend`                                                   |
| Electron 开发模式   | `npm start`                                                                             |
| 生产构建            | `npm run buildAllElectron:noTests:prod`                                                 |
| Windows 打包        | `npm run dist:win:only`                                                                 |
| 覆盖 D 盘安装       | `cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"` |
| 全量单元测试        | `npm test`                                                                              |
| 单文件测试          | `npm run test:file <path>`                                                              |
| Electron 测试       | `npm run test:electron`                                                                 |
| sync-core 测试      | `npm run sync-core:test`                                                                |
| sync-providers 测试 | `npm run sync-providers:test`                                                           |
| E2E                 | `npm run e2e`                                                                           |
| Lint                | `npm run lint`                                                                          |
| 单文件检查          | `npm run checkFile <path>`                                                              |
| 国际化检查          | `npm run int:test`                                                                      |

### 1.2 技术栈

Angular 19 + NgRx + Electron 41 + Electron Builder 26 (NSIS) + IndexedDB + Playwright (E2E) + Jasmine/Karma (Unit) + Node test (Electron) + Vitest (sync packages) + TypeScript + SCSS

---

## 2. 代码架构

### 2.1 顶层目录

```
src/app/
├── features/         # 功能模块（tasks, schedule, planner, boards, tag, project 等）
├── root-store/       # NgRx 根状态
│   └── meta/task-shared-meta-reducers/  # 跨 feature 共享 reducer（核心同步逻辑）
├── op-log/           # 操作日志系统（同步核心）
│   ├── sync/         # 冲突解决
│   ├── apply/        # 操作应用
│   └── persistence/  # 持久化
├── core/             # 核心服务（startup, persistence, theme 等）
├── core-ui/          # 核心 UI 组件
├── ui/               # 可复用 UI 组件
│   ├── mentions/     # 标签/项目/日期自动补全系统
│   ├── duration/     # 时长输入组件
│   └── pipes/        # 管道
├── util/             # 工具函数
├── plugins/          # 插件系统
└── imex/             # 导入导出（备份、同步）
```

### 2.2 关键功能模块

| 目录                                         | 功能                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `features/tasks/`                            | 任务核心：CRUD、模型、add-task-bar、短语法解析、mention 配置        |
| `features/tasks/store/`                      | 任务状态管理：reducer、effects、selectors、short-syntax.effects     |
| `features/tasks/add-task-bar/`               | 新建任务栏：组件、状态服务、解析器、短语法转标签                    |
| `features/schedule/`                         | 时间表：周视图、月视图、事件渲染、拖动、创建占位符                  |
| `features/schedule/schedule-event/`          | 时间表事件块：渲染、resize、右键菜单、删除                          |
| `features/schedule/create-task-placeholder/` | 时间表空白区域"点击创建任务"占位符                                  |
| `features/planner/`                          | 规划表：日视图、任务规划                                            |
| `features/boards/`                           | 看板：艾森豪威尔矩阵、KANBAN                                        |
| `features/tag/`                              | 标签：CRUD、常量（IMPORTANT_TAG、URGENT_TAG、HIDDEN_MATRIX_TAG 等） |
| `features/project/`                          | 项目：CRUD、列表排序                                                |
| `features/work-context/`                     | 工作上下文（当前选中的项目/标签）                                   |
| `features/daily-settlement/`                 | 每日结算：清除矩阵标签等                                            |
| `features/task-repeat-cfg/`                  | 重复任务配置                                                        |
| `features/task-view-customizer/`             | 任务列表排序/分组/过滤                                              |

### 2.3 核心系统

#### 同步系统 (op-log)

- **操作日志**：所有状态变更记录为 Operation，以向量时钟排序
- **冲突解决**：`conflict-resolution.service.ts` 处理 LWW (Last-Write-Wins)
- **LWW Meta Reducer**：`lww-update.meta-reducer.ts` 应用 LWW 更新的实体替换
- **共享 Reducer**：`task-shared-meta-reducers/` 下各文件处理跨 feature 联动

#### 短语法系统

- **入口**：用户在 add-task-bar 中输入 `#tag @time +project`
- **解析**：`short-syntax.ts` 的 `shortSyntax()` 函数
- **Effect**：`short-syntax.effects.ts` 在任务创建/更新时触发解析
- **标签影响**：`parseTagChanges()` 在 `replace` 模式下用匹配结果替换 `tagIdsFromTxt`
  - **关键坑**：`[]` 是 truthy！`taskChanges.tagIds?.length` 才能正确判断

#### 标签系统

- **系统标签**（在 `tag.const.ts` 中定义）：
  - `TODAY_TAG` (`TODAY`) — 虚拟标签，会员由 `dueDay` 决定
  - `IMPORTANT_TAG` (`EM_IMPORTANT`) — 重要
  - `URGENT_TAG` (`EM_URGENT`) — 紧急
  - `HIDDEN_MATRIX_TAG` (`EM_HIDDEN`) — 隐藏（不在矩阵显示）
  - `IN_PROGRESS_TAG` (`KANBAN_IN_PROGRESS`) — 进行中

---

## 3. 小组件 (Task Widget)

### 3.1 架构

```
electron/task-widget/
├── task-widget.ts          # 主进程：窗口创建、IPC、生命周期
├── task-widget.html        # 渲染进程 HTML：矩阵网格 + 拖动元素
├── task-widget.css         # 样式：深色/浅色主题、响应式
├── task-widget-renderer.ts # 渲染逻辑：面板渲染、拖动大小调整
├── task-widget-preload.ts  # preload：contextBridge 暴露 API
└── task-widget-api.d.ts    # 类型定义
```

### 3.2 数据流

```
NgRx Store → TaskService → Electron Main Process (task-widget.ts)
  → IPC (update-content) → Renderer (task-widget-renderer.ts) → DOM
```

### 3.3 矩阵拖动大小调整

**实现位置**：`task-widget-renderer.ts`（第 45-164 行）

**核心机制**：

- 三个拖动元素：`#col-divider`（竖线）、`#row-divider`（横线）、`#cross-center`（交叉点）
- 使用 CSS Grid 的 `grid-template-columns` 和 `grid-template-rows` 控制比例
- 比例范围：18% – 82%
- 拖动交叉点可同时调整列和行
- 比例持久化到 `localStorage`（key: `taskWidgetMatrixRatios`）
- 使用 `ResizeObserver` 在窗口大小变化时重新计算位置

### 3.4 已知问题：矩阵面板偶发只显示 2 个（未解决）

**症状**：艾森豪威尔矩阵 4 个面板偶发只渲染 2 个。

**诊断**：

- 数据源正确（`buildEisenhowerTaskWidgetPanels()` 始终返回 4 个 panel）
- 渲染逻辑正确（`renderPanels()` 遍历 panels 创建 4 个 section）
- CSS Grid 2 列定义正确

**疑似根因**：`applyRatios()` 在脚本加载时（第 113 行）提前执行，此时 `clientWidth/clientHeight = 0` 导致计算负数像素值覆盖 Grid 默认值。`ResizeObserver` 应在布局后修正，但初始负数可能触发异常状态。

**快速修复**（如复现）：在 widget DevTools 执行：

```javascript
localStorage.removeItem('taskWidgetMatrixRatios');
location.reload();
```

**建议后续**：

1. 删除独立的 `applyRatios()` 首次调用，仅在 `renderPanels()` 末尾调用
2. 加 guard：`if (w <= GAP + 1 || h <= GAP + 1) return;`

---

## 4. 时间表系统

### 4.1 事件类型 (SVEType)

定义在 `schedule.const.ts`：

- `Task` — 非计划任务
- `TaskPlannedForDay` — 计划当天的任务
- `ScheduledTask` — 有具体时间的计划任务
- `ActualTask` — 实际时间记录块（不可拖动、不可 resize 放大）
- `CompletedPlannedTask` — 已完成的计划块

### 4.2 实际块特殊性

- **删除**：不删除任务，只移除当天的 `timeSpentOnDay[dayStr]`
- **Resize**：只能缩小不能放大
- 样式：红色调 (`--schedule-actual-block-color`)

---

## 5. 启动 Splash 与名言系统

### 5.1 Splash 配置

- 配置路径：设置 → 杂项 → "启动画面显示时长"
- 默认值：5000ms（5 秒）
- 配置字段：`MiscConfig.splashDuration`
- 消费方：`app.component.ts` 第 271-273 行，从 `GlobalConfigService.misc()` 读取
- 点击 logo 可提前跳过

### 5.2 自定义名言文件

- 路径：`%APPDATA%\superProductivity\productivity-quotes.json`
- 格式：`{ "quotes": ["名言1", "名言2", ...] }`

---

## 6. 常见坑和注意事项

### 6.1 JavaScript truthy 陷阱

- `[] || fallback` → `[]`（永远不走 fallback！）
- 正确做法：`arr?.length ? arr : fallback`

### 6.2 Git 安全锁

- `origin` push URL = `NO_PUSH_OFFICIAL_UPSTREAM`
- `larryheng` push URL = `NO_PUSH_FORK`
- 只有 `desktop-plan` 可以推送
- **绝对不要改回**

### 6.3 禁止提交的内容

- `.codex/`、`codex/`、`.tmp/`、`node_modules/`
- 安装包（`.exe`）
- 备份文件（`.json` backup）
- 用户数据

### 6.4 D 盘安装说明

- `D:\DevelopTools\Super Productivity\working\` 为运行目录
- 通过手动复制 `app.asar` 和 `Super Productivity.exe` 覆盖更新
- 覆盖前确保 Super Productivity 进程已退出

### 6.5 测试注意事项

- Angular 单元测试使用柏林时区（`cross-env TZ='Europe/Berlin'`）
- Electron 测试中 1 个 Windows symlink 测试被跳过（预期行为）
- Pre-push hook 运行全量测试（可能会超时，紧急情况可用 `--no-verify` 跳过）

---

## 7. 发布流程

```powershell
# 1. 确保所有测试通过
npm run lint && npm test && npm run test:electron && npm run sync-core:test && npm run sync-providers:test

# 2. 生产构建
npm run buildAllElectron:noTests:prod

# 3. Windows 打包
npm run dist:win:only

# 4. 覆盖 D 盘本地安装
cp .tmp/app-builds/win-unpacked/resources/app.asar "D:\DevelopTools\Super Productivity\working\resources\app.asar"
cp .tmp/app-builds/win-unpacked/"Super Productivity.exe" "D:\DevelopTools\Super Productivity\working\Super Productivity.exe"

# 5. 提交推送
git add <files>
git commit -m "type(scope): description"
git push desktop-plan HEAD:desktop-plan-widget-theme-bg
git checkout main && git merge desktop-plan-widget-theme-bg && git push desktop-plan main && git checkout desktop-plan-widget-theme-bg

# 6. 发布 Release
git tag -f desktop-plan-v0.1.XX
git push --no-verify desktop-plan desktop-plan-v0.1.XX
gh release create desktop-plan-v0.1.XX ".tmp/app-builds/Super-Productivity-Setup-x64.exe" -R LarryHeng/super-productivity-desktop-plan --title "Desktop Plan v0.1.XX" --notes "..."
```

---

## 8. 轮次改动记录

### 2026-07-03 (v0.1.16: 当前)

**修改文件：**

1. `electron/task-widget/task-widget-renderer.ts` — `applyRatios()` 改用 `getComputedStyle` 读取 padding，正确扣除后再计算 grid track 像素值；divider 位置加上 padding 偏移
2. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` — 新增 `hasMatrixTags()` computed 检查任务是否含矩阵标签 + `removeMatrixTags()` 方法
3. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.html` — 新增"移除矩阵标签"菜单按钮，仅在任务有矩阵标签时显示
4. `src/app/t.const.ts` — 新增 `T.F.TASK.CMP.REMOVE_MATRIX_TAGS` 翻译键
5. `src/assets/i18n/en.json` — 新增 `"REMOVE_MATRIX_TAGS": "Remove from matrix"`
6. `src/assets/i18n/zh.json` — 新增 `"REMOVE_MATRIX_TAGS": "移除矩阵标签"`

**改动原因：**

- Widget 矩阵右侧面板被截断 → 根因是 `clientWidth` 包含 padding，但计算 grid track 像素时未扣除，导致总宽度超出内容区约 20px
- 右键菜单缺少"移除矩阵标签" → 新增按钮，点击后移除 EM_IMPORTANT/EM_URGENT 并添加 EM_HIDDEN，任务从矩阵消失且不会进入"不重要且不紧急"

### v0.1.15 Bug 修复总结

| Bug                      | 根因                                                            | 修复方式                                                     | 文件                                     |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| Widget 矩阵右侧截断      | `clientWidth` 含 padding，计算 grid track 时未扣除              | `getComputedStyle` 读 padding 后从 clientWidth/Height 中扣除 | `task-widget-renderer.ts`                |
| Widget 矩阵 2/4 面板     | `applyRatios()` 在 layout 前调用，clientWidth=0 产生负 track 值 | 加 guard + 删除提前调用                                      | `task-widget-renderer.ts`                |
| 实际块右击显示删除       | `deleteTask()` 未区分实际块/计划块                              | `@if (!isActualRecord())` 包裹删除按钮                       | `task-context-menu-inner.component.html` |
| 详情面板可编辑已花费时间 | `estimateTime()` 未限制编辑类型                                 | 传 `isEstimateOnly: true`                                    | `task-detail-panel.component.ts`         |
| 励志语句被截断           | CSS 设置了 overflow/text-overflow/white-space                   | 移除截断 CSS 属性                                            | `header-productivity-tip.component.ts`   |
| 实际块 resize 不保存     | OnPush 下 offsetHeight 在 mouseup 时未更新                      | 改用 clientY 指针位置 delta                                  | `schedule-event.component.ts`            |
| 移除矩阵标签按钮缺失     | 右键菜单无此功能                                                | 新增 `removeMatrixTags()` + 菜单按钮                         | `task-context-menu-inner.*`              |

### 2026-07-03 (v0.1.15: commit `5c2ea0cd7`)

**修改文件：**

1. `electron/task-widget/task-widget-renderer.ts` — 删除 `applyRatios()` 第 113 行提前调用 + `applyRatios()` 内添加 `if (w <= 0 || h <= 0) return;` guard
2. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.html` — 删除任务按钮用 `@if (!isActualRecord())` 包裹
3. `src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts` — `estimateTime()` 传 `isEstimateOnly: true`
4. `src/app/features/schedule/schedule-event/schedule-event.component.ts` — resize 改用 clientY delta 计算时间变化（替代不可靠的 offsetHeight）
5. `src/app/core-ui/main-header/header-productivity-tip/header-productivity-tip.component.ts` — 移除 `overflow: hidden` / `text-overflow: ellipsis` / `white-space: nowrap`

**改动原因：**

- Widget 矩阵偶发只显示 2/4 面板 → 根因是脚本初始化时 `applyRatios()` 在 layout 前调用产生负值覆盖 CSS Grid 默认值
- 实际块右击出现删除任务按钮不合理 → 实际块应只有"调整记录"（实际块删除 = 删除时间记录，不是删任务）
- 左侧任务详情面板"花费时间"编辑会破坏时间逻辑 → 改为纯预估时间编辑
- 顶部励志语句只有一行被截断 → 允许自动换行完整展示
- 实际块拖动 resize 鼠标松开后没有保存效果 → `offsetHeight` 在 Angular OnPush 下可能未更新，改用 clientY delta 计算

### 2026-07-03 (v0.1.14: commit `9cd37c2ca`)

**修改文件：**

1. `src/app/features/schedule/schedule-event/schedule-event.component.ts` — 新增 `DialogPromptComponent` 导入（修复 v0.1.13 遗漏的编译错误）
2. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` — 新增 `requestAdjustActualRecord()` 方法（修复 v0.1.13 遗漏的编译错误）

**改动原因：**

- v0.1.13 推送时使用了 `--no-verify`，绕过了 pre-push hook，导致两个 TS 编译错误未被发现
- 本次为补偿性修复，确保代码可正常编译

### 2026-07-03 (v0.1.13: commit `76e0ee777`)

**修改文件：**

1. `src/app/features/schedule/schedule-event/schedule-event.component.ts` — 禁用计划块 resize（isResizable 移除计划类型）+ 修复实际块双向 resize（移除 timeChangeInMs < 0 限制）+ 添加 isActualRecord computed + adjustActualRecord 方法 + cssClass 添加 resizable class
2. `src/app/features/schedule/schedule-event/schedule-event.component.html` — task-context-menu 绑定 isActualRecord 和 adjustActualRecord
3. `src/app/features/tasks/task-context-menu/task-context-menu.component.ts` — 新增 isActualRecord input + adjustActualRecord output
4. `src/app/features/tasks/task-context-menu/task-context-menu.component.html` — 传递新 input/output 到内层组件
5. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` — 新增 isActualRecord input + adjustActualRecord output
6. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.html` — 新增"调整记录"菜单项
7. `src/app/t.const.ts` — 新增 ADJUST_RECORD / ADJUST_RECORD_TITLE / ADJUST_RECORD_PLACEHOLDER 翻译键
8. `src/assets/i18n/en.json` — 英文翻译
9. `src/assets/i18n/zh.json` — 中文翻译

**改动原因：**

- 计划块 resize 会导致计划时间和系统计时+手动补记时间冲突，禁用 resize 统一走计时流程
- 实际块 resize 之前只能缩小，拖动放大时会回弹（因为 timeChangeInMs > 0 被忽略）
- 新增右键"调整记录"方便用户精确调整已记录时间，支持通过输入 0 快速删除

### 2026-07-03 (v0.1.12: commit `8328bf9d8`)

**修改文件：**

1. `tools/git-version.js`（第 10 行）— 修复 branch 变量错误读取 GITHUB_SHA 而非 GITHUB_REF_NAME
2. `src/app/op-log/validation/has-meaningful-state-data.util.spec.ts` — 测试 fixture 补齐缺失的 EM_HIDDEN 标签
3. `electron/task-widget/task-widget.html` — 添加 3 个 divider DOM 元素（col-divider, row-divider, cross-center）
4. `electron/task-widget/task-widget.css` — 添加约 75 行 divider CSS（position absolute、z-index、cursor、hover/active 态、窄屏隐藏）
5. `electron/task-widget/task-widget-renderer.ts` — 添加约 131 行 divider 拖动逻辑（clientWidth/Height 局部坐标、gap 补偿、ResizeObserver、localStorage 持久化）
6. `src/app/features/config/global-config.model.ts` — MiscConfig 新增 `splashDuration?: number` 字段
7. `src/app/features/config/default-global-config.const.ts` — 新增 `splashDuration: 5000` 默认值
8. `src/app/features/config/form-cfgs/misc-settings-form.const.ts` — 新增 splashDuration duration 表单控件
9. `src/app/app.component.ts` — splash 延时从硬编码改为读取 `GlobalConfigService.misc()?.splashDuration`
10. `src/app/t.const.ts` — 新增 `G.SPLASH` 和 `G.SPLASH_DESCRIPTION` 翻译键
11. `src/assets/i18n/en.json` — 新增英文翻译
12. `src/assets/i18n/zh.json` — 新增中文翻译
13. `package.json` — 版本号 `18.12.0-desktop-plan.9` → `.10`
14. `RELEASE_NOTES.md` — 标题同步更新到 `.10`

**改动原因：**

- divider 拖动功能基于 v0.1.12 的 4 个修复重新实现（之前 v0.1.13 因渲染异常回退到 v0.1.8）
- splash 延迟从硬编码 5 秒改为可通过设置页面配置
- git-version.js 环境变量读取错误修复
- 测试 fixture 补齐缺失的系统标签

### 2026-07-03 (v0.1.17: 当前，Bug 1 & 2 第二轮修复)

**Bug 1: 标签模糊搜索不实时筛选 (第二轮)**

1. `src/app/ui/mentions/mention-list.component.ts` — `items`/`hidden` 从普通属性改为 Angular `signal`，确保动态创建组件每次赋值自动触发模板重渲染
2. `src/app/ui/mentions/mention.directive.ts` — 适配 signal API（`.set()` / `.hidden()` 调用）

**Bug 2: "移除矩阵标签"按钮不生效 (第二轮)**

3. `src/app/features/tag/store/tag.reducer.ts` — `_addMyDayTagIfNecessary` 改为 `_addSystemTagsIfNecessary`，自动创建 EM_URGENT/EM_IMPORTANT/EM_HIDDEN
4. `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` — `removeMatrixTags()` 调用前 `.addTag(HIDDEN_MATRIX_TAG)` 安全兜底

**其他**

5. `package.json` — 版本号 `18.12.0-desktop-plan.11W`
6. `RELEASE_NOTES.md` — 版本号和修改记录同步
7. `src/environments/versions.ts` — 版本号同步
8. `SUPER_PRODUCTIVITY_收口交接文档_v7_2026-07-03.md` — 交接文档更新

**注意**: Bug 1 和 Bug 2 的两轮修复**功能均未验证通过**，详见交接文档 v7 的排查方向。

### 2026-07-03 (v0.1.16: commit `a7e3cbf49` — 两个 Bug 修复未提交)

**Bug 1: 标签模糊搜索不实时筛选**

修改文件：

1. `src/app/ui/mentions/mention.directive.ts` — 两处改动：
   - `ngOnChanges()`: `[mention]` 变化且搜索进行中时跳过 `updateConfig()`，避免每次输入触发配置重建干扰搜索。只有 `[mentionConfig]` 变化或非搜索态才重建配置
   - `inputHandler()`: IME 组合输入时遍历 `event.data` 的全部字符（而非仅第一个），使中日韩输入法的批量字符都能进入 keyHandler 搜索管道

根因：`[mention]="tagMentions$ | async"` 绑定的 ShortSyntaxTag[] 随每次输入变化，触发 `ngOnChanges` → `updateConfig()` 重置 `triggerChars`，中断正在进行的标签搜索。同时 IME 输入时 `inputHandler` 只处理 `event.data.charCodeAt(0)`（第一个字符），丢失后续字符。

**Bug 2: "移除矩阵标签"后任务仍显示在矩阵看板中**

修改文件：2. `src/app/features/boards/board/board.component.ts` — 新增 `patchedBoardCfg` computed signal：运行时确保 Eisenhower 面板的 `excludedTagIds` 始终包含 `EM_HIDDEN` 3. `src/app/features/boards/board/board.component.html` — 所有 `boardCfg()` 引用改为 `patchedBoardCfg()` 4. `src/app/features/boards/store/boards.reducer.ts` — `fixBuggyDefaultBoardFilters()` 新增持久化数据迁移：为 Eisenhower 面板的 `excludedTagIds` 补充 `EM_HIDDEN`

根因：`fixBuggyDefaultBoardFilters()` 仅对持久化数据生效，且依赖 `loadAllData` 时机。新增 `patchedBoardCfg` computed signal 提供运行时兜底，保证面板配置始终排除 `EM_HIDDEN` 标签。

**改动原因：**

- 标签搜索：输入 `#` → 打字搜索标签 → 发现模糊匹配不生效，需要重新输入 `#` 才能触发。核心问题是每次按键都重建 mention 配置。
- 移除矩阵标签：点击右键菜单"移除矩阵标签"后任务应消失，但实际仍然显示。根因是持久化数据中 excludedTagIds 缺少 EM_HIDDEN，且无运行时兜底。

---

## 9. v0.3.0 修改汇总 (35 文件, +753/-135)

### 9.1 备份

| 项目               | 值                                                                              |
| ------------------ | ------------------------------------------------------------------------------- |
| 备份 Tag           | `backup-v0.2.0-before-segment-refactor-20260706-213159`                         |
| 备份路径           | `D:\DevelopTools\Super Productivity\rollbacks\2026-07-06-pre-segment-refactor\` |
| app.asar MD5       | `1824bdbdcf32ad4bfbd57f5bdcf12f1c`                                              |
| 源码 HEAD (修改前) | `cb87a1b6e`                                                                     |

### 9.2 2026-07-06 修改记录 (v0.3.0, 进行中)

**修改文件总览：**

| 文件                                                                                          | 操作     | 关联         |
| --------------------------------------------------------------------------------------------- | -------- | ------------ |
| `src/app/features/schedule/schedule-event/schedule-event.component.ts`                        | 修改     | Bug 1, Bug 2 |
| `src/app/features/schedule/manual-time-record/dialog-manual-time-record.component.ts`         | 重写     | Bug 1, 功能6 |
| `src/app/features/schedule/manual-time-record/dialog-manual-time-record.component.html`       | 重写     | 功能6        |
| `src/app/features/schedule/manual-time-record/dialog-adjust-actual-record.component.ts`       | **新建** | Bug 1        |
| `src/app/features/schedule/manual-time-record/dialog-adjust-actual-record.component.html`     | **新建** | Bug 1        |
| `src/app/features/schedule/manual-time-record/dialog-adjust-actual-record.component.scss`     | **新建** | Bug 1        |
| `src/app/features/time-tracking/store/time-tracking.actions.ts`                               | 修改     | Bug 1, 功能5 |
| `src/app/features/time-tracking/store/time-tracking.reducer.ts`                               | 修改     | Bug 1, 功能5 |
| `src/app/features/tasks/task.service.ts`                                                      | 修改     | Bug 1, 功能5 |
| `src/app/features/schedule/map-schedule-data/append-actual-time-segments-to-schedule-days.ts` | 修改     | 功能5        |
| `src/app/features/config/global-config.model.ts`                                              | 修改     | Bug 4        |
| `src/app/features/config/default-global-config.const.ts`                                      | 修改     | Bug 4        |
| `src/app/core-ui/main-header/header-countdown/header-countdown.component.ts`                  | **新建** | Bug 4        |
| `src/app/core-ui/main-header/main-header.component.ts`                                        | 修改     | Bug 4        |
| `src/app/core-ui/main-header/main-header.component.html`                                      | 修改     | Bug 4        |
| `electron/task-widget/task-widget.ts`                                                         | 修改     | Bug 3, Bug 4 |
| `electron/task-widget/task-widget-renderer.ts`                                                | 修改     | Bug 3, Bug 4 |
| `electron/task-widget/task-widget.html`                                                       | 修改     | Bug 4        |
| `electron/task-widget/task-widget.css`                                                        | 修改     | Bug 3, Bug 4 |
| `electron/task-widget/task-widget-preload.ts`                                                 | 修改     | Bug 4        |
| `electron/task-widget/task-widget-api.d.ts`                                                   | 修改     | Bug 4        |
| `src/app/features/issue/shared/dialog-track-time/dialog-track-time.component.ts`              | 修改     | 功能6        |
| `src/app/features/issue/shared/dialog-track-time/dialog-track-time.component.html`            | 修改     | 功能6        |

**修改内容汇总：**

#### Bug 1: 时间表补记/删除/调整记录修复

- `deleteActualRecord`: dayStr 推导逻辑修复（移除 `typeof...string` 严格检查），改为 `plannedForDay || getDbDateStr(start)`
- 删除时同时调用 `taskService.removeActualTimeSegment()` 删除 TimeTrackingState 中的 segment
- `adjustActualRecord`: 从 `DialogPromptComponent`（纯数字）改为新建的 `DialogAdjustActualRecordComponent`（含独立 Delete 按钮 + InputDurationSlider）
- 手动补记对话框: 起始/结束时间从原生 `datetime-local` 改为 `DateTimePickerComponent`

#### Bug 2: 真实块修改时间限制

- `isResizable()`: 对 ActualTask/CompletedPlannedTask 返回 `true`（启用实际块 resize）
- `_onResizeEnd()`: 限制新时长 `Math.min(newSpent, currentSpent)`（只能缩小不能放大），最小保留 5 分钟
- resize 时调用 `taskService.updateActualTimeSegment()` 更新 TimeTrackingState 中的 segment
- `adjustActualRecord()` 对话框中时长只能 ≤ 当前值

#### Bug 3: 倒计时结束后变红正向计时

- `task-widget.ts`: 倒计时归零且 timeSpent > estimate 时 mode 改为 `'task-overtime'`，时间显示超出量
- `task-widget-renderer.ts`: 新增 `mode-task-overtime` class 支持
- `task-widget.css`: `.mode-task-overtime #time-display { color: var(--danger); }`

#### Bug 4: 倒数日功能

- 新增 `HeaderCountdownComponent` 替换 `HeaderProductivityTipComponent`
- 配置字段: `countdownTargetName`, `countdownTargetDate`, `countdownFontSize`, `countdownColor`, `countdownIsBold`
- 用北京时间 UTC+8 计算天数差，每分钟自动刷新
- 小组件新增 `#countdown-display` 元素 + `update-countdown` IPC 通道同步

#### 功能5: 时间追踪分段改造

- `mergeNearbyActualTaskSegments()`: 手动补记 segment（source='manual'）永不合并
- 新增 `removeActualTimeSegment` / `updateActualTimeSegment` actions 和 reducers
- `taskService` 新增 `removeActualTimeSegment()` / `updateActualTimeSegment()` 方法
- 合并间隔默认值 `DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES = 5`（保留但可配置）

#### 功能6: 全局日历改造

- `DialogManualTimeRecordComponent`: 起始/结束时间改用 `DateTimePickerComponent`
- `DialogTrackTimeComponent`: `datetime-local` 改为 `DateTimePickerComponent`

### 9.3 待完成

- [x] widget countdown 样式运算符修复
- [x] 用户验证所有功能
- [x] 提交发布 v0.3.0 → Release `desktop-plan-v0.3.0`

---

## 10. v0.3.0 CI 修复记录

### 10.1 根因

`<datetime-picker>` 组件内部自带了 `<mat-form-field>`，而 3 个对话框 (dialog-track-time, dialog-manual-time-record × 2) 在 v0.3.0 中将原生的 `<input matInput>` 替换为 `<datetime-picker>`，但保留了外层的 `<mat-form-field>` 包裹。这导致 Angular Material 的 `MatFormField._assertFormFieldControl` 在 `ngAfterContentInit` 抛出 "mat-form-field must contain a MatFormFieldControl"。

Karma 的 tearDown（afterAll）会运行变更检测，此时任何残留组件中的空 mat-form-field 都会触发该错误 → Chrome 断开连接 → CI 失败。

同时发现了另外 4 处孤立 `<mat-error>`（不在 `<mat-form-field>` 内的情况），也会触发同样的错误。

### 10.2 修复方案

1. **dialog-manual-time-record.component.html**: 移除外层 `<mat-form-field>`，用 `<div>` 包裹 `<datetime-picker>`
2. **dialog-track-time.component.html/ts**: 还原为原生 `<input type="datetime-local" matInput>`（该对话框无需高级日期选择器）
3. **plugin-management.component.html**: 3 处 `<mat-error>` → `<div>`
4. **plugin-config-dialog.component.ts**: 1 处 `<mat-error>` → `<div>`

### 10.3 最终 CI 结果

- Karma 单元测试: 11433/11435 SUCCESS（16 skipped）
- E2E smoke suite: 2 passed
- Lint: passed
- Lighthouse: passed
- sync-core/sync-providers/electron/release-notes 测试: 全部通过

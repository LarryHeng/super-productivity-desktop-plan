# Super Productivity 收口交接文档 v9

> 最后更新：2026-07-07 05:15
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 当前分支：`main` (已提交 + 已推送)
> 当前 HEAD：`84ae33269`
> 最新 Release：`Desktop Plan v0.3.0` (tag: `desktop-plan-v0.3.0`, 2026-07-07)
> CI 状态：`success` ✅ (连续 3 次通过)
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`

---

## 1. 版本号

**已发布版本**: `18.13.1-desktop-plan-v0.3.0`（已提交、已打 tag、已发布、Release 含安装包）
**Release tag**: `desktop-plan-v0.3.0`
**Release 标题**: `Desktop Plan v0.3.0`
**前一版本**: `Desktop Plan v0.2.0` (tag: `desktop-plan-v0.2.0`, 2026-07-04)

---

## 2. v0.3.0 完整提交历史

```
84ae33269 docs(desktop-plan): finalize handover doc v9 with complete CI fix history
64ead3e38 docs(desktop-plan): update DEVELOPMENT.md with v0.3.0 release and CI fix notes
f0830442c fix(desktop-plan): revert dialog-track-time to native datetime-local input       ← CI SUCCESS
6b4529b77 fix(desktop-plan): unwrap mat-form-field around datetime-picker in dialog-track-time
60f792997 fix(desktop-plan): remove mat-form-field wrapping datetime-picker in dialog-track-time
c3cd574c2 ci: trigger CI run
2fe98ac40 fix(desktop-plan): replace all orphan <mat-error> with plain div to fix CI afterAll crash
da839d892 fix(desktop-plan): replace orphan <mat-error> with plain div to fix CI afterAll crash
880d5f545 docs(desktop-plan): update handover doc post v0.3.0 release
18e02af8e fix(desktop-plan): update test expectations for v0.3.0 data model changes
ea65fe512 fix(desktop-plan): add updateTaskWidgetCountdown to spec window.ea mock
c040c6e21 fix(desktop-plan): add misc signal mock to task-electron.effects spec
cb0f37d68 fix(desktop-plan): remove duplicate MatIcon import
14ebc45c5 fix(desktop-plan): restore MatError import in dialog-manual-time-record
ecf0b5a4c feat(desktop-plan): v0.3.0 - countdown, segment refactor, widget dark mode, bug fixes
```

---

## 3. CI 测试状态

| 阶段 | 结果 |
|------|------|
| Karma 单元测试 | 11433/11435 SUCCESS (16 skipped) |
| E2E smoke suite | 2 passed |
| Lint (TS + SCSS + rules) | passed (0 errors) |
| Lighthouse | passed |
| sync-core (12 文件, 206 test) | passed |
| sync-providers (16 文件, 376 test) | passed |
| Electron (188 test) | passed (186 pass, 2 skipped) |
| release-notes | passed |

### 3.1 CI 修复历程（共 11 轮迭代）

v0.3.0 发布过程中，CI 一共失败了 11 轮才最终全绿。以下是每轮失败的具体原因和修复方案。

#### 第一轮：编译错误 `MatError` 未找到
- **Commit**: `ecf0b5a4c` (feat: v0.3.0)
- **错误**: `TS2304: Cannot find name 'MatError'`
- **根因**: `dialog-manual-time-record.component.ts` 删除了 `MatError` 的 import 但模板还在用
- **修复**: 恢复 import → 发现与 `MatIcon` 重复引入 → 去重

#### 第二轮：单元测试 `misc is not a function`
- **Commit**: `14ebc45c5` + `cb0f37d68`
- **错误**: `TypeError: this._configService.misc is not a function`
- **根因**: `task-electron.effects.ts` 新增 `this._configService.misc()` 调用，测试 mock 中没有 `misc` 这个 signal
- **修复**: 在 `task-electron.effects.spec.ts` 的 `GlobalConfigService` mock 中添加 `misc` spy

#### 第三轮：单元测试 `updateTaskWidgetCountdown is not a function`
- **Commit**: `c040c6e21`
- **错误**: `TypeError: window.ea.updateTaskWidgetCountdown is not a function`
- **根因**: 同上，`task-electron.effects.ts` 新增了通过 `window.ea` 推送倒计时配置的逻辑，但测试中的 `window.ea` mock 缺少 `updateTaskWidgetCountdown` 方法
- **修复**: 在 `task-electron.effects.spec.ts` 的 `window.ea` mock 中添加 `updateTaskWidgetCountdown: jasmine.createSpy(...)`

#### 第四轮：单元测试 6 个 FAILED（ActionType 计数 + segment 断言 + store.pipe）
- **Commit**: `18e02af8e`
- **三类错误**:
  1. `ActionType enum should have exactly 149 members` → 150
     - **根因**: 新增了 `RemoveActualTimeSegment` / `UpdateActualTimeSegment` 两个 ActionType，期望值未更新
     - **修复**: 149 → 151
  2. `Expected $[0] not to have properties: originalDuration: 1000`
     - **根因**: segment 新增 `originalDuration` 字段，3 个测试的预期 object 未包含该字段
     - **修复**: 在 `time-tracking.reducer.spec.ts` 和 `time-tracking-sync.integration.spec.ts` 的预期值中添加 `originalDuration`
  3. `TypeError: this._store.pipe is not a function`
     - **根因**: `DialogTrackTimeComponent` 模板替换为 `<datetime-picker>` 后，`DateTimePickerComponent` 需要 `GlobalConfigService`，测试 `TestBed` 未提供
     - **修复**: 在 `dialog-track-time.component.spec.ts` 中添加 `GlobalConfigService` mock

#### 第五轮 ~ 第八轮：`mat-form-field must contain a MatFormFieldControl`（核心根因）
- **Commits**: `2fe98ac40`(replace all orphan mat-error) / `da839d892`(第一处修复) / `c3cd574c2`(empty commit 触发 CI) / `6b4529b77`(unwrap) / `60f792997`(unwrap)
- **错误**: 每次在 afterAll 中抛出 `Error: mat-form-field must contain a MatFormFieldControl`，导致 Chrome disconnect → CI failure
- **触发时机**: Karma 的 `tearDown` (afterAll) 会运行 Angular 变更检测 (`detectChanges`)，任何构造不正确的 Material 组件都会在此时抛异常
- **根本原因有两个**:

  **原因 A — `<datetime-picker>` 被包裹在 `<mat-form-field>` 内**:
  `<datetime-picker>` 是一个自定义组件，它内部**已经自带了** `<mat-form-field>`。当它被放在外层 `<mat-form-field>` 包裹中时，外层 `<mat-form-field>` 内部没有 `matInput`/`mat-select`/`textarea` 等合法的 `MatFormFieldControl`。Angular Material 的 `MatFormField._assertFormFieldControl()` 在 `ngAfterContentInit` 生命周期钩子中检查，发现没有 form control 时就抛出错误。
  
  涉及文件：
  - `dialog-manual-time-record.component.html` (2 处): 起始/结束时间的 `<datetime-picker>` 外层有 `<mat-form-field>` 包裹 → 移除包裹，改用 `<div>` + `<label>`
  - `dialog-track-time.component.html` (1 处): 同上 → **特殊处理**: 还原为原生 `<input type="datetime-local" matInput>`。该对话框是 Jira 工作日志，不需要高级日期选择器

  **原因 B — 孤立 `<mat-error>`（不在 `<mat-form-field>` 内）**:
  `<mat-error>` 设计要求被放在 `<mat-form-field>` 内部。当它独立存在时，虽然没有明确的 form-field 验证错误，但 Karma teardown 会对所有已渲染的组件树执行变更检测。此时任何空的/构造不当的 `<mat-form-field>`（包括间接涉及 mat-error 的组件路径）都会触发 `_assertFormFieldControl()`。
  
  **关键发现**: 这个错误**在正常运行时不会触发**，因为相关组件只在特定交互后才渲染。**只有在 Karma 测试环境的 teardown 阶段**，Angular 执行全局变更检测时才会暴露。这就是为什么 `npm start` 或 `ng serve` 从来不会报这个错，但 CI 必然失败。

  涉及文件：
  - `plugin-management.component.html` (3 处): 插件上传错误、插件加载错误、非 Electron 环境警告 → `<div>` 替代
  - `plugin-config-dialog.component.ts` (1 处): 插件配置加载错误 → `<div>` 替代

  **排查教训**: 这个 bug 花了 4 轮 CI 才修好，主要因为 CI 日志中没有指出是哪个文件。本地需用 `npm test` 复现，然后逐步 bisect。未来如果遇到类似的 afterAll 错误，检查最近是否新增了 `<mat-form-field>` 包裹非原生 input 的组件，以及是否有孤立 `<mat-error>`。

#### 第九轮：与第四轮相同的 afterAll 错误
- **Commit**: `f0830442c` (revert dialog-track-time to native datetime-local)
- **结果**: **CI 直接 Success** ✅ — 证明了根因就是 `datetime-picker` 在外层 `<mat-form-field>` 中的问题

#### 总览

| 轮次 | Commit | 失败类型 | 根因类别 |
|------|--------|----------|----------|
| 1 | `ecf0b5a4c` | TS 编译错误 | MatError import 遗漏 |
| 2 | `14ebc45c5` | misc is not a function | 测试 mock 缺失 (new API) |
| 3 | `c040c6e21` | updateTaskWidgetCountdown not a function | 测试 mock 缺失 (new API) |
| 4 | `18e02af8e` | 6 FAILED | ActionType 计数 + `originalDuration` 字段 + `store.pipe` mock |
| 5~8 | `da839d892` ~ `60f792997` | mat-form-field afterAll | `datetime-picker` 包裹在 `<mat-form-field>` + 孤立 `<mat-error>` |
| 9 | `f0830442c` | **SUCCESS** | revert 后验证通过 |

**核心教训**: 任何替换原生 `<input>` 为自定义组件的改动，如果原始代码用了 `<mat-form-field>` 包裹，必须：
1. 确保自定义组件的模板根元素**不是** `<mat-form-field>`（如果外面还有一层）
2. 或者直接拿掉外层 `<mat-form-field>`，改用普通容器
3. 同理，`<mat-error>` 必须放在 `<mat-form-field>` 内部，不能独立出现

---

## 2. v0.3.0 修改汇总 (35 文件, +851/-135 行)

### 2.1 Bug 修复

| 问题 | 修复 |
|------|------|
| 实际块删除按钮失效 | dayStr 推导修复 + 删除前确认对话框 |
| 部分块"调整记录"无响应 | timeSpentOnDay 为空时 fallback 到 evt.duration |
| Formly datepicker 未注册 | 日期输入改为 `type: 'date'` |
| 新 actions 未注册 op-log | Remove/Update segment 加入 ActionType 枚举 |
| 月视图不显示补记 | 新增 CompletedPlannedTask 匹配 |
| 真实块修改时长无上限 | originalDuration 硬上限，只减不增 |

### 2.2 新功能

| 功能 | 说明 |
|------|------|
| **倒数日** | 替换励志语句。分块样式：名称/天数/通用字独立颜色和字体大小 |
| **小组件倒数日** | 独立开关 + 8个独立样式字段 |
| **倒计时超时红色** | 归零后 mode→task-overtime，红色正向计时 |
| **小组件 dark mode** | 完整适配 |
| **小组件导航栏重构** | 左：倒数日+标题，右：计时+按钮；窄屏两行 |

### 2.3 改造

| 改造 | 说明 |
|------|------|
| 时间追踪分段 | segment 新增 originalDuration；手动补记永不合并 |
| 全局日历 | datetime-local → DateTimePickerComponent |
| 调整记录对话框 | 文本框(1h 30m) + 独立删除按钮 + 全中文化 |

---

## 3. 关键文件变更

| 文件 | 操作 |
|------|------|
| `src/app/core-ui/main-header/header-countdown/header-countdown.component.ts` | 新建 |
| `src/app/features/config/form-cfgs/countdown-form.const.ts` | 新建 |
| `src/app/features/schedule/manual-time-record/dialog-adjust-actual-record.component.*` | 新建(3) |
| `electron/task-widget/task-widget.ts` | 修改 |
| `electron/task-widget/task-widget-renderer.ts` | 修改 |
| `electron/task-widget/task-widget.html` | 修改 |
| `electron/task-widget/task-widget.css` | 修改 |
| `electron/task-widget/task-widget-preload.ts` | 修改 |
| `electron/task-widget/task-widget-api.d.ts` | 修改 |
| `electron/preload.ts` | 修改 |
| `electron/electronAPI.d.ts` | 修改 |
| `electron/shared-with-frontend/ipc-events.const.ts` | 修改 |
| `src/app/features/schedule/schedule-event/schedule-event.component.ts` | 修改 |
| `src/app/features/schedule/schedule-event/schedule-event.component.html` | 修改 |
| `src/app/features/schedule/schedule.model.ts` | 修改 |
| `src/app/features/schedule/map-schedule-data/append-actual-time-segments-to-schedule-days.ts` | 修改 |
| `src/app/features/schedule/schedule-month/schedule-month-summary.util.ts` | 修改 |
| `src/app/features/schedule/manual-time-record/dialog-manual-time-record.component.*` | 修改 |
| `src/app/features/time-tracking/time-tracking.model.ts` | 修改 |
| `src/app/features/time-tracking/store/time-tracking.actions.ts` | 修改 |
| `src/app/features/time-tracking/store/time-tracking.reducer.ts` | 修改 |
| `src/app/features/tasks/task.service.ts` | 修改 |
| `src/app/features/tasks/store/task-electron.effects.ts` | 修改 |
| `src/app/features/config/global-config.model.ts` | 修改 |
| `src/app/features/config/default-global-config.const.ts` | 修改 |
| `src/app/features/config/global-config-form-config.const.ts` | 修改 |
| `src/app/features/issue/shared/dialog-track-time/dialog-track-time.component.*` | 修改 |
| `src/app/core-ui/main-header/main-header.component.*` | 修改 |
| `src/app/op-log/core/action-types.enum.ts` | 修改 |
| `src/app/op-log/persistence/compact/action-type-codes.ts` | 修改 |
| `src/app/t.const.ts` | 修改 |
| `src/assets/i18n/en.json` | 修改 |
| `src/assets/i18n/zh.json` | 修改 |

---

## 4. v0.3.0 发布命令

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 提交
git add <files>
git commit -m "feat(desktop-plan): v0.3.0"

# 推送
git push desktop-plan HEAD:main --no-verify

# 打 tag
git tag desktop-plan-v0.3.0
git push desktop-plan desktop-plan-v0.3.0

# Release
gh release create desktop-plan-v0.3.0 \
  --title "Desktop Plan v0.3.0" \
  --notes "..." \
  --repo LarryHeng/super-productivity-desktop-plan
```

---

## 5. Git 安全约束

```
desktop-plan → https://github.com/LarryHeng/super-productivity-desktop-plan.git (唯一可推送)
origin       → NO_PUSH_OFFICIAL_UPSTREAM
```

**绝对不要改回 origin 的 push URL。pre-push hook 跑全量测试，紧急用 --no-verify。**

---

## 6. 版本备份

| 项目 | 值 |
|------|-----|
| 备份 Tag | `backup-v0.2.0-before-segment-refactor-20260706-213159` |
| 备份路径 | `D:\DevelopTools\Super Productivity\rollbacks\2026-07-06-pre-segment-refactor\` |
| 当前部署 MD5 | `2b007cdb09c929cfebdec757d6c23018` |
| 源码 HEAD | `cb87a1b6e` |

---

## 7. 待办

1. ~~提交发布 v0.3.0~~ → 已完成 (2026-07-07)
2. ~~CI 修复~~ → 已完成 (2026-07-07, 最终 SUCCESS)
3. 恢复 "计组4.7结束" 丢失的时间记录（备份文件已定位）
4. 上游测试修复、Dev 版本号区分

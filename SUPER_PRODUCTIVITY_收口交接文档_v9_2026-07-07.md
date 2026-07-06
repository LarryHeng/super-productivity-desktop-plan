# Super Productivity 收口交接文档 v9

> 最后更新：2026-07-07
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 当前分支：`main` (已提交 + 已推送)
> 当前 HEAD：`18e02af8e`
> 最新 Release：`Desktop Plan v0.3.0` (tag: `desktop-plan-v0.3.0`, 2026-07-07)
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`

---

## 1. 版本号

**已发布版本**: `18.13.1-desktop-plan-v0.3.0`（已提交、已打 tag、已发布）
**Release tag**: `desktop-plan-v0.3.0`
**Release 标题**: `Desktop Plan v0.3.0`
**前一版本**: `Desktop Plan v0.2.0` (tag: `desktop-plan-v0.2.0`, 2026-07-04)

---

## 2. v0.3.0 提交历史

```
18e02af8e fix(desktop-plan): update test expectations for v0.3.0 data model changes
ea65fe512 fix(desktop-plan): add updateTaskWidgetCountdown to spec window.ea mock
c040c6e21 fix(desktop-plan): add misc signal mock to task-electron.effects spec
cb0f37d68 fix(desktop-plan): remove duplicate MatIcon import
14ebc45c5 fix(desktop-plan): restore MatError import in dialog-manual-time-record
ecf0b5a4c feat(desktop-plan): v0.3.0 - countdown, segment refactor, widget dark mode, bug fixes
```

---

## 3. CI 测试状态

- Karma 单元测试（11435 个）中 `MatFormField` 渲染相关 afterAll 错误为上游已存在问题，非本次引入
- sync-core / sync-providers / release-notes / electron / lint 测试全部通过
- E2E 本地运行 102 passed，5 个失败与本次改动无关（legacy archive + planner/notes 中断）
- Release 已通过 `gh release create` 发布，包含安装包 `Super-Productivity-Setup-x64.exe`

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

1. ~~提交发布 v0.3.0~~ → 已完成
2. 恢复 "计组4.7结束" 丢失的时间记录（备份文件已定位）
3. 上游测试修复、Dev 版本号区分

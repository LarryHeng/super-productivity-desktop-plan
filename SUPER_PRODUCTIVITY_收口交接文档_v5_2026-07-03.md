# Super Productivity 收口交接文档 v5

> 最后更新：2026-07-03
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 当前分支：`desktop-plan-widget-theme-bg`
> 当前 HEAD：`a7e3cbf49`
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`

---

## 1. 当前状态概览

### 1.1 未提交的修改（8 个文件）

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `src/app/ui/mentions/mention.directive.ts` | Bug 1 修复：搜索期间跳过 ngOnChanges 配置重建 + IME 输入遍历全部字符 | 未验证 |
| `src/app/features/boards/board/board.component.ts` | Bug 2 运行时兜底：`patchedBoardCfg` computed signal 确保 excludedTagIds 含 EM_HIDDEN | 未验证 |
| `src/app/features/boards/board/board.component.html` | Bug 2 模板修改：`boardCfg()` → `patchedBoardCfg()` | 未验证 |
| `src/app/features/boards/store/boards.reducer.ts` | Bug 2 数据迁移：`fixBuggyDefaultBoardFilters` 为 Eisenhower 面板添加 EM_HIDDEN 到 excludedTagIds | 未验证 |
| `src/app/features/boards/store/boards.reducer.spec.ts` | 迁移逻辑对应的测试 | 未验证 |
| `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` | `removeMatrixTags()` 方法 + 调试日志 console.log | 未验证 |
| `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.ts` | `handleUpdateTask` 和 `handleTagUpdates` 调试日志 console.log | 未验证 |
| `DEVELOPMENT.md` | v0.1.16 改动记录 | 待更新 |

### 1.2 已推送到远端的历史版本

- `desktop-plan-v0.1.9` ~ `desktop-plan-v0.1.16` 均已发布 Release
- 最新 Release：`desktop-plan-v0.1.16` (HEAD `a7e3cbf49`)

---

## 2. 待修复 Bug

### 2.1 Bug 1：标签模糊搜索不实时筛选（mention.directive.ts）

**症状**：在任务输入框输入 `#` 触发标签下拉后，输入字符搜索标签时模糊搜索不实时筛选，需要重新输入 `#` 才能触发。

**根因分析**（已完成）：
1. `[mention]="tagMentions$ | async"` 绑定的 ShortSyntaxTag[] 每次输入都发出新数组
2. 触发 `ngOnChanges` → `updateConfig()` 重置 `triggerChars`，中断正在进行的标签搜索
3. IME 输入时 `inputHandler` 只处理 `event.data.charCodeAt(0)`（第一个字符），丢失后续字符

**修复状态**：代码已修改，编译通过，**但用户尚未验证功能是否正常**。

**修改位置**：
- `ngOnChanges`（约第237-250行）：`[mention]` 变化且搜索进行中时跳过 `updateConfig()`
- `inputHandler`（约第333-339行）：IME 组合输入时遍历 `event.data` 的全部字符

**下一步**：用户启动应用后，在输入框输入 `#标签名` 测试搜索是否实时筛选。如果不行，检查浏览器控制台是否有错误。

### 2.2 Bug 2：移除矩阵标签后任务仍在看板（critical，根因未确定）

**症状**：右键菜单点击"移除矩阵标签"后，任务仍然出现在艾森豪威尔矩阵看板中。用户反馈："任务标签没变"——EM_URGENT/EM_IMPORTANT 没有被替换为 EM_HIDDEN。

**已尝试的修复**：

| 层面 | 修复内容 | 文件 | 效果 |
|------|----------|------|------|
| 数据迁移 | `fixBuggyDefaultBoardFilters` 为 Eisenhower 面板 excludedTagIds 添加 EM_HIDDEN | `boards.reducer.ts` | 仅对持久化数据生效，依赖 loadAllData 时机 |
| 运行时兜底 | `patchedBoardCfg` computed signal 确保面板 always 排除 EM_HIDDEN | `board.component.ts` | 保证过滤配置正确 |
| 模板 | `boardCfg()` → `patchedBoardCfg()` | `board.component.html` | 使用修补后的配置 |

**纸面分析**（代码逻辑看起来是正确的，但实际不生效）：

`removeMatrixTags()` 的调用链：
```
task-context-menu-inner.component.ts: removeMatrixTags()
  → task.service.ts: updateTags(task, newTagIds)  // newTagIds 含 EM_HIDDEN
  → dispatch TaskSharedActions.updateTask({ task: { id, changes: { tagIds } } })
  → task-shared-crud.reducer.ts: handleUpdateTask()
    → taskAdapter.updateOne (直接更新 task.tagIds)  // 不依赖 tag store 实体
    → handleTagUpdates() (双向关联更新)  // tag→task 关联
```

**已排除的干扰因素**：
1. **shortSyntax$ effect** 不会拦截：filter 要求 `changeProps.length === 1 && changeProps[0] === 'title'`
2. **handleTagUpdates 的 `.entities[tagId]` 过滤** 只影响 tag→task 双向关联，不影响 task.tagIds 本身
3. **sanitizeDoneScheduleChanges / removeInProgressTagOnCompletion** 只在 isDone=true 时触发，tagIds-only 更新不会被修改

**当前诊断手段**：已添加三处 console.log 调试日志：
- `removeMatrixTags()` 中 BEFORE/AFTER 日志
- `handleUpdateTask` 中 tagIds changing 日志
- `handleTagUpdates` 中双向更新日志

**下一步排查方向**（按优先级）：
1. **等待用户运行调试版本**，查看控制台是否出现上述日志。如果没有出现，说明 dispatch 没被 NgRx 处理（极不可能但需要排除）
2. **如果日志显示 newTagIds 正确但任务 tagIds 没变**：检查是否有其他 meta-reducer（如 tagShared、plannerShared）拦截了 updateTask 并修改了 changes
3. **如果日志显示 newTagIds 已正确写入任务**：问题在 data selectors → 看板的 filter 逻辑 → 检查 `selectAllTasksInActiveProjects` 是否正确返回更新后的任务
4. **备选方案**：在 `removeMatrixTags()` 中直接 dispatch 一个 addTag({tag: HIDDEN_MATRIX_TAG}) 确保 EM_HIDDEN 在 tag store 中存在，然后再更新任务标签

### 2.3 Widget 矩阵偶发只显示 2/4 面板

**症状**：艾森豪威尔矩阵小组件偶发只渲染 2 个面板。

**已修复**（v0.1.15）：`task-widget-renderer.ts` 中 `applyRatios()` 提前调用产生负值覆盖 CSS Grid 默认值 → 加 guard + 删除提前调用。**用户尚未验证此修复是否完全解决。**

---

## 3. 已完成的历史 Bug 修复

| 版本 | Bug | 根因 | 修复方式 |
|------|-----|------|----------|
| v0.1.12 | git-version.js 环境变量错误 | GITHUB_SHA 替代 GITHUB_REF_NAME | 修复变量读取 |
| v0.1.13 | 计划块 resize 与计时冲突 | 两种时间来源冲突 | 禁用计划块 resize |
| v0.1.13 | 实际块 resize 无法放大 | timeChangeInMs > 0 被忽略 | 移除限制 |
| v0.1.13 | 缺少调整记录功能 | 功能缺失 | 新增右键"调整记录" |
| v0.1.14 | v0.1.13 编译错误 | --no-verify 跳过了 pre-push hook | 补充缺失的导入 |
| v0.1.15 | Widget 矩阵右侧截断 | clientWidth 含 padding 未扣除 | getComputedStyle 读 padding |
| v0.1.15 | 实际块右击显示删除 | deleteTask() 未区分实际块/计划块 | @if 包裹删除按钮 |
| v0.1.15 | 详情面板可编辑已花费时间 | estimateTime() 未限制编辑类型 | isEstimateOnly: true |
| v0.1.15 | 励志语句被截断 | CSS overflow/text-overflow | 移除截断 CSS |
| v0.1.15 | 实际块 resize 不保存 | OnPush 下 offsetHeight 不更新 | 改用 clientY delta |
| v0.1.16 | 右键菜单缺少"移除矩阵标签" | 功能缺失 | 新增按钮+方法 |

---

## 4. 技术要点速查

### 4.1 常用命令

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 开发构建 + Electron 启动
npm run buildFrontend:prod:es6 && npm run electron:build && npm run dist:win:only

# 覆盖 D 盘部署
cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"

# 全量构建 + 部署（一条命令）
npm run buildFrontend:prod:es6 && npm run electron:build && npm run dist:win:only && cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"
```

### 4.2 关键架构要点

- **NgRx meta-reducer 执行顺序**：见 `meta-reducer-registry.ts` 中的详细注释。Phase 3.5 (sectionShared) → Phase 4 (taskSharedCrud) → Phase 7 (shortSyntax & lwwUpdate)。
- **TODAY_TAG** 是虚拟标签，不应出现在 task.tagIds 中。TODAY 列表成员资格由 `task.dueDay` 决定。
- **EM_HIDDEN** (`EM_HIDDEN`) 是隐藏矩阵标签，任务带此标签时应在所有 Eisenhower 面板中被排除。
- **DEFAULT_BOARDS** (board.const.ts:16-119) 是 Eisenhower 矩阵看板的默认配置，每个面板定义了 `includedTagIds` 和 `excludedTagIds`。

### 4.3 调试技巧

- Electron DevTools：启动应用后 `Ctrl+Shift+I`
- NgRx DevTools：Redux DevTools Extension 查看 action 和 state 变化
- 调试日志关键词：`[removeMatrixTags]`、`[handleUpdateTask]`、`[handleTagUpdates]`
- Widget DevTools：在小组件窗口右键 → Inspect

### 4.4 安全约束

- `git push` 只能推到 `desktop-plan` remote，origin 和 larryheng 的 push URL 已被设为 `NO_PUSH_OFFICIAL_UPSTREAM` / `NO_PUSH_FORK`

---

## 5. 下一步行动计划

1. **立即**：用户启动调试版本 → 查看控制台日志诊断 Bug 2 根因
2. **短期**：根据日志确定 Bug 2 根因 → 修复 → 移除调试日志 → 构建部署验证
3. **短期**：验证 Bug 1 修复是否生效
4. **提交**：所有修复验证通过后 git commit + push
5. **发布**：创建 `desktop-plan-v0.1.17` Release

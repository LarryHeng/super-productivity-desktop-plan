# Super Productivity 收口交接文档 v7

> 最后更新：2026-07-03
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 当前分支：`desktop-plan-widget-theme-bg`
> 当前 HEAD：`ea6a9379f`
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`

---

## 1. 当前状态

### 1.1 未提交修改（本轮将提交）

| 文件 | 修改内容 | 验证状态 |
|------|----------|----------|
| `src/app/ui/mentions/mention-list.component.ts` | items/hidden 改为 signal | 已构建，**功能未验证** |
| `src/app/ui/mentions/mention.directive.ts` | 适配 signal API，添加 triggerChangeDetection 调用 | 已构建，**功能未验证** |
| `src/app/features/tag/store/tag.reducer.ts` | `_addMyDayTagIfNecessary` → `_addSystemTagsIfNecessary`，自动创建 EM_URGENT/EM_IMPORTANT/EM_HIDDEN | 已构建，**功能未验证** |
| `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` | `removeMatrixTags()` 添加 `_tagService.addTag(HIDDEN_MATRIX_TAG)` 安全兜底 | 已构建，**功能未验证** |
| `src/app/features/boards/board/board.component.ts` | `patchedBoardCfg` computed signal 运行时兜底 | 已构建 |
| `src/app/features/boards/board/board.component.html` | `boardCfg()` → `patchedBoardCfg()` | 已构建 |
| `src/app/features/boards/store/boards.reducer.ts` | `fixBuggyDefaultBoardFilters` 补充 EM_HIDDEN 迁移 | 已构建 |
| `src/app/features/boards/store/boards.reducer.spec.ts` | 迁移测试更新 | 已构建 |
| `package.json` | 版本号 `18.12.0-desktop-plan.11W` | 已构建 |
| `RELEASE_NOTES.md` | 版本号和修改记录 | 已更新 |
| `src/environments/versions.ts` | 版本号同步 | 已构建 |

### 1.2 版本号

**当前**: `18.12.0-desktop-plan.11W`
**上一个 Release**: `desktop-plan-v0.1.16` (HEAD `a7e3cbf49`)

---

## 2. Bug 1: 标签模糊搜索不实时筛选（修复中）

### 2.1 症状

在任务输入框输入 `#` 弹出标签下拉后：
- 打字搜索标签名，下拉列表**不刷新**
- 按 Backspace 删除字符后，下拉列表**完全消失**

### 2.2 已尝试的修复（两轮）

**第一轮 (ea6a9379f)** — mention.directive.ts 修改，**用户反馈：完全没有效果**
- `ngOnChanges`: 搜索进行中跳过 updateConfig
- `updateConfig()`: 浅拷贝 mentionConfig 避免污染 shareReplay 缓存
- `inputHandler`: IME 遍历全部字符
- `keyHandler`: KEY_BUFFERED 仅阻止非导航键，Backspace 手动 trim searchString

**第二轮 (当前)** — 更换思路，修改 mention-list.component.ts
- 将 `items`/`hidden` 从普通属性改为 Angular `signal`
- 该组件通过 `createComponent` 动态创建，普通属性赋值后 Angular 不会自动触发模板重渲染
- 改用 signal 后，模板 `@for (item of items())` 每次 set 自动更新 DOM
- mention.directive.ts 中所有 `searchList.items = matches` → `searchList.items.set(matches)`，`searchList.hidden = ...` → `searchList.hidden.set(...)`

### 2.3 下一步排查方向

如果第二轮仍然无效，需要检查：
- `this.activeConfig` 是否正确指向 `#` 嵌套配置（而非被顶层配置覆盖）
- `MentionConfigService.mentionConfig$` 的 combineLatest + shareReplay 是否存在首次发射延迟
- 是否需要在 add-task-bar 输入框层面排查（而非 mention 指令本身）
- 在 `keyHandler` 和 `updateSearchList` 中添加 console.log 追踪 searchString 流

### 2.4 涉及文件
- `src/app/ui/mentions/mention.directive.ts`
- `src/app/ui/mentions/mention-list.component.ts`
- `src/app/ui/mentions/mention-config.ts`
- `src/app/features/tasks/mention-config.service.ts`
- `src/app/features/tasks/add-task-bar/add-task-bar.component.ts` (tagMentions$ 数据源)
- `src/app/features/tasks/add-task-bar/add-task-bar.component.html` ([mention] 绑定)

---

## 3. Bug 2: "移除矩阵标签"按钮不生效（修复中）

### 3.1 症状

右键菜单点击"移除矩阵标签"后：
- 任务标签没变 — EM_URGENT/EM_IMPORTANT 没有被替换为 EM_HIDDEN
- 任务仍然出现在艾森豪威尔矩阵中

### 3.2 已尝试的修复（两轮）

**第一轮 (ea6a9379f)** — 三层修复，**用户反馈：完全没有效果**
- `removeMatrixTags()`: 无条件拼接 EM_HIDDEN
- `board.component.ts`: `patchedBoardCfg` computed signal 运行时确保 excludedTagIds 含 EM_HIDDEN
- `boards.reducer.ts`: 数据迁移为旧面板添加 EM_HIDDEN

**第二轮 (当前)** — 更换思路
- `tag.reducer.ts`: `_addMyDayTagIfNecessary` → `_addSystemTagsIfNecessary`，自动创建 EM_URGENT/EM_IMPORTANT/EM_HIDDEN 系统标签
- `removeMatrixTags()`: 在 updateTags 前调用 `_tagService.addTag(HIDDEN_MATRIX_TAG)` 确保 tag 实体存在

### 3.3 根因猜测

最可能的原因：`board.component.html` 第 1 行 `@if (missingTagIds().length)` 是**门控条件**。如果 EM_HIDDEN/EM_URGENT/EM_IMPORTANT 不在 tag store entities 中，Eisenhower 面板**完全不渲染**，用户只看到"创建 N 个新标签"按钮。tag.reducer 之前只自动创建 TODAY_TAG，不创建 Eisenhower 系统标签。

### 3.4 下一步排查方向

如果第二轮仍然无效：
- 在 DevTools 控制台检查 `state.tag.entities['EM_HIDDEN']` 是否存在
- 检查 Redux DevTools 中 updateTask action 是否被正确 dispatch
- 检查 `handleTagUpdates` 中 `.filter(tagId => state[TAG_FEATURE_NAME].entities[tagId])` 是否过滤掉了 EM_HIDDEN
- `taskAdapter.updateOne` 是否正确更新了 task entity 的 tagIds

### 3.5 涉及文件
- `src/app/features/tag/store/tag.reducer.ts`
- `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts`
- `src/app/features/boards/board/board.component.ts`
- `src/app/features/boards/board/board.component.html`
- `src/app/features/boards/store/boards.reducer.ts`
- `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.ts` (handleUpdateTask / handleTagUpdates)
- `src/app/features/tasks/task.service.ts` (updateTags dispatch)

---

## 4. 关键架构要点

- **NgRx meta-reducer 执行顺序**：Phase 1 (operationCapture) → Phase 3.5 (sectionShared) → Phase 4 (taskSharedCrud) → Phase 7 (shortSyntax & lwwUpdate)
- **TODAY_TAG** 是虚拟标签，不应出现在 task.tagIds 中
- **EM_HIDDEN** (`EM_HIDDEN`) 是隐藏矩阵标签
- **[mention] 数据流**：`inputTxt$ → switchMap → startWith([])` → 每次输入都发出新数组
- **mentionCfg$** 使用 `shareReplay({ bufferSize: 1, refCount: true })`
- **MentionListComponent** 通过 `createComponent` 动态创建，items/hidden 已改为 signal

---

## 5. 构建和部署命令

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 全量构建
npm run buildFrontend:prod:es6 && npm run electron:build && npm run dist:win:only

# 覆盖 D 盘部署
powershell -Command "Get-Process 'Super Productivity' -ErrorAction SilentlyContinue | Stop-Process -Force"
cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"

# 验证
md5sum "D:/DevelopTools/Super Productivity/working/resources/app.asar"

# 启动
powershell -Command "Start-Process 'D:\DevelopTools\Super Productivity\working\Super Productivity.exe'"
```

---

## 6. Git 安全约束

```
desktop-plan → https://github.com/LarryHeng/super-productivity-desktop-plan.git (唯一可推送)
larryheng    → NO_PUSH_FORK
origin       → NO_PUSH_OFFICIAL_UPSTREAM
```

**绝对不要改回 origin 或 larryheng 的 push URL。**

---

## 7. 下一步优先级

1. **验证 Bug 1 & 2**：用户启动应用后逐个测试
2. **如果仍不生效**：在运行时加 console.log 追踪数据流（不要盲目改代码）
3. **如果生效**：创建 `desktop-plan-v0.1.17` Release

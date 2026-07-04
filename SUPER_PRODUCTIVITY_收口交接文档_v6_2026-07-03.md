# Super Productivity 收口交接文档 v6 (最终版)

> 最后更新：2026-07-03
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 当前分支：`desktop-plan-widget-theme-bg`
> 当前 HEAD：`a7e3cbf49`
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`

---

## 1. 当前状态概览

### 1.1 未提交的修改（7 个文件，+179 / -35 行）

| 文件 | 变更行数 | 修改性质 | 验证状态 |
|------|----------|----------|----------|
| `src/app/ui/mentions/mention.directive.ts` | +99/-35 | Bug 1 核心修复 | 已构建，编译通过，待用户功能验证 |
| `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` | +7/-4 | Bug 2 核心修复 | 已构建，编译通过，待用户功能验证 |
| `src/app/features/boards/board/board.component.ts` | +27 | Bug 2 运行时兜底 | 已构建，编译通过 |
| `src/app/features/boards/board/board.component.html` | +2/-2 | Bug 2 模板适配 | 已构建，编译通过 |
| `src/app/features/boards/store/boards.reducer.ts` | +16/-1 | Bug 2 数据迁移 | 已构建，编译通过 |
| `src/app/features/boards/store/boards.reducer.spec.ts` | +31/-4 | Bug 2 测试更新 | 11,419 测试全部通过 |
| `DEVELOPMENT.md` | +30/-1 | 开发文档更新 | 已更新 |

### 1.2 已取消的修改

| 文件 | 原因 |
|------|------|
| `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.ts` | 调试 console.log 已全部移除，不再修改此文件 |

### 1.3 部署状态

- 最新构建 MD5：`5281837863696fbab43a0da806393133` (app.asar)
- 已复制到 `D:\DevelopTools\Super Productivity\working\`
- 应用已启动，待用户操作验证

---

## 2. Bug 1 完整分析 — 标签模糊搜索不实时筛选

### 2.1 症状

在任务输入框输入 `#` 弹出标签下拉后：
- 打字搜索标签名，下拉列表**不刷新**，必须再输入一个字符才刷新
- 按 Backspace 删除字符后，下拉列表**完全消失**（无结果）

### 2.2 用户验证步骤

1. 启动 Super Productivity
2. 在顶部输入框输入 `#`
3. 看到标签下拉弹出后，逐个输入标签名的字母
4. **期望**：每输入一个字符，下拉列表实时过滤匹配的标签
5. 按 Backspace 删除字符
6. **期望**：下拉列表实时回到上一步的匹配结果

### 2.3 根因分析（4 层问题）

#### 问题 1：ngOnChanges 在搜索期间重建配置

**链路**：
```
用户输入字符 → inputTxt$ 变化
  → tagMentions$ = inputTxt$.pipe(switchMap(...), startWith([]))
  → [mention]="tagMentions$ | async" 绑定的 ShortSyntaxTag[] 每次都是新数组引用
  → Angular 检测到 @Input() mention 变化
  → ngOnChanges 触发 updateConfig()
  → updateConfig() 重置 this.triggerChars = {}
  → 正在进行的搜索被中断，keyHandler 状态丢失
```

**修复**：`ngOnChanges` 中只在非搜索态且有 items 时才重建配置，搜索进行中跳过。

#### 问题 2：updateConfig() 污染父组件缓存

**链路**：
```
updateConfig() 中 config = this.mentionConfig（直接引用赋值）
  → config.items = this.mentionItems（直接修改 @Input 对象）
  → mentionCfg$ 用了 shareReplay({ bufferSize: 1, refCount: true })
  → 修改的正是缓存的同一个对象
  → 后续订阅者拿到的是被污染的 items（ShortSyntaxTag[] 覆盖了嵌套 mention 的原始 items）
```

**修复**：`const cfg = { ...this.mentionConfig }` 浅拷贝，不再修改 Input 对象。

#### 问题 3：Backspace 读取过时的 DOM

**链路**：
```
用户按 Backspace → keydown 事件触发
  → keyHandler 用 val.substring(this.startPos + 1, pos) 从 DOM 取搜索词
  → 但 keydown 在 DOM 更新之前触发，DOM 内容仍是上一帧的
  → searchString 比实际多一个字符
  → updateSearchList 用错误的 searchString 过滤，结果不匹配
```

**修复**：Backspace 分支手动 `this.searchString = this.searchString.slice(0, -1)`，不再从 DOM 读取。

#### 问题 4：IME 输入丢失字符

**链路**：
```
用户用中文输入法输入 "紧急"
  → keydown 触发，keyCode = 229 (KEY_BUFFERED)，isComposing = true
  → keyHandler 检测到 KEY_BUFFERED，直接 return undefined
  → 随后 input 事件触发，event.data = "紧急"
  → inputHandler 只处理 event.data.charCodeAt(0)，即只有 '紧'
  → '急' 被静默丢弃，searchString 不完整
```

**修复**：`inputHandler` 中用 `for` 循环遍历 `event.data` 的全部字符。同时增加 `NAV_KEYS` 白名单，确保 Arrow*/Enter/Escape/Tab/Backspace 在 IME 输入期间仍能传递给 keyHandler。

### 2.4 修改详情 (mention.directive.ts, +99 / -35 行)

| 位置 | 修改内容 |
|------|----------|
| 第 46-58 行 | 新增 `NAV_KEYS` 常量：Arrow*/Enter/Escape/Tab/Backspace |
| 第 237-249 行 | `ngOnChanges`: `[mentionConfig]` 变化直接重建；`[mention]` 变化仅在非搜索态且有 items 时重建 |
| 第 251-265 行 | `updateConfig()`: 浅拷贝 `{...this.mentionConfig}` + `mentionItems?.length` 检查 |
| 第 335-348 行 | `inputHandler`: IME 组合输入时遍历 `event.data` 的全部字符，不限于第一个 |
| 第 357-376 行 | `keyHandler`: `KEY_BUFFERED` 仅对非导航键阻止，导航键始终放行 |
| 第 448-455 行 | Backspace keyHandler: 手动 `searchString.slice(0, -1)`，不读 DOM |
| 第 519-528 行 | searchString 更新: Backspace 用缓存的 searchString，其他键从 DOM 读取 |
| 第 541 行 | `searchTerm.emit` 修复 TS 类型错误：`this.searchString ?? ''` |

---

## 3. Bug 2 完整分析 — "移除矩阵标签"按钮不生效

### 3.1 症状

右键菜单点击"移除矩阵标签"后：
- 任务标签没变 — EM_URGENT/EM_IMPORTANT 没有被替换为 EM_HIDDEN
- 任务仍然出现在艾森豪威尔矩阵中

### 3.2 用户验证步骤

1. 在艾森豪威尔矩阵中找到任意一个任务（无论有没有 IMPORTANT/URGENT 标签）
2. 右键任务 → 点击"移除矩阵标签"
3. **期望**：任务从矩阵中消失
4. 切换到另一个视图再切回来
5. **期望**：任务仍然不出现（已持久化 EM_HIDDEN）

### 3.3 根因（三层缺陷）

#### 第一层：核心逻辑错误（removeMatrixTags 方法）★★★

**旧代码**：
```typescript
removeMatrixTags(): void {
  const task = this.task;
  const filtered = (task.tagIds ?? []).filter(
    (id: string) => id !== URGENT_TAG.id && id !== IMPORTANT_TAG.id,
  );
  const removed = filtered.length < (task.tagIds ?? []).length;
  const newTagIds = removed
    ? [...new Set([...filtered, HIDDEN_MATRIX_TAG.id])]  // ← 只在有移除时走这
    : (task.tagIds ?? []);  // ← BUG: 没有矩阵标签时原样返回，EM_HIDDEN 永远不加
  this._taskService.updateTags(task, newTagIds);
}
```

**问题**：`removed` 变量检查是否真的有标签被移除。如果任务本来就没有 IMPORTANT/URGENT 标签，`removed = false`，走 else 分支直接返回原 `tagIds`，EM_HIDDEN 永远不会被添加。

**用户确认**：数据库查询显示 EM_HIDDEN 标签下关联任务数为 0，证实了这个问题。

**新代码**：
```typescript
removeMatrixTags(): void {
  const task = this.task;
  const filtered = (task.tagIds ?? []).filter(
    (id: string) => id !== URGENT_TAG.id && id !== IMPORTANT_TAG.id,
  );
  const newTagIds = [...new Set([...filtered, HIDDEN_MATRIX_TAG.id])];
  this._taskService.updateTags(task, newTagIds);
}
```

无条件拼接 EM_HIDDEN，无论任务之前有没有矩阵标签。

#### 第二层：持久化数据缺少 EM_HIDDEN 过滤（boards.reducer.ts）★★

**问题**：用户数据库中持久化的 Eisenhower 看板配置，其面板的 `excludedTagIds` 可能不包含 EM_HIDDEN。即使任务正确获得了 EM_HIDDEN 标签，看板也不会过滤它。

**修复**：`fixBuggyDefaultBoardFilters()` 新增迁移逻辑：
```typescript
if (
  board.id === 'EISENHOWER_MATRIX' &&
  EISENHOWER_PANEL_IDS.has(panel.id) &&
  !panel.excludedTagIds?.includes(HIDDEN_MATRIX_TAG.id)
) {
  boardChanged = true;
  return {
    ...panel,
    excludedTagIds: [...(panel.excludedTagIds || []), HIDDEN_MATRIX_TAG.id],
  };
}
```

注：`DEFAULT_BOARDS` 常量（新安装用户）已经正确配置了 EM_HIDDEN，此迁移仅针对旧数据的修复。

#### 第三层：运行时兜底（board.component.ts）★★

**问题**：数据迁移只在 `loadAllData` 时执行一次。如果用户在运行中修改了看板配置，或在迁移未执行时加载了旧数据，面板仍可能缺少 EM_HIDDEN 过滤。

**修复**：`patchedBoardCfg` computed signal，在每次 `boardCfg()` 变化时实时检查并修补：
```typescript
patchedBoardCfg = computed(() => {
  const cfg = this.boardCfg();
  if (cfg.id !== 'EISENHOWER_MATRIX') return cfg;
  let changed = false;
  const patchedPanels = cfg.panels.map((panel) => {
    if (!EISENHOWER_PANEL_IDS.has(panel.id)) return panel;
    const excluded = panel.excludedTagIds || [];
    if (excluded.includes(HIDDEN_MATRIX_TAG.id)) return panel;
    changed = true;
    return { ...panel, excludedTagIds: [...excluded, HIDDEN_MATRIX_TAG.id] };
  });
  return changed ? { ...cfg, panels: patchedPanels } : cfg;
});
```

模板中所有 `boardCfg()` 引用改为 `patchedBoardCfg()`（共 4 处）。

### 3.4 完整调用链（单击右键到任务消失）

```
用户右键点击任务 → 选择"移除矩阵标签"
  ↓
TaskContextMenuInnerComponent.removeMatrixTags()
  → 过滤掉 EM_IMPORTANT / EM_URGENT
  → 拼接 EM_HIDDEN
  → this._taskService.updateTags(task, newTagIds)
  ↓
TaskService.updateTags()
  → dispatch TaskSharedActions.updateTask({task: {id, changes: {tagIds: unique(newTagIds)}}})
  ↓
Meta-reducer 执行链:
  Phase 3.5: sectionShared (不匹配，跳过)
  Phase 4:   taskSharedCrud.handleUpdateTask()
    → taskAdapter.updateOne(state.tasks, {id, changes: {tagIds}})
    → handleTagUpdates() — 双向关联更新 tag→task (需要 tag 实体存在于 store)
  Phase 7:   shortSyntax (changeProps 不含 title，跳过)
             lwwUpdate (应用 LWW 时间戳)
  ↓
Store 状态更新 → board.component.ts 的 selectors 重新计算
  ↓
patchedBoardCfg computed signal:
  → Eisenhower 面板 excludedTagIds 包含 EM_HIDDEN ✓
  ↓
filterTasksForPanel() (boards.util.ts:220):
  → excludedTagIds 'any' 匹配: task.tagIds 含 EM_HIDDEN → 过滤掉 ✓
  ↓
任务从矩阵面板消失 ✓
```

---

## 4. 修改文件逐文件对比

### 4.1 mention.directive.ts (Bug 1, +99/-35)

```
修改前 (ce7719299)                    修改后 (d351eb961)
─────────────────────────────────    ─────────────────────────────────
ngOnChanges:                          ngOnChanges:
  if changes['mention'] ||              if changes['mentionConfig']:
    changes['mentionConfig'] →            updateConfig(); return
    updateConfig()                      if changes['mention'] &&
                                          !this.searching &&
                                          this.mentionItems?.length →
                                          updateConfig()

updateConfig:                         updateConfig:
  config = this.mentionConfig           cfg = { ...this.mentionConfig }
  if this.mentionItems:                 if this.mentionItems?.length:
    config.items = ...                    cfg.items = ...

inputHandler:                         inputHandler:
  if KEY_BUFFERED && event.data:        if KEY_BUFFERED && event.data:
    charCodeAt(0) → keyHandler            for i in 0..data.length:
                                            charCodeAt(i) → keyHandler

keyHandler:                           keyHandler:
  if isComposing || KEY_BUFFERED:       if KEY_BUFFERED &&
    return undefined                      !NAV_KEYS.has(event.key):
                                           return undefined

Backspace:                            Backspace:
  pos = pos - 1                         pos = pos - 1
  if pos == startPos:                   if pos == startPos:
    stopSearch()                          stopSearch(); return undef
                                       if this.searchString:
                                         searchString.slice(0,-1)

searchString 更新:                     searchString 更新:
  val.substring(startPos+1, pos)        if Backspace: (use cached)
  mention += charPressed                else: val.substring(...)
  this.searchString = mention             if !inputEvent:
                                            mention += charPressed
                                          this.searchString = mention
```

### 4.2 task-context-menu-inner.component.ts (Bug 2, +7/-4)

```
修改前                                修改后
─────────────────────────────────    ─────────────────────────────────
const removed = filtered.length       // 直接无条件拼接 EM_HIDDEN
  < (task.tagIds ?? []).length;
const newTagIds = removed             const newTagIds =
  ? [...new Set([...filtered,           [...new Set([...filtered,
      HIDDEN_MATRIX_TAG.id])]               HIDDEN_MATRIX_TAG.id])];
  : (task.tagIds ?? []);
```

### 4.3 board.component.ts (Bug 2, +27 行)

新增内容：
- `EISENHOWER_PANEL_IDS` 常量（4 个 Eisenhower 面板 ID）
- `patchedBoardCfg` computed signal：运行时确保 Eisenhower 面板 excludedTagIds 含 EM_HIDDEN
- 已导入 `HIDDEN_MATRIX_TAG`

### 4.4 board.component.html (Bug 2, 2 处修改)

- `boardCfg().panels.length` → `patchedBoardCfg().panels.length`
- `boardCfg().panels` → `patchedBoardCfg().panels`（@for 循环）

### 4.5 boards.reducer.ts (Bug 2, +16/-1)

- 导入新增 `HIDDEN_MATRIX_TAG`
- `fixBuggyDefaultBoardFilters()` 新增第三个迁移分支：Eisenhower 面板缺少 EM_HIDDEN → 补充到 excludedTagIds

### 4.6 boards.reducer.spec.ts (Bug 2, +31/-4)

三个测试用例的变更：

| 原测试名 | 新测试名 | 变更原因 |
|----------|----------|----------|
| "does not touch Eisenhower panels already set to All (idempotent)" | "adds HIDDEN_MATRIX_TAG to Eisenhower panel excludedTagIds (migration)" | 新增验证：迁移后 excludedTagIds 必须包含 EM_HIDDEN |
| (新增) | "does not touch Eisenhower panels that already have HIDDEN_MATRIX_TAG (idempotent)" | 新增验证：已有 EM_HIDDEN 的面板不被重复修改 |
| "does not touch a Done-state Eisenhower panel" | "adds HIDDEN_MATRIX_TAG for a Done-state Eisenhower panel too" | 修正验证：Done 状态面板也要补充 EM_HIDDEN |

---

## 5. 已完成的历史 Bug 修复（v0.1.12 ~ v0.1.16）

| 版本 | Bug | 根因 | 修复方式 |
|------|-----|------|----------|
| v0.1.12 | git-version.js 环境变量错误 | GITHUB_SHA 替代 GITHUB_REF_NAME | 修复变量读取 |
| v0.1.13 | 计划块 resize 与计时冲突 | 两种时间来源冲突 | 禁用计划块 resize |
| v0.1.13 | 实际块 resize 无法放大 | timeChangeInMs > 0 被忽略 | 移除限制 |
| v0.1.13 | 缺少调整记录功能 | 功能缺失 | 新增右键"调整记录" |
| v0.1.14 | v0.1.13 编译错误 | --no-verify 跳过了 pre-push hook | 补充缺失的导入 |
| v0.1.15 | Widget 矩阵右侧截断 | clientWidth 含 padding 未扣除 | getComputedStyle 读 padding |
| v0.1.15 | Widget 矩阵 2/4 面板 | applyRatios() 提前调用产生负值 | 加 guard + 删除提前调用 |
| v0.1.15 | 实际块右击显示删除 | deleteTask() 未区分实际块/计划块 | @if 包裹删除按钮 |
| v0.1.15 | 详情面板可编辑已花费时间 | estimateTime() 未限制编辑类型 | isEstimateOnly: true |
| v0.1.15 | 励志语句被截断 | CSS overflow/text-overflow | 移除截断 CSS |
| v0.1.15 | 实际块 resize 不保存 | OnPush 下 offsetHeight 不更新 | 改用 clientY delta |
| v0.1.16 | 右键菜单缺少"移除矩阵标签" | 功能缺失 | 新增按钮+方法 |

---

## 6. Widget 矩阵已知问题

### 6.1 偶发只显示 2/4 面板（未完全解决）

**症状**：艾森豪威尔矩阵小组件偶发只渲染 2 个面板。

**已修复** (v0.1.15)：`task-widget-renderer.ts` 中删除 `applyRatios()` 第 113 行提前调用 + 添加 `if (w <= 0 || h <= 0) return;` guard。

**快速修复**（如复现）：
```javascript
// 在 Widget DevTools 中执行：
localStorage.removeItem('taskWidgetMatrixRatios');
location.reload();
```

---

## 7. 技术要点速查

### 7.1 构建和部署命令

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 全量构建 (生产 ES6 + Electron 打包 + Windows NSIS)
npm run buildFrontend:prod:es6 && npm run electron:build && npm run dist:win:only

# 覆盖 D 盘部署 (WSL/Git Bash 路径)
powershell -Command "Get-Process 'Super Productivity' -ErrorAction SilentlyContinue | Stop-Process -Force"
cp -rf "F:/AgentData/codex/super-productivity-custom/.tmp/app-builds/win-unpacked/"* "D:/DevelopTools/Super Productivity/working/"

# 验证 MD5
md5sum "D:/DevelopTools/Super Productivity/working/resources/app.asar"

# 启动
powershell -Command "Start-Process 'D:\DevelopTools\Super Productivity\working\Super Productivity.exe'"

# 全量测试
npm test
```

### 7.2 关键架构要点

- **NgRx meta-reducer 执行顺序**：Phase 3.5 (sectionShared) → Phase 4 (taskSharedCrud) → Phase 7 (shortSyntax & lwwUpdate)
- **TODAY_TAG** 是虚拟标签，不应出现在 task.tagIds 中
- **EM_HIDDEN** (`EM_HIDDEN`) 是隐藏矩阵标签，任务带此标签时应在所有 Eisenhower 面板中被排除
- **excludedTagIds** 默认匹配模式为 `'any'`（任务有任意一个 excluded tag 即被过滤）
- **[mention] 数据流**：`inputTxt$ → switchMap → startWith([])` → 每次输入都发出新数组 → Angular 检测为 Input 变化
- **mentionCfg$** 使用 `shareReplay({ bufferSize: 1, refCount: true })` — 对其返回对象的任何引用修改都会污染缓存

### 7.3 调试技巧

- Electron DevTools：启动应用后 `Ctrl+Shift+I`
- NgRx DevTools：Redux DevTools Extension 查看 action 和 state 变化
- Widget DevTools：在小组件窗口右键 → Inspect
- IndexedDB：DevTools → Application → IndexedDB → `superProductivityDB`

### 7.4 Git 安全约束

```
desktop-plan → https://github.com/LarryHeng/super-productivity-desktop-plan.git (唯一可推送)
larryheng    → NO_PUSH_FORK (禁止推送)
origin       → NO_PUSH_OFFICIAL_UPSTREAM (禁止推送)
```

**绝对不要改回 origin 或 larryheng 的 push URL。**

### 7.5 禁止提交的内容

- `.codex/`、`codex/`、`.tmp/`、`node_modules/`
- 安装包（`.exe`）
- 备份文件（`.json` backup）
- 用户数据

---

## 8. 下一步行动计划

1. **立即**：用户启动应用验证 Bug 1 和 Bug 2 修复是否生效
2. **验证通过后**：
   ```bash
   git add src/app/ui/mentions/mention.directive.ts \
           src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts \
           src/app/features/boards/board/board.component.ts \
           src/app/features/boards/board/board.component.html \
           src/app/features/boards/store/boards.reducer.ts \
           src/app/features/boards/store/boards.reducer.spec.ts \
           DEVELOPMENT.md
   git commit -m "fix(desktop-plan): fix tag mention search refresh and remove-matrix-tags button

   Bug 1: Tag mention search not refreshing
   - skip ngOnChanges updateConfig during active search
   - shallow-copy mentionConfig to avoid mutating shareReplay cache
   - manually trim searchString on Backspace (DOM stale in keydown)
   - iterate all IME composed characters in inputHandler
   - allow navigation keys through KEY_BUFFERED guard

   Bug 2: Remove matrix tags button not working
   - always add EM_HIDDEN regardless of prior matrix tags
   - add runtime patchedBoardCfg computed to ensure Eisenhower panels exclude EM_HIDDEN
   - add data migration for legacy Eisenhower panels missing EM_HIDDEN in excludedTagIds

   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
   git push desktop-plan HEAD:desktop-plan-widget-theme-bg
   ```
3. **发布 Release**：创建 `desktop-plan-v0.1.17` Release
4. **后续**：持续观察 Widget 矩阵 2/4 面板问题是否复现

---

## 附录：文件路径速查

| 文件 | 绝对路径 |
|------|----------|
| 源码根目录 | `F:\AgentData\codex\super-productivity-custom` |
| 部署目录 | `D:\DevelopTools\Super Productivity\working\` |
| 本交接文档 | `F:\AgentData\codex\super-productivity-custom\SUPER_PRODUCTIVITY_收口交接文档_v6_2026-07-03.md` |
| 开发文档 | `F:\AgentData\codex\super-productivity-custom\DEVELOPMENT.md` |
| mention.directive.ts | `F:\AgentData\codex\super-productivity-custom\src\app\ui\mentions\mention.directive.ts` |
| task-context-menu-inner | `F:\AgentData\codex\super-productivity-custom\src\app\features\tasks\task-context-menu\task-context-menu-inner\task-context-menu-inner.component.ts` |
| board.component.ts | `F:\AgentData\codex\super-productivity-custom\src\app\features\boards\board\board.component.ts` |
| board.component.html | `F:\AgentData\codex\super-productivity-custom\src\app\features\boards\board\board.component.html` |
| boards.reducer.ts | `F:\AgentData\codex\super-productivity-custom\src\app\features\boards\store\boards.reducer.ts` |
| boards.reducer.spec.ts | `F:\AgentData\codex\super-productivity-custom\src\app\features\boards\store\boards.reducer.spec.ts` |
| tag.const.ts | `F:\AgentData\codex\super-productivity-custom\src\app\features\tag\tag.const.ts` |
| task-shared-crud.reducer.ts | `F:\AgentData\codex\super-productivity-custom\src\app\root-store\meta\task-shared-meta-reducers\task-shared-crud.reducer.ts` |
| task.service.ts | `F:\AgentData\codex\super-productivity-custom\src\app\features\tasks\task.service.ts` |

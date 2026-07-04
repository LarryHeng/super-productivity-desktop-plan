# Bug 修复尝试技术复盘报告

> 生成日期：2026-07-04
> 涉及版本：18.12.0-desktop-plan.11 / 18.12.0-desktop-plan.11W
> 关联 Commits：`ea6a9379f`（第一轮）、`2048e3a9b`（第二轮）

---

## Bug 1: 标签模糊搜索不实时筛选

### 症状

在 `add-task-bar` 输入框输入 `#` 弹出标签下拉后：

- 继续打字搜索标签名，下拉列表**不刷新**（不进行模糊筛选）
- 按 Backspace 删除字符后，下拉列表**完全消失**

### 数据流分析

```
用户输入 "hello"
  → [(ngModel)]="stateService.inputTxt"
  → inputTxt$ = stateService.inputTxt$.pipe(...)
  → tagMentions$ = inputTxt$.pipe(
      withLatestFrom(tags, projects, ...),
      switchMap(([val, tags, ...]) => from(shortSyntaxToTags({val, tags, ...}))),
      startWith([]),
    )
  → template: [mention]="tagMentions$ | async"    ← 每次按键都发出新数组!
  → mentionCfg$ = combineLatest(shortSyntax$, tagsSorted$, projectsSorted$)
      .pipe(map(...), shareReplay({bufferSize:1, refCount:true}))
  → template: [mentionConfig]="mentionCfg$ | async"
  → MentionDirective
      ngOnChanges → updateConfig() → addConfig() → triggerChars 重建
      keyHandler  → 触发搜索 → updateSearchList() → 过滤 items → 赋值给 searchList.items
  → MentionListComponent (动态创建)
      items = signal(...) ，模板 @for (item of items(); track item)
```

### 第一轮修复 (ea6a9379f)

**切入点**：`mention.directive.ts`

**修改 1** — `ngOnChanges()`：

```typescript
// [mention] items 变化但搜索进行中时，跳过 updateConfig()
// 避免每次按键触发 triggerChars 重建打断搜索
if (changes['mention'] && !this.searching && this.mentionItems?.length) {
  this.updateConfig();
}
```

**假设**：`[mention]="tagMentions$ | async"` 每次按键都发出新数组 → `ngOnChanges` → `updateConfig()` → 重置 `triggerChars` → 打断正在进行的搜索。

**修改 2** — `updateConfig()`：

```typescript
// 浅拷贝 mentionConfig 避免污染 shareReplay 缓存
const cfg = { ...this.mentionConfig };
```

**修改 3** — `inputHandler()`：

```typescript
// IME 组合输入时遍历 event.data 所有字符，而非仅第一个
if (this.lastKeyCode === KEY_BUFFERED && event.data) {
  for (let i = 0; i < event.data.length; i++) {
    const keyCode = event.data.charCodeAt(i);
    this.keyHandler({ keyCode, inputEvent: true }, nativeElement);
  }
}
```

**修改 4** — `keyHandler()`：

```typescript
// KEY_BUFFERED 仅阻止非导航键（Arrow*, Enter, Escape, Tab, Backspace 放行）
if (this.lastKeyCode === KEY_BUFFERED && !NAV_KEYS.has(event.key || '')) {
  return undefined;
}
```

**修改 5** — Backspace 处理：

```typescript
// keydown 在 DOM 更新前触发，手动 trim searchString
if (event.keyCode === KEY_BACKSPACE && pos > 0) {
  pos = pos - 1;
  if (pos == this.startPos) {
    this.stopSearch();
    return;
  }
  if (this.searchString) {
    this.searchString = this.searchString.slice(0, -1);
  }
}
```

**结果**：用户反馈**完全没有效果**。

**失败分析**：

1. `[mention]` 跳过 `updateConfig()` 的条件 `!this.searching` 太严：如果搜索尚未开始（`searching === false`），仍然会触发配置重建
2. 但更关键的是：即使 `keyHandler` 正确执行了 `updateSearchList()`，`searchList.items = matches` 赋值后，**动态创建的 `MentionListComponent` 不会触发 Angular 变更检测**，DOM 永远不刷新
3. 所以第一轮的修改方向是**必要但不充分**的——即使数据流修复了，渲染层仍然有问题

### 第二轮修复 (2048e3a9b)

**切入点**：`mention-list.component.ts` + `mention.directive.ts`

**核心修改**：`MentionListComponent.items` 和 `hidden` 从普通属性改为 Angular `signal()`

```typescript
// mention-list.component.ts
items = signal<MentionItem[] | string[]>([]);
hidden = signal(false);

// 模板
@for (item of items(); track item; let i = $index) { ... }
[hidden]="hidden()"

// getter 也改用 signal 读取
get activeItem(): MentionItem | string | null {
  const currentItems = this.items();  // 调用 signal getter
  ...
}
```

**mention.directive.ts 适配**：

```typescript
// updateSearchList()
this.searchList.items.set(matches); // 原: this.searchList.items = matches
this.searchList.hidden.set(matches.length === 0); // 原: this.searchList.hidden = matches.length === 0

// stopSearch()
this.searchList.hidden.set(true); // 原: this.searchList.hidden = true

// 所有 .hidden 读取
this.searchList.hidden(); // 原: this.searchList.hidden
```

**假设**：`MentionListComponent` 通过 `ComponentFactoryResolver.createComponent()` 动态创建（`mention.directive.ts` 第 611-614 行），普通属性赋值后 Angular 不会自动触发模板重渲染。改用 signal 后，`items.set()` 触发 signal 变更通知 → 模板 `@for (item of items())` 自动更新 DOM。

**结果**：构建成功，但**功能未验证通过**。

**可能的失败原因**：

1. **signal 在动态创建的组件上是否正常工作**：虽然 `createComponent` 创建的组件宿主视图应该能参与变更检测，但 signal 驱动的模板更新依赖 Angular 的 `ReactiveNode` 机制——如果组件没有正确 attach 到变更检测树，signal 变化不会触发视图刷新
2. **MentionDirective 也在独立变更检测上下文中**：指令和动态创建的组件可能不在同一个变更检测周期内
3. **真正的问题可能不在 `MentionListComponent` 渲染层**，而在更上游：
   - `updateSearchList()` 中的 `this.activeConfig.items` 是否正确引用了 `#` trigger char 对应的配置？
   - `mentionFilter` 是否被正确调用？

### 下一步排查方向（按优先级）

1. **在 `keyHandler` 和 `updateSearchList` 中加 console.log**：

   ```typescript
   // keyHandler 末尾
   console.log('[mention] keyHandler', {
     charPressed,
     searchString: this.searchString,
     activeConfigTrigger: this.activeConfig?.triggerChar,
     searching: this.searching,
   });

   // updateSearchList 中
   console.log('[mention] updateSearchList', {
     searchString: this.searchString,
     itemsCount: this.activeConfig?.items?.length,
     matchesCount: matches.length,
     hasMentionFilter: !!this.activeConfig?.mentionFilter,
   });
   ```

2. **检查 `this.activeConfig` 是否正确指向 `#` 配置**：`addConfig()` 中 `triggerChars[config.triggerChar || '@'] = config`，确认 `#` key 正确

3. **检查 `mentionCfg$` 的 shareReplay 是否导致了某种缓存污染**：`shareReplay({ bufferSize: 1, refCount: true })` 在 `refCount: true` 时，最后一个订阅者取消后重置——多次订阅/取消可能丢失数据

4. **尝试在 `updateSearchList()` 末尾手动触发变更检测**：

   ```typescript
   // mention.directive.ts - 在 updateSearchList 最后
   import { ChangeDetectorRef } from '@angular/core';
   // 注入到 MentionDirective
   private readonly _cdr = inject(ChangeDetectorRef);
   // 在 updateSearchList 末尾调用
   this._cdr.detectChanges();
   ```

   但这不对——`MentionListComponent` 有自己的 CDR。需要在组件内部注入并调用。

5. **考虑将 `MentionListComponent` 的 items 绑定方式从 signal 改为 `@Input()`**，让 Angular 的标准 input 变更检测来驱动更新：

   ```typescript
   // mention-list.component.ts
   @Input() items: MentionItem[] | string[] = [];
   @Input() hidden: boolean = false;

   // mention.directive.ts - showSearchList()
   // 每次搜索时重新设置 input 并手动触发 change detection
   componentRef.instance.items = matches;
   componentRef.changeDetectorRef.detectChanges();
   ```

### 涉及文件清单

| 文件                                                              | 角色                                              |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `src/app/ui/mentions/mention.directive.ts`                        | 核心指令：事件处理、搜索逻辑、filter 调用         |
| `src/app/ui/mentions/mention-list.component.ts`                   | 下拉列表 UI 组件（动态创建）                      |
| `src/app/ui/mentions/mention-config.ts`                           | 配置类型定义                                      |
| `src/app/features/tasks/mention-config.service.ts`                | mention 配置数据源（combineLatest + shareReplay） |
| `src/app/features/tasks/add-task-bar/add-task-bar.component.ts`   | tagMentions$ 数据源定义                           |
| `src/app/features/tasks/add-task-bar/add-task-bar.component.html` | [mention] 和 [mentionConfig] 绑定                 |

---

## Bug 2: "移除矩阵标签"按钮不生效

### 症状

在任务的右键菜单中点击"移除矩阵标签"后：

- 任务的 `tagIds` 中的 `EM_URGENT` / `EM_IMPORTANT` 没有被替换为 `EM_HIDDEN`
- 任务仍然出现在艾森豪威尔矩阵面板中

### 关键代码路径

```
右键菜单点击 "移除矩阵标签"
  → TaskContextMenuInnerComponent.removeMatrixTags()
    → 过滤 task.tagIds 移除 EM_URGENT/EM_IMPORTANT
    → 拼接 EM_HIDDEN
    → this._tagService.addTag(HIDDEN_MATRIX_TAG)  // 第二轮新增
    → this._taskService.updateTags(task, newTagIds)
      → dispatch TaskSharedActions.updateTask({task: {id, changes: {tagIds}}})
        → 进入 NgRx meta-reducer 链
          → Phase 1: operationCapture
          → Phase 3.5: sectionShared
          → Phase 4: taskSharedCrud
            → handleUpdateTask()
              → sanitize()
              → removeInProgress()
              → handleTagUpdates()
                → .filter(tagId => state.tag.entities[tagId])  ← 关键过滤！
              → taskAdapter.updateOne()
          → Phase 7: shortSyntax & lwwUpdate

Board 组件渲染：
  board.component.html: @if (missingTagIds().length)  ← 门控条件
    → missingTagIds = panels 引用的 tag ID - store 中存在的 tag ID
    → 如果 EM_HIDDEN 在 excludedTagIds 中但不在 tag store entities 中 → 面板不渲染
```

### 第一轮修复 (ea6a9379f)

**三层修复策略**：

**层 1** — `task-context-menu-inner.component.ts`：

```typescript
removeMatrixTags(): void {
  const filtered = (task.tagIds ?? []).filter(
    (id: string) => id !== URGENT_TAG.id && id !== IMPORTANT_TAG.id,
  );
  // 无条件拼接 EM_HIDDEN
  const newTagIds = [...new Set([...filtered, HIDDEN_MATRIX_TAG.id])];
  this._taskService.updateTags(task, newTagIds);
}
```

**层 2** — `board.component.ts` (运行时兜底)：

```typescript
patchedBoardCfg = computed(() => {
  const cfg = this.boardCfg();
  if (cfg.id !== 'EISENHOWER_MATRIX') return cfg;
  // 运行时确保每个 Eisenhower 面板的 excludedTagIds 包含 EM_HIDDEN
  const patchedPanels = cfg.panels.map((panel) => {
    if (!EISENHOWER_PANEL_IDS.has(panel.id)) return panel;
    const excluded = panel.excludedTagIds || [];
    if (excluded.includes(HIDDEN_MATRIX_TAG.id)) return panel;
    return { ...panel, excludedTagIds: [...excluded, HIDDEN_MATRIX_TAG.id] };
  });
  return changed ? { ...cfg, panels: patchedPanels } : cfg;
});
```

**层 3** — `boards.reducer.ts` (持久化数据迁移)：

```typescript
// fixBuggyDefaultBoardFilters() 中新增第三个分支
// Eisenhower 面板的 excludedTagIds 自动补充 EM_HIDDEN
if (
  board.id === 'EISENHOWER_MATRIX' &&
  EISENHOWER_PANEL_IDS.has(panel.id) &&
  !panel.excludedTagIds?.includes(HIDDEN_MATRIX_TAG.id)
) {
  return {
    ...panel,
    excludedTagIds: [...(panel.excludedTagIds || []), HIDDEN_MATRIX_TAG.id],
  };
}
```

**结果**：用户反馈**完全没有效果**。

**失败分析**：最可能的根本原因是 `board.component.html` 第 1 行的门控条件：

```html
@if (missingTagIds().length) {
<!-- 显示"创建N个新标签"按钮 -->
} @else {
<!-- 渲染面板 -->
}
```

`missingTagIds()` 计算逻辑：

```typescript
missingTagIds = computed(() => {
  const allExistingTagIds = this.allExistingTagIds();
  const allPanelTagIds = this.boardCfg().panels.reduce((acc, panel) => {
    return [...acc, ...(panel.includedTagIds || []), ...(panel.excludedTagIds || [])];
  }, []);
  return unique(allPanelTagIds.filter((tagId) => !allExistingTagIds.includes(tagId)));
});
```

**关键矛盾**：`missingTagIds()` 使用的是原始的 `this.boardCfg()` 而非 `this.patchedBoardCfg()`！这意味着：

- `patchedBoardCfg` 修复了面板的 `excludedTagIds`，但**只对面板渲染 `<board-panel>` 生效**
- `missingTagIds()` 仍然检查**原始的 `boardCfg()`** 中的 panel tag IDs
- 如果原始 `boardCfg()` 的 panels 中**没有引用 EM_HIDDEN**（因为它是后来才被加入 excludedTagIds 的），那么 EM_HIDDEN 不在 store entities 中也不会触发门控——所以门控**不是**问题所在

等等，让我重新思考：

- 如果原始的 Eisenhower 面板的 `excludedTagIds` **已经包含** `EM_HIDDEN`（经过数据迁移后），那么 `missingTagIds()` 会检查 `EM_HIDDEN` 是否在 tag store 中
- 如果 `EM_HIDDEN` 不在 store 中 → `missingTagIds().length > 0` → 面板不渲染，显示"创建标签"按钮
- 如果 `EM_HIDDEN` 在 store 中 → 面板正常渲染

所以问题的根源是：**`EM_HIDDEN` 标签实体可能从未被创建**。`tag.reducer.ts` 的 `_addMyDayTagIfNecessary`（第一轮时）只确保 `TODAY_TAG` 存在，不创建 `EM_HIDDEN`。

但这会导致一个可见的症状：**用户会看到"创建新标签"按钮，而不是矩阵面板**。用户报告的症状是"点击按钮后任务仍然在矩阵中"——这说明**面板确实在渲染**（意味着 `EM_HIDDEN` 已经在 store 中），但标签更新可能没有生效。

另一条线索：`handleTagUpdates()` 中有 `.filter(tagId => state[TAG_FEATURE_NAME].entities[tagId])`。如果更新时 `EM_HIDDEN` 不在 store entities 中，`EM_HIDDEN` 会被**静默过滤掉**，task.tagIds 中不会包含它。但如果面板正常渲染，说明 `EM_HIDDEN` 确实存在于 store 中。

所以真正的问题可能在于：`taskAdapter.updateOne` 更新了 task entity，但 **`board-panel` 组件的过滤逻辑**使用了过时的数据，或者**面板的 `taskIds` 没有及时更新**。

### 第二轮修复 (2048e3a9b)

**核心修改 1** — `tag.reducer.ts`：

```typescript
// _addMyDayTagIfNecessary → _addSystemTagsIfNecessary
const SYSTEM_TAGS = [TODAY_TAG, URGENT_TAG, IMPORTANT_TAG, HIDDEN_MATRIX_TAG];

const _addSystemTagsIfNecessary = (state: TagState): TagState => {
  let next = state;
  for (const sysTag of SYSTEM_TAGS) {
    if (next.ids && !(next.ids as string[]).includes(sysTag.id)) {
      next = {
        ...next,
        ids: [sysTag.id, ...next.ids],
        entities: { ...next.entities, [sysTag.id]: sysTag },
      };
    }
  }
  return next;
};

// 应用到 initialState 和 loadAllData
export const initialTagState: TagState = _addSystemTagsIfNecessary(tagAdapter.getInitialState({}));
on(loadAllData, (oldState, { appDataComplete }) =>
  _addSystemTagsIfNecessary(appDataComplete.tag ? { ...appDataComplete.tag } : oldState),
),
```

**核心修改 2** — `task-context-menu-inner.component.ts`：

```typescript
removeMatrixTags(): void {
  const filtered = (task.tagIds ?? []).filter(
    (id: string) => id !== URGENT_TAG.id && id !== IMPORTANT_TAG.id,
  );
  const newTagIds = [...new Set([...filtered, HIDDEN_MATRIX_TAG.id])];
  // 安全兜底：确保 EM_HIDDEN tag 实体存在后再更新任务
  this._tagService.addTag(HIDDEN_MATRIX_TAG);
  this._taskService.updateTags(task, newTagIds);
}
```

**结果**：构建成功，但**功能未验证通过**。

### 下一步排查方向（按优先级）

1. **DevTools 验证数据流**：

   ```
   // Redux DevTools 或控制台
   state.tag.entities['EM_HIDDEN']   // → 应该是 truthy
   state.tag.entities['EM_URGENT']   // → 应该是 truthy
   state.tag.entities['EM_IMPORTANT'] // → 应该是 truthy
   ```

   确认三个系统标签实体是否存在于 store 中。

2. **检查 updateTask action 的完整路径**：

   ```
   dispatch updateTask({id: taskId, changes: {tagIds: [..., 'EM_HIDDEN']}})
     → 在 Redux DevTools 中确认 action 被 dispatch
     → 检查 handleUpdateTask → handleTagUpdates 中的 filter 是否过滤掉了 EM_HIDDEN
     → 检查 taskAdapter.updateOne 后的 state 中 task.tagIds 是否包含 EM_HIDDEN
   ```

3. **在 `handleTagUpdates` 中添加日志**（`task-shared-crud.reducer.ts`）：

   ```typescript
   // 在 .filter 之前
   console.log(
     '[handleTagUpdates] tagIds before filter:',
     tagIds,
     'entities keys:',
     Object.keys(state.tag.entities),
   );
   ```

4. **检查 `board-panel` 组件的过滤逻辑**：确认面板是否正确读取了更新后的 `task.tagIds` 来判断任务应在哪个象限。`board-panel` 可能缓存了 task 数据。

5. **检查 `updatePanelCfgTaskIds` 是否被调用**：Eisenhower 面板的 `taskIds` 数组需要更新才能反映标签变化。如果面板的 `taskIds` 是预计算/缓存的，`removeMatrixTags` 不会触发重新计算。

6. **检查竞态条件**：`addTag(HIDDEN_MATRIX_TAG)` 是 dispatch action（同步），但 reducer 执行在下一个 microtask 吗？`updateTags` 调用时 `EM_HIDDEN` 是否已经在 store 中？

### 涉及文件清单

| 文件                                                                                                    | 角色                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `src/app/features/tag/tag.const.ts`                                                                     | 系统标签常量定义                                |
| `src/app/features/tag/store/tag.reducer.ts`                                                             | 标签 Reducer，系统标签自动创建                  |
| `src/app/features/tag/tag.service.ts`                                                                   | addTag 方法：dispatch addTag action             |
| `src/app/features/tasks/task.service.ts`                                                                | updateTags 方法：dispatch updateTask action     |
| `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts` | removeMatrixTags() 入口                         |
| `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.ts`                         | handleUpdateTask / handleTagUpdates（过滤逻辑） |
| `src/app/features/boards/board/board.component.ts`                                                      | patchedBoardCfg + missingTagIds 门控            |
| `src/app/features/boards/board/board.component.html`                                                    | @if (missingTagIds().length) 模板门控           |
| `src/app/features/boards/store/boards.reducer.ts`                                                       | 数据迁移（EM_HIDDEN 加入 excludedTagIds）       |
| `src/app/features/boards/board-panel/board-panel.component.ts`                                          | 面板渲染、taskIds 过滤（待检查）                |

---

## 版本信息

| 版本号                     | Commit      | 状态                                      |
| -------------------------- | ----------- | ----------------------------------------- |
| `18.12.0-desktop-plan.10`  | `a7e3cbf49` | 第一轮修复前基线                          |
| `(未提交)`                 | `ea6a9379f` | 第一轮修复（已构建部署，未提交）          |
| `18.12.0-desktop-plan.11W` | `2048e3a9b` | 第二轮修复（已提交 + 推送 + 合并到 main） |

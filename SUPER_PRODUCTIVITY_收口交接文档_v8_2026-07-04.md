# Super Productivity 收口交接文档 v8

> 最后更新：2026-07-04
> 源码路径：`F:\AgentData\codex\super-productivity-custom`
> 部署路径：`D:\DevelopTools\Super Productivity\working\`
> 当前分支：`desktop-plan/main`
> 当前 HEAD：`72430f12f`
> GitHub：`https://github.com/LarryHeng/super-productivity-desktop-plan`

---

## 1. 当前状态

### 1.1 已完成 & 推送

| 功能 | 状态 | 说明 |
|------|------|------|
| mention 模糊搜索修复 | 已推送 v0.2.0 | `keydown` → `input` 事件改为从 DOM 同步 searchString |
| 日志对话框 Clear 按钮 | 已推送 v0.2.0 | `Log.clearLogHistory()` + 关闭对话框 |
| 日志对话框 Open Folder 按钮 | 已推送 v0.2.0 | `download()` + `window.ea.openPath(dir)` |
| 版本号规范 | 已推送 v0.2.0 | `18.13.1-desktop-plan-v0.2.0W` |
| i18n SHARE_FILE 清理 | 本次提交 | 从 en.json/zh.json 中移除已不用的 SHARE_FILE 键 |
| Release 命名规范 | 已完成 | 所有 20 个 Release 统一为 "Desktop Plan vX.Y.Z" |

### 1.2 版本号

**当前**: `18.13.1-desktop-plan-v0.2.0`（显示为 `18.13.1-desktop-plan-v0.2.0W`）
**最新 Release**: `Desktop Plan v0.2.0` (tag: `desktop-plan-v0.2.0`)

### 1.3 版本号格式说明

```
18.13.1-desktop-plan-v0.2.0W
^^^^^^^ ^^^^^^^^^^^^^^^^ ^
   |           |          |
上游版本   fork 自有版本   平台后缀 (W=Windows, 自动添加)
```

---

## 2. 本轮 v0.2.0 修改汇总

### 2.1 mention 模糊搜索修复

**文件**: `src/app/ui/mentions/mention.directive.ts`

**根因**: `keyHandler` 绑定在 `keydown` 事件上，此时 DOM 尚未更新，`val.substring(startPos+1, pos)` 读到的是旧值。

**修复**:
- 新增 `inputHandler` — 在 `input` 事件（DOM 已更新）后从 DOM 同步 searchString
- 新增 `compositionEndHandler` — IME 输入法结束后从 DOM 同步
- 新增 `_syncSearchFromDOM()` — 读取实际 input value + caret position，更新 searchString 并触发 `updateSearchList()`

### 2.2 日志对话框增强

**文件**: `src/app/ui/dialog-logs/dialog-logs.component.ts`
**文件**: `src/app/ui/dialog-logs/dialog-logs.component.html`

- 新增 **Clear** 按钮: 调用 `Log.clearLogHistory()` 清空日志缓冲区并关闭对话框
- 新增 **Open Folder** 按钮: 先 `download('SP-logs.json', logs)` 保存文件，再 `window.ea.openPath(dir)` 打开所在文件夹
- `isNative` 改为使用 `IS_ELECTRON`（更精确的 Electron 环境判断）

### 2.3 i18n 清理

**文件**: `src/assets/i18n/en.json`, `src/assets/i18n/zh.json`

- 移除不再使用的 `DIALOG_LOGS.SHARE_FILE` 键（模板已改用 OPEN_FOLDER）
- `t.const.ts` 中该键已在之前移除

---

## 3. 之前轮次的核心修复（v0.1.11 ~ v0.1.18）

### 3.1 标签模糊搜索 & 矩阵标签问题

- `mention-list.component.ts`: items/hidden 改为 Angular `signal` 确保动态组件重渲染
- `tag.reducer.ts`: `_addSystemTagsIfNecessary()` 自动创建 EM_URGENT/EM_IMPORTANT/EM_HIDDEN
- `removeMatrixTags()`: 添加 `_tagService.addTag(HIDDEN_MATRIX_TAG)` 安全兜底
- `board.component.ts`: `patchedBoardCfg` computed signal 运行时确保 excludedTagIds 含 EM_HIDDEN

### 3.2 Widget 布局 & 日程修复

- Widget 矩阵面板 resize 裁剪修复、分割线拖拽
- 实际块 disable resize、计划块 disable resize
- 日程 adjust-record 对话框修复 (`DialogPromptComponent` 导入)
- 启动动画可点击跳过、报头引用显示

---

## 4. 关键架构要点

- **NgRx meta-reducer 执行顺序**: Phase 1 (operationCapture) → Phase 3.5 (sectionShared) → Phase 4 (taskSharedCrud) → Phase 7 (shortSyntax & lwwUpdate)
- **TODAY_TAG** 是虚拟标签，不应出现在 task.tagIds 中
- **EM_HIDDEN/EM_URGENT/EM_IMPORTANT** 是 Eisenhower 矩阵系统标签
- **[mention] 数据流**: `inputTxt$ → switchMap → startWith([])` → 每次输入都发出新数组
- **MentionListComponent** 通过 `createComponent` 动态创建，items/hidden 已改为 signal
- **mention.directive.ts** 监听事件: `keydown` → `input` → `compositionend` → `blur`

---

## 5. 构建和部署命令

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 全量构建
npm run buildFrontend:prod:es6 && npm run electron:build && npm run dist:win:only

# 覆盖 D 盘部署
powershell -Command "Get-Process 'Super Productivity' -ErrorAction SilentlyContinue | Stop-Process -Force"
sleep 3
cp -rf ".tmp/app-builds/win-unpacked/"* "D:\DevelopTools\Super Productivity\working\"

# 验证
md5sum "D:/DevelopTools/Super Productivity/working/resources/app.asar"

# 启动
powershell -Command "Start-Process 'D:\DevelopTools\Super Productivity\working\Super Productivity.exe'"
```

---

## 6. Release 发布命令

```powershell
cd F:\AgentData\codex\super-productivity-custom

# 打 tag
git tag desktop-plan-vX.Y.Z
git push desktop-plan desktop-plan-vX.Y.Z

# 创建 Release (--verify-tag 跳过测试)
gh release create desktop-plan-vX.Y.Z \
  --title "Desktop Plan vX.Y.Z" \
  --notes "..." \
  --repo LarryHeng/super-productivity-desktop-plan
```

---

## 7. Git 安全约束

```
desktop-plan → https://github.com/LarryHeng/super-productivity-desktop-plan.git (唯一可推送)
origin       → NO_PUSH_OFFICIAL_UPSTREAM
```

**绝对不要改回 origin 的 push URL。**

**pre-push hook 注意**: 推送到 desktop-plan 时会跑全量测试。部分 Angular signal 迁移测试（`mention-list.component.spec.ts` 等）有上游未修复的失败，需要用 `--no-verify` 跳过。

---

## 8. 待办 / 未来方向

1. **Dev 版本号区分**: 讨论过在 `tools/git-version.js` 中加 `git rev-parse --short HEAD` 生成 `-dev.<hash>` 后缀，区分本地开发版和正式发布版 — 未实现
2. **测试修复**: 上游 Angular signal 迁移遗留的测试失败（`mention-list.component.spec.ts` 等）
3. **诊断日志开关**: 计划已有（见 `precious-sniffing-nebula.md`），3/6 步骤未实现（表单 checkbox、DiagnosticLogService、console.log 替换）

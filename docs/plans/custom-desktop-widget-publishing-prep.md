# 桌面计划定制版开发说明

本文记录 Super Productivity 独立衍生版与官方版本的功能差异和发布前检查。
文档与仓库不包含用户数据、本机密钥、个人图片、备份或构建产物。

## 主要差异

### 桌面任务小组件

- 复用内置艾森豪威尔矩阵，与主程序任务保持同步。
- 使用普通桌面窗口层级：其他应用可以覆盖小组件，Windows“显示桌面”后小组件会恢复。
- 保存位置和尺寸，并限制可用的最小尺寸。
- Open 操作会恢复并最大化主窗口；关闭小组件会同步关闭主程序设置。
- 点击任务开始，再次点击同一任务暂停或继续。
- DONE 是唯一完成任务的操作。任务完成后先置灰保留，直到每日结算移除矩阵标签。
- 倒计时结束时弹出延时输入，由用户决定增加的分钟数。
- 小组件背景可见度和文字内容可见度相互独立。
- 小组件单独背景优先于全局背景；没有单独背景时继承全局背景。
- 渲染进程启动后会重新应用外观设置，保证重启或异步创建窗口后仍然生效。

### 规划与实际时间

- 规划表固定显示周一至周日，历史周保持可见。
- 当天使用蓝色高亮，浏览其他周时提供“回到今天”。
- 规划表月视图同样从周一开始，只列出每天的工作内容，不显示计划或实际时长。
- 点击规划表月视图日期，会打开该日期所在的周一至周日。
- 时间表周视图固定从周一开始，历史周保持可见。
- 时间表月视图按任务合并实际计时段，显示每项累计时长和当天总计时长。
- 点击时间表月视图日期，会打开该日期所在的周一至周日。
- 周次使用本地日期计算，避免 UTC+8 时区下周一跳错周的问题。
- 时间表分别渲染实际工作段和规划参考段。
- 实际工作段是不可拖动的历史记录；规划参考段可以拖动，并在与实际工作重叠时顺延。
- 同一任务的相邻实际段按设置的间隔自动合并，默认 5 分钟，可设置为 0 至 30 分钟。
- 当前时间线按秒跟随真实时间，并只显示在当天高亮列中。
- 将空闲时间分配给已有任务或新任务时，完整空闲区间会写入实际历史，
  不会从确认弹窗的时刻重新启动任务。

### 每日结算

- 可以通过现有“结束这一天”流程手动结算。
- 每个逻辑日边界只自动结算一次；开始时间为 04:00 时，结算边界也是 04:00。
- 结算会移除已完成顶层任务的 Urgent 和 Important 标签，而不是归档任务。
  历史记录继续保留，结算后的任务会离开桌面矩阵。

### 背景与存储

- 用户可以上传和重置全局应用背景，全局背景优先于项目或标签背景。
- 用户可以独立上传和重置小组件背景。
- 两类背景都支持在图片上选择焦点，`cover` 裁切和窗口缩放时按百分比坐标定位。
- 两处设置统一显示受管副本的实际路径，用户可以选择背景图片存储目录。
- 更换背景库目录会先复制现有受管文件并持久化新路径，再清理旧副本；
  用户最初选择的源图片始终保持不变。
- 图片缺失或不可读时回退为无背景，不导致程序退出。
- 导入的图片按不透明 ID 存储。备份链接到名为 `backups` 的外部目录时，
  图片存入同级 `bg-images`；否则使用应用常规用户数据目录。
- 部署时仍可通过 `SP_IMAGE_CACHE_DIR` 显式指定图片目录。

### 备份与窗口行为

- 用户可以选择外部本地备份目录。
- 默认备份目录替换为 junction 或符号链接前，会先迁移已有备份文件。
- 设置页只显示一次实际物理备份目录，并说明兼容链接的用途。
- 原生最小化会让主程序保留在任务栏，而不是隐藏到托盘；关闭到托盘仍是独立设置。
- 空闲检测弹窗操作已补全中文翻译。

## 发布约束

- 不提交用户数据、备份、上传图片、截图、安装包、解包目录或缓存目录。
- 源码和文档不得包含本机用户名与密钥。
- 发布到个人独立仓库；保留官方项目链接、MIT 许可证和原始版权声明。
- 官方上游仅作为来源与致谢信息，不再自动拉取或合并后续版本。
- 提交前检查 `package-lock.json` 并执行 `git diff --check`。

## 验证

自动检查：

```powershell
npm run int:test
npm run lint:ts
npm run lint:scss
npx tsc -p electron\tsconfig.electron.json --noEmit
node --test electron\image-cache.test.cjs electron\local-file-sync.test.cjs electron\backup.test.cjs electron\task-widget.test.cjs electron\window-visibility-policy.test.cjs electron\i18n-zh-custom.test.cjs electron\app-control.test.cjs electron\indicator.test.cjs
npx ng test --watch=false --no-code-coverage --source-map=false --include='src/app/features/planner/**/*.spec.ts' --include='src/app/features/daily-settlement/**/*.spec.ts' --include='src/app/pages/daily-summary/daily-summary.component.spec.ts' --include='src/app/features/tasks/store/task-electron.effects.spec.ts' --include='src/app/features/tasks/store/task-widget-panels.util.spec.ts' --include='src/app/features/schedule/map-schedule-data/append-actual-time-segments-to-schedule-days.spec.ts' --include='src/app/pages/config-page/config-page.component.spec.ts' --include='src/app/features/config/task-widget-settings.service.spec.ts'
```

生产构建与打包：

```powershell
npm run buildAllElectron:noTests:prod
npx electron-builder --win portable --x64 --publish never --config.win.signAndEditExecutable=false
```

手工冒烟检查：

- 使用复制的用户数据配置启动打包应用。
- 确认主程序与桌面小组件均正常渲染。
- 确认规划表准确显示周一至周日七天。
- 点击月视图日期，确认进入对应周，并能返回当前周。
- 确认时间表月视图显示按任务合并的实际时长与每日总计；
  规划表月视图只列内容，不显示时长。
- 将空闲时间分配给任务，确认写入完整区间后计时仍保持停止。
- 确认当天列高亮和当前时间线位置。
- 确认重启后仍会应用小组件可见度设置。
- 确认 Windows“显示桌面”后小组件仍可见且未保持最小化。
- 确认已安装可执行文件与打包产物的哈希一致。

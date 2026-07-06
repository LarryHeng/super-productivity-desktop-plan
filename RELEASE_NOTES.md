# Desktop Plan v0.3.0

感谢 Super Productivity 官方项目、Johannes Millan 和所有上游贡献者。
本版本是基于 Super Productivity 18.13.1 的非官方 Windows 桌面规划衍生版。

## 功能修复

- 实际块删除按钮失效：dayStr 推导逻辑修复，支持未设置 plannedForDay 的实际块删除
- 部分块”调整记录”无响应：timeSpentOnDay 为空时 fallback 到 segment.duration
- Formly datepicker 未注册：日期输入改用 type: 'date'
- 新增 actions 未注册 op-log：Remove/Update segment 加入 ActionType 枚举
- 月视图不显示补记记录：新增 CompletedPlannedTask 类型匹配
- 真实块修改时长无上限：originalDuration 硬上限，只能缩减不能延长

## 新增功能

- 倒数日：替换励志语句，支持自定义名称、目标日期、颜色、字号、粗细
- 小组件倒数日：独立显示开关 + 8 个独立样式字段
- 倒计时超时红色：归零后 mode 切换为 task-overtime，红色正向计时
- 小组件深色模式完整适配

## 功能改造

- 小组件导航栏重构：左侧倒数日+标题，右侧计时+按钮；窄屏自适应两行布局
- 时间追踪分段重构：segment 新增 originalDuration 字段；手动补记永不合并
- 全局日历改造：datetime-local 统一替换为 DateTimePickerComponent
- 调整记录对话框改进：文本框输入格式 (1h 30m)、独立删除按钮、全中文化

## Windows 安装

- 适用于 Windows x64。
- 安装目录可自选，建议使用非系统盘。
- 该社区构建未使用商业代码签名证书，Windows 可能显示”未知发布者”。
- 安装前建议保留一份现有备份；安装不会主动删除用户数据。

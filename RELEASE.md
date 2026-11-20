# 发布说明

当前工作台版本为 **1.0.0**（2026-11-20）。完整更新内容见 `CHANGELOG.md`，安装与换机说明见 `README.md`，测试边界见 `docs/TEST-REPORT.md`。

上游 `gpt_image_playground` v0.9.5 的原有修复记录：

### 修复

- 完善 Codex CLI 兼容模式，输出格式固定为 PNG，并禁用无效的遮罩、复杂度、审核及压缩率设置。
- 修复部分 Codex CLI 接口通过 Responses API 生成图片时请求失败的问题，普通生图和 Agent 批量生图均适用。
- 修正部分生图错误被误提示为不支持流式传输的问题。

# 拼多多套图工作台架构

本文档落实 `/workspace/pdd-workbench-build/CODEX-BUILD-PLAN.md` 中的只读 Codex 规划，并记录实际落地方式。规划基于现有 `gpt_image_playground`（Vite 6 + React 19 + TypeScript + Zustand 5），目标是低侵入改造：保留原版自由生图，新增默认进入的拼多多套图工作台。

## 1. 视图与状态

- 外层 `workbenchView`（`src/pdd/workbenchView.ts`）独立持久化在 `localStorage['pdd-workbench-view']`，默认 `'pdd'`，可选 `'free'`。
- 不扩展原有 `appMode`（仍为 `'gallery' | 'agent'`）。自由生图模式下完整保留画廊与 Agent。
- 套图会话使用独立 Zustand persist 存储 `pdd-workbench-session`。参考图和成图二进制只写入已有 IndexedDB（`storeImage` / `getImage`），localStorage 只保存元数据，避免把大图写入同步存储。
- 刷新或水合后，队列状态强制回到 `idle`，**绝不自动发起策划或生图**。

## 2. 文件划分

| 路径 | 职责 |
| --- | --- |
| `src/pdd/prompts.ts` | 跨品类策划 System Prompt、绝对外观锁定、主图/场景/构图/排版规则、生图 Prompt 组装 |
| `src/pdd/planSchema.ts` | 策划 JSON 提取、张数与字段校验 |
| `src/pdd/models.ts` | `GET /v1/models` 分类；优先 `gpt-6.2-astra` 与 `gpt-image-2.6`/`2.5`；禁止默认 `gpt-image-2.6-sunburst`；图像模型不得用于策划 |
| `src/pdd/api.ts` | 检测连接、一次 `POST /v1/chat/completions` 视觉策划（不回退到 responses） |
| `src/pdd/generation.ts` | 串行队列（并发=1）、暂停/停止、单张失败即停且不自动重试 |
| `src/pdd/imageParams.ts` | 比例到 `size=auto` + `aspect_ratio`；展示实际解码像素 |
| `src/pdd/store.ts` | 套图会话、分镜卡片、模型选择 |
| `src/pdd/Workbench.tsx` 等 | 输入区、分镜卡片、画廊、对比灯箱、导出 |
| `src/pdd/exportSet.ts` | 原图 PNG 下载与 ZIP（复用已有 `fflate`，不新增 jszip） |

原有 `submitTask({ input: { prompts, inputImages } })` 被复用，但**每次只提交一个 prompt**，避免 `prompts.length > 1` 走批量计费。提交前后快照并恢复 `params`、`settings.model` 与 `apiMode`，以免污染自由生图。

## 3. 关键安全与稳定性

- 发布版不含内部诊断插件或一次性验证路由；刷新页面不会自动发起策划或生图。上游 Tauri diagnostics 保留。
- 不读取、不打印、不打包 `.env*`、浏览器中的 API Key、Cookie 或 Cockpit 凭据。
- 检测连接与策划都通过当前应用配置中的 Base URL / Key 发起，失败清晰报错，不静默死循环。
- 队列并发固定为 1；单张失败标红并停止；用户必须再次点击才会重试。

## 4. 产品规则（写入 Prompt，而非写死玩具模板）

- t57 绝对外观锁定：策划 System Prompt 与每张最终生图 Prompt 都必须包含。
- t45 主图以产品为主、文字少量点缀。
- t46 详情/后续图避免整张纯白底，使用有色彩的生活或使用场景。
- t49 场景图完整展开，禁止用满高空文字栏把画面切成一半。
- t27/t35/t40 电商转化与原生中文排版，中文由图像模型直接融合，不后期叠字。

## 5. 跨电脑交付

- 用户在新电脑自装 Cockpit、自授权，再填写本机地址与 Key。
- README 与帮助弹窗注明 Cockpit 许可（CC BY-NC-SA 4.0，商用需书面授权）以及官方 OpenAI API Key 为另计费备选。
- 启动脚本：`start-mac.sh`（macOS 实测）、`start-win.bat`（未在 Windows 实机验收）。
- 便携包不得包含 `.env*`、密钥、日志或用户隐私文件；在用户审核前不创建或推送远端仓库。

## 6. 测试计划

- 单元测试：Prompt 锁定注入、JSON 解析与张数校验、模型挑选、比例映射。
- `npm run build` 零报错。
- 端到端通过已保存配置的本机界面实测：检测模型、上传参考图、1 次策划、最多 6 次串行生图、原图下载与 ZIP。失败不自动重试，不因单图像素微差重跑多轮。

## 7. 增量更新：自由生图历史分页（2026-11-19）

- 分页单位是 `TaskRecord`（任务卡片），不是单张输出图。`outputImages` 多张仍只占 1 条。
- 每页 20 条，状态与页码控件在任务网格下方；页数较多时用省略号，不把页码铺满。
- 页码只存在于内存（`useGalleryPageStore`），不写入任务持久化或 IndexedDB。
- 筛选/搜索变化回到第 1 页；删除导致总页数缩小会钳制当前页；新成功记录不强制跳回第 1 页，可选择「查看新成功记录」。
- 「全选本页 / 反选本页」只作用于当前页任务。套图工作台行为不变。

## 8. 1.0.0 发布准备（2026-11-20）

- 启动逻辑集中在 `scripts/start-workbench.mjs`，macOS / Windows 入口只负责找到脚本。默认 `127.0.0.1:5173`，`strictPort`。
- Node 引擎：`^22.12.0 || ^24.0.0 || ^26.0.0`，推荐当前 Active LTS 26。
- 已移除会自动对外发布的上游 workflow，仅保留只读 CI 定义。

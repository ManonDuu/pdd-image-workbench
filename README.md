# 拼多多图片生成工作台

基于开源项目 [CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground)（上游版本 0.9.5，许可证：MIT，请保留署名）改造。默认进入「拼多多套图工作台」，也可切换回原版「自由生图」。

本仓库是源码存档。把它下载到你自己的 Windows 或 Mac 上，安装依赖并完成本机配置后，就可以像在当前测试机上一样使用。**本工作台不登录 ChatGPT，也不打包任何人的账号或密钥。**

## 你需要先准备什么

1. **Node.js LTS**  
   从 [Node.js 官网](https://nodejs.org) 安装当前 **Active LTS**（本说明写作时为 **Node 26**）。也支持仍在安全维护期内的 **Node 22**（需 22.12.0 或更高）和 **Node 24**。  
   - 不支持已停止维护的 Node 20 及更早版本。  
   - 不建议使用非 LTS（例如 Node 25，或 Node 27 Alpha）。  
   - 安装后在终端执行 `node -v` 和 `npm -v`，确认能找到命令。不要依赖某一台电脑上的专用便携 Node 路径。

2. **Cockpit Tools（请自行安装，本仓库不捆绑）**  
   从官方仓库的 Releases 页下载与你的系统、芯片匹配的安装包：  
   [https://github.com/jlcodes99/cockpit-tools/releases](https://github.com/jlcodes99/cockpit-tools/releases)  
   官方提供 macOS（Apple Silicon / Intel / universal）、Windows（x64 / arm64）和 Linux 包。请选择对应架构，不要假设「所有系统版本都能用同一个安装包」。

3. **现代浏览器**  
   请使用最新版 Chrome、Edge、Firefox 或 Safari。工作台以本机网页方式运行。内置中文字体默认从公共 CDN 加载，并回退到系统字体；源码包默认不附带较大的本地字体文件，不影响使用。如需离线内置字体，见 `fonts/README.md`。

## 安装与启动

1. 从 GitHub 下载源码 ZIP 并解压，或克隆仓库。请把项目放在你自己选择的目录（路径里可以有空格）。
2. 打开终端（Windows 可用「命令提示符」或 PowerShell），进入解压后的项目目录。
3. 安装依赖（必须有 `package-lock.json`，以保证版本一致）：

```bash
npm ci
```

4. 启动工作台：

- macOS 终端：`chmod +x start-mac.sh start-mac.command && ./start-mac.sh`  
  也可以在 Finder 中双击 `start-mac.command`。
- Windows：双击 `start-win.bat`，或在项目目录运行该脚本。  
  **Windows 启动脚本已做静态校验，但尚未在 Windows 真机验收。** 若双击失败，请用命令提示符在项目目录运行 `node scripts\start-workbench.mjs`，并把完整报错留下来。
- 也可直接运行：`npm start`

5. 浏览器打开固定地址：[http://127.0.0.1:5173/](http://127.0.0.1:5173/)

工作台默认只绑定本机 `127.0.0.1`，不会故意暴露到局域网。若 5173 已被占用，启动会直接失败并提示，**不会自动换端口**。请先关闭占用该端口的程序。请始终使用 `http://127.0.0.1:5173/` 这个地址：浏览器按「协议 + 主机名 + 端口」保存设置和历史，改成 `localhost` 或换一个端口，看起来会像记录消失。

## 在工作台里配置（每台新电脑都要做一次）

1. 安装并打开 Cockpit Tools，使用**你自己的账号**登录，并开启本机 API。
2. 在工作台「设置」中填写：
   - Base URL：`http://127.0.0.1:62037/v1`（以你本机 Cockpit 实际端口为准）
   - API Key：Cockpit 提供的本机客户端 Key
3. 点击「检测连接 / 获取模型」。规划模型会优先选择目录里可用的视觉对话模型（如 `gpt-6.2-astra`），生图模型优先 `gpt-image-2.6` 或 `gpt-image-2.5`，**不会默认使用无效的 `gpt-image-2.6-sunburst`**。

密钥和设置只保存在**这台电脑的浏览器**里，不会写入 GitHub，也不会随着源码下载自动出现在另一台电脑上。

### 常用操作

1. 上传商品参考图（AVIF 会在策划/生图前自动转为 PNG；无法解码时会就地提示，不会发出无效请求）。
2. 选择张数（3 / 6 / 9 或 1–12 张）和画面尺寸（预设比例或自定义像素/比例，例如 800×1000），可选指定文案主色（只选一个颜色，撞色由 AI 按商品图自动搭配），填写卖点（可留空）。
3. 点击「AI 规划整套方案」，确认分镜后再「一键生成全部」（串行出图，失败即停，不会自动重试）。
4. 也可只重绘其中一张。若修改了标题、副标题、场景、排版或最终 Prompt，重绘会按你最新的内容发送。
5. 卡片显示模型实际解码像素，不虚标 2K/4K。可下载单张原图 PNG，或按目标尺寸居中裁切后打包 ZIP。
6. 套图成功的结果也会出现在「自由生图」历史中。历史按**任务记录**分页，每页 20 条；「全选本页」只作用于当前页。

刷新页面不会自动重新发起策划或生图。

## 更新源码

推荐把新版本解压到一个**新目录**，在新目录执行 `npm ci` 后再启动，并仍然打开 `http://127.0.0.1:5173/`。这样浏览器里已有的设置和历史还在，也不会和旧的 `node_modules` 混在一起。

不要把旧电脑上的 `.env.local`、浏览器用户数据或含有密钥的配置文件复制到 GitHub 或发给别人。

## 换一台电脑（安全迁移）

可以带走的：本仓库源码（或 GitHub 上的存档）、你自己写的说明。

不要带走、也不要提交的：API Key、Cockpit 登录态、浏览器配置、IndexedDB 里的历史和成品、`.env.local`、`dev-proxy.config.json`、`gpt-image-config.json`、Cookie。

在新电脑上请重新：安装 Node 与 Cockpit → 登录你自己的账号并开启 API → `npm ci` → 启动 → 在设置里填写这台电脑的 Base URL 和 Key。历史记录不会随 GitHub 自动同步。

## 排障

| 情况 | 建议 |
| --- | --- |
| 提示找不到 Node，或版本不受支持 | 从官网安装 Node 22.12+ / 24 / 26 LTS，重新打开终端后再试。 |
| `npm ci` 失败 | 确认在项目根目录，且存在 `package-lock.json`；检查网络；删除不完整的 `node_modules` 后重试。 |
| 端口 5173 被占用 | 关闭占用程序后重试，不要改端口以免会话对不上。 |
| 页面能打开但无法策划/生图 | 确认 Cockpit 已启动、本机 API 已开启，设置里的 Base URL / Key 与 Cockpit 一致，并先点「检测连接」。 |
| 官方通道不能生图 | 按 Cockpit 官方说明，官方通道生图是禁止的。请使用本机 API 服务和客户端 Key。官方 OpenAI API Key 只是另计费的备选通道。 |
| Windows 双击脚本无效 | 尚未在 Windows 真机验收。请在项目目录用命令行运行 `node scripts\start-workbench.mjs`。 |
| 上传 AVIF 报错 | 当前版本会自动转换；若仍失败，请换用能正常打开的 PNG / JPG，或查看页面上的解码提示。 |

## 功能概要

- 跨品类套图：绝对指令不允许改变产品外观；主图轻文字，后续图使用有色彩的生活场景，并保留原生中文排版。
- 自定义尺寸 / 比例，文案主色单选、系统按商品图自动配撞色。
- 单张重绘会同步你刚改过的文案或最终 Prompt。
- 「自由生图」历史分页，每页 20 条任务记录。

## 开发命令

```bash
npm ci
npm test          # 单元测试
npm run build     # 生产构建
npm start         # 启动本机工作台（127.0.0.1:5173）
```

更完整的改造说明见 `docs/WORKBENCH-ARCHITECTURE.md`。上游原项目说明见 `docs/UPSTREAM-README.md`。本版本测试记录见 `docs/TEST-REPORT.md`。

## 许可证与边界

- 本仓库对上游 `gpt_image_playground` 的改动同样以 MIT 许可分发，并保留原作者署名：Copyright (c) 2026 CookSleep。完整条文见 `LICENSE`。
- Cockpit Tools 是独立软件，默认采用 **CC BY-NC-SA 4.0**：允许个人学习、研究、非商业使用与修改（须署名并以相同方式共享）。**未获得作者书面授权，不得用于任何商业用途**（包括企业内部商业目的、对外商业服务、付费产品集成、二次分发售卖等）。能在本机运行不代表已经获得商用许可。
- 本仓库不附带 Cockpit 安装程序或会话，也不提供未经验证的一键登录。
- 使用 ChatGPT / OpenAI 相关服务时，还须遵守其自身条款；官方 API Key 产生的费用由该账号承担。

## Windows / macOS 支持范围

已在当前 Apple Silicon Mac 上实际使用，并在 Linux 环境做过干净目录安装、构建和启动抽查。Windows 启动脚本提供了路径空格、UTF-8、npm 失败退出和 Node 检测，但**尚未在 Windows 真机跑通**。请按你电脑的系统与芯片选择 Node 和 Cockpit 的对应版本。

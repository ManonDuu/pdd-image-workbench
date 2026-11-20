export const INSTALL_HELP_TITLE = '新电脑安装与自有账号授权'

export function InstallHelpContent() {
  return (
    <div className="space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
      <p>这套工作台本身不登录 ChatGPT，也不打包任何人的账号或密钥。换电脑使用时，请在新电脑上自行完成下面几步：</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>从 Cockpit Tools 的官方 Releases 安装对应系统版本（本工作台不捆绑分发该软件）。</li>
        <li>在 Cockpit 内登录你自己的 ChatGPT 账号，并开启本机 API / 网关。</li>
        <li>在本工作台设置中填写本机地址（默认提示 <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">http://127.0.0.1:62037/v1</code>）和本机 API Key。密钥只保存在这台电脑的浏览器中，不会写入项目文件，也不会出现在日志里。</li>
        <li>点击「检测连接 / 获取模型」，确认规划模型和生图模型都识别成功后再开始策划。</li>
      </ol>
      <p>
        Cockpit Tools 为开源软件，许可证为 CC BY-NC-SA 4.0；商业使用需要获得作者书面授权，请自行核对其官方说明，不要把“能在本机跑起来”理解成已经获得商用许可。
      </p>
      <p>若你改用官方 OpenAI API Key，也可以作为另计费的备选通道，费用由该官方账号承担，与本机 Cockpit 订阅不是同一条路径。</p>
    </div>
  )
}

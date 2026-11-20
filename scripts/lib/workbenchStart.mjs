/**
 * 跨平台启动检查：Node 版本、默认绑定地址、端口冲突提示。
 * 推荐当前 Active LTS（Node 26），同时兼容仍在维护的 22 / 24 LTS。
 */
export const RECOMMENDED_NODE_MAJOR = 26
export const SUPPORTED_NODE_RANGE = '^22.12.0 || ^24.0.0 || ^26.0.0'
export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_PORT = 5173
export const MIN_NODE_22_PATCH = [22, 12, 0]

export function parseNodeVersion(raw) {
  const text = String(raw || '').trim().replace(/^v/i, '')
  const match = text.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function isSupportedNodeVersion(raw) {
  const version = parseNodeVersion(raw)
  if (!version) {
    return { ok: false, reason: 'invalid', message: `无法识别 Node.js 版本「${raw}」。请安装受支持的 LTS：${SUPPORTED_NODE_RANGE}` }
  }
  const { major, minor, patch } = version
  const allowed =
    (major === 22 && (minor > 12 || (minor === 12 && patch >= 0))) ||
    major === 24 ||
    major === 26
  if (!allowed) {
    return {
      ok: false,
      reason: 'unsupported',
      version,
      message:
        `当前 Node.js 为 ${major}.${minor}.${patch}，本工作台需要 ${SUPPORTED_NODE_RANGE}。` +
        `请从 https://nodejs.org 安装当前 Active LTS（现为 ${RECOMMENDED_NODE_MAJOR}.x），或仍在维护的 22 / 24 LTS。` +
        '不支持已停止维护的 Node 20 及更早版本，也不建议使用非 LTS。',
    }
  }
  return { ok: true, version, message: `Node.js ${major}.${minor}.${patch}` }
}

export function resolveListenAddress(env = process.env) {
  const host = String(env.HOST || DEFAULT_HOST).trim() || DEFAULT_HOST
  const portRaw = env.PORT
  const port = portRaw == null || portRaw === '' ? DEFAULT_PORT : Number(portRaw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, host, port, message: `端口无效：${portRaw}。请使用 1–65535 之间的整数。` }
  }
  return { ok: true, host, port }
}

export function formatPortInUseMessage(host, port) {
  const url = `http://${host}:${port}/`
  return (
    `端口 ${port} 已被占用，启动已停止（不会自动改用其他端口）。` +
    `请关闭占用 ${url} 的程序后重试。` +
    '工作台的设置和历史按本机地址与端口保存，换端口或改用 localhost 会看起来像「记录消失」。'
  )
}

export function formatMissingNodeMessage() {
  return (
    `未找到 Node.js。请先从 https://nodejs.org 安装当前 Active LTS（现为 Node ${RECOMMENDED_NODE_MAJOR}），` +
    `或仍在维护的 Node 22 / 24 LTS，然后重新打开本脚本。不要使用本机其他项目里的专用 Node 路径。`
  )
}

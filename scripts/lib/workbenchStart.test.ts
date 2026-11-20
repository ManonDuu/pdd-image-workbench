import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  formatPortInUseMessage,
  isSupportedNodeVersion,
  parseNodeVersion,
  resolveListenAddress,
} from './workbenchStart.mjs'

describe('workbenchStart Node 版本检查', () => {
  it('接受仍在维护的 22 / 24 LTS 与当前 Active LTS 26', () => {
    expect(isSupportedNodeVersion('v22.12.0').ok).toBe(true)
    expect(isSupportedNodeVersion('22.13.1').ok).toBe(true)
    expect(isSupportedNodeVersion('v24.22.1').ok).toBe(true)
    expect(isSupportedNodeVersion('v26.13.1').ok).toBe(true)
  })

  it('拒绝已结束维护或非 LTS 版本，以及过低的 22', () => {
    expect(isSupportedNodeVersion('v20.20.2').ok).toBe(false)
    expect(isSupportedNodeVersion('v21.7.3').ok).toBe(false)
    expect(isSupportedNodeVersion('v22.11.0').ok).toBe(false)
    expect(isSupportedNodeVersion('v25.9.0').ok).toBe(false)
    expect(isSupportedNodeVersion('v27.0.0').ok).toBe(false)
    expect(isSupportedNodeVersion('not-a-version').ok).toBe(false)
  })

  it('解析版本号', () => {
    expect(parseNodeVersion('v26.13.1')).toEqual({ major: 26, minor: 13, patch: 1 })
  })
})

describe('workbenchStart 监听地址', () => {
  it('默认绑定 127.0.0.1:5173', () => {
    expect(resolveListenAddress({})).toEqual({ ok: true, host: DEFAULT_HOST, port: DEFAULT_PORT })
    expect(DEFAULT_HOST).toBe('127.0.0.1')
    expect(DEFAULT_PORT).toBe(5173)
  })

  it('允许用环境变量覆盖端口（用于隔离测试），拒绝无效端口', () => {
    expect(resolveListenAddress({ HOST: '127.0.0.1', PORT: '5188' })).toEqual({
      ok: true,
      host: '127.0.0.1',
      port: 5188,
    })
    expect(resolveListenAddress({ PORT: 'abc' }).ok).toBe(false)
  })

  it('端口占用提示不会建议自动换端口', () => {
    const message = formatPortInUseMessage('127.0.0.1', 5173)
    expect(message).toContain('5173')
    expect(message).toContain('http://127.0.0.1:5173/')
    expect(message).toContain('不会自动改用其他端口')
  })
})

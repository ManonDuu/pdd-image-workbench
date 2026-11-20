#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatMissingNodeMessage,
  formatPortInUseMessage,
  isSupportedNodeVersion,
  resolveListenAddress,
} from './lib/workbenchStart.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

const nodeCheck = isSupportedNodeVersion(process.versions.node)
if (!nodeCheck.ok) fail(nodeCheck.message)

const listen = resolveListenAddress(process.env)
if (!listen.ok) fail(listen.message)

if (!existsSync(path.join(root, 'package-lock.json'))) {
  fail('缺少 package-lock.json，无法进行可复现安装。请使用发布包中的完整源码。')
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${npmCmd} ${args.join(' ')} 失败（退出码 ${code}）。`))
    })
  })
}

function assertPortFree(host, port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        reject(new Error(formatPortInUseMessage(host, port)))
        return
      }
      reject(error)
    })
    server.listen(port, host, () => {
      server.close((closeError) => {
        if (closeError) reject(closeError)
        else resolve()
      })
    })
  })
}

try {
  if (!existsSync(path.join(root, 'node_modules'))) {
    console.log('未检测到 node_modules，正在执行 npm ci 安装依赖…')
    await runNpm(['ci'])
  }
  await assertPortFree(listen.host, listen.port)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

console.log(`工作台地址: http://${listen.host}:${listen.port}/`)
console.log('请先在本机安装并启动 Cockpit Tools，在工作台「设置」中填写本机 Base URL 和 API Key。')
console.log('密钥只保存在本机浏览器，不会随 GitHub 源码同步。')

const child = spawn(
  npmCmd,
  ['run', 'dev', '--', '--host', listen.host, '--port', String(listen.port), '--strictPort'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, HOST: listen.host, PORT: String(listen.port) },
  },
)
child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
child.on('error', (error) => {
  fail(error.message)
})

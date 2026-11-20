#!/usr/bin/env bash
# macOS 终端启动入口。从 PATH 查找 Node，不使用任何机器专用便携路径。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先从 https://nodejs.org 安装当前 Active LTS（现为 Node 26），或仍在维护的 Node 22 / 24 LTS。"
  exit 1
fi

exec node "$ROOT/scripts/start-workbench.mjs"

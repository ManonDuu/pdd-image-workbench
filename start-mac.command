#!/bin/bash
# 可在 Finder 中双击启动。若失败会停留在终端窗口，方便查看原因。
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先从 https://nodejs.org 安装当前 Active LTS（现为 Node 26），或仍在维护的 Node 22 / 24 LTS。"
  echo
  read -r -p "按回车键关闭窗口…"
  exit 1
fi

node "./scripts/start-workbench.mjs"
status=$?
if [ "$status" -ne 0 ]; then
  echo
  echo "启动失败（退出码 $status）。"
  read -r -p "按回车键关闭窗口…"
fi
exit "$status"

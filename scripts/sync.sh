#!/usr/bin/env bash
# 把插件文件同步到本机所有已安装该插件的 dsh profile node_modules 拷贝。
set -euo pipefail
cd "$(dirname "$0")/.."

SYNCED=0
for d in "$HOME/.dsh/profiles"/*/node_modules/dsh-balance; do
  [ -d "$d" ] || continue
  cp index.js client.js package.json "$d/"
  echo "已同步: $d"
  SYNCED=1
done

if [ "$SYNCED" = 0 ]; then
  echo "警告: 未找到已安装的 profile 拷贝（~/.dsh/profiles/*/node_modules/dsh-balance）"
  exit 1
fi

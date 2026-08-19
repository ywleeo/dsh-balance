#!/usr/bin/env bash
# dsh-balance 一键发布：升版本 → 同步本机 → commit + tag + push。
# 用法: ./scripts/release.sh [patch|minor|major]
set -euo pipefail
cd "$(dirname "$0")/.."

PART="${1:-patch}"
case "$PART" in
  patch|minor|major) ;;
  *) echo "用法: ./scripts/release.sh [patch|minor|major]" >&2; exit 2 ;;
esac

VER=$(node -e "
const p = require('./package.json');
const [a, b, c] = p.version.split('.').map(Number);
const m = { patch: [a, b, c + 1], minor: [a, b + 1, 0], major: [a + 1, 0, 0] };
console.log(m['$PART'].join('.'));
")
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = '$VER';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
echo "版本: $VER"

bash scripts/sync.sh || true

git add -A
if ! git diff --cached --quiet; then
  git commit -m "release v$VER"
else
  echo "无代码改动，仅打标签"
fi
if git rev-parse "v$VER" >/dev/null 2>&1; then
  echo "tag v$VER 已存在，跳过"
else
  git tag "v$VER"
fi
git push origin main
git push origin "v$VER" || true
echo "✅ 已发布 v$VER"

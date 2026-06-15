#!/usr/bin/env bash
# リリース用アーカイブ生成スクリプト
#
# ビルド済み dist/ + package.json + README.md を tabby-save-output/ に固め、
# release/tabby-save-output-<version>.zip を生成する。
#
# 利用者はこの zip を Tabby の plugins/node_modules/ に解凍するだけで動作する
# （node_modules は不要。外部依存は webpack で dist にバンドル済み、
#  @angular / tabby-* / ngx-toastr 等は Tabby 本体が供給）。
set -euo pipefail
cd "$(dirname "$0")"

NAME="tabby-save-output"
VERSION="$(node -p "require('./package.json').version")"
STAGE="release/${NAME}"
ZIP="${NAME}-${VERSION}.zip"

# 1. 依存（無ければ入れる）+ ビルドで dist/ を最新化
if [ ! -d node_modules ]; then
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --legacy-peer-deps
fi
npm run build

# 2. ステージング（解凍先フォルダ名は必ず tabby-save-output）
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R dist "$STAGE/"
cp package.json README.md "$STAGE/"

# 3. zip 生成（アーカイブ内のトップは tabby-save-output/）
rm -f "release/${ZIP}"
( cd release && zip -r -q "${ZIP}" "${NAME}" )

echo "✅ release/${ZIP} を生成しました"
echo "   利用者は plugins/node_modules/ に解凍 → Tabby 再起動で動作します"

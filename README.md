# Save Output

#### For the Tabby terminal

This plugin lets you stream console output into a file.

![](https://github.com/Eugeny/tabby-save-output/raw/master/screenshot.png)

Start recording your console output by right clicking and pressing "Save output to file..."

---

## このフォークについて

[Eugeny/tabby-save-output](https://github.com/Eugeny/tabby-save-output) からのフォークで、以下の機能追加・改善を行っています。

### 主な変更点

- **モダンスタック対応**: Angular 7 → 15、ビルドチェーンを `ts-loader` / Dart Sass / webpack 5.90 系に更新。Tabby v1.0.231-nightly 以降で動作。
- **ファイル名のローカルタイム化**: 出力ファイル名のタイムスタンプを UTC（ISO 8601）から OS のローカルタイムに変更。`:` は `-` に置換し、Windows でもそのまま使えます（例: `2026-04-28T15-30-45.123 - <タブタイトル>.txt`）。
- **行ごとのタイムスタンプ**: 各行頭に `[YYYY-MM-DD HH:MM:SS]` を付与。設定でオン/オフ切替可能。
- **フルスクリーンアプリ対応**: `vim`、`top`、`less`、`htop` などの alternate screen buffer を自動検出。`@xterm/headless` でレンダリングし、終了時の最終画面をプレーンテキストとしてログに記録します。
- **ターミナルリサイズ追従**: alt-screen 中にウィンドウサイズを変更しても、最終画面が現在のサイズで正しく折り返されます。
- **キャリッジリターン処理**: AWS CLI のページャー（`less -FRX`）や進捗バーなど、`\r` でカーソルを戻して上書きするコマンドの出力を、最終状態だけログに残るように整形します。

### ログ例

通常コマンド:
```
[2026-05-09 04:50:47] $ aws guardduty list-detectors --region ap-northeast-1
[2026-05-09 04:50:48] {
[2026-05-09 04:50:48]     "DetectorIds": [
[2026-05-09 04:50:48]         "EXAMPLE_DETECTOR_ID_PLACEHOLDER"
[2026-05-09 04:50:48]     ]
[2026-05-09 04:50:48] }
```

フルスクリーンアプリ（vim 終了時）:
```
[2026-05-09 03:30:20] $ vim memo.txt
[2026-05-09 03:30:20] -- entering interactive mode --
[2026-05-09 03:30:45] -- final screen --
こんにちは
これは vim で書いたテキスト
~
~
"memo.txt" 2L, 35B written                      1,1           All
[2026-05-09 03:30:45] -- exiting interactive mode --
```

### 設定

Settings → **Save Output** タブ:
- **Automatically save output for new tabs**: 自動保存の有効化（On / SSH only / Off）
- **Directory**: 保存先ディレクトリ
- **Prefix each line with a local timestamp**: 行頭タイムスタンプの ON/OFF（フルスクリーンアプリの自動検出も連動）

### ビルド

依存関係に古いネイティブモジュール（macOS arm64 で動作しない Electron 等）が含まれるため、以下のフラグが必要です。

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --legacy-peer-deps
npm run build
```

### ローカル開発でのインストール

ビルド済みのこのリポジトリを Tabby のプラグインディレクトリにシンボリックリンクします。

**macOS:**
```bash
mkdir -p ~/Library/Application\ Support/tabby/plugins/node_modules
ln -s "$(pwd)" ~/Library/Application\ Support/tabby/plugins/node_modules/tabby-save-output
```

**Linux:** `~/.config/tabby/plugins/node_modules/`
**Windows:** `%APPDATA%\tabby\plugins\node_modules\`

リンク後に Tabby を完全終了 → 再起動してください。`npm run watch` で webpack を常駐させると、変更のたびに Tabby を再起動するだけで反映されます。

### 既知の制限

- alt-screen に入るエスケープシーケンス（8 バイト）がチャンク境界で分割された場合、検出を取りこぼす可能性があります。実用上はほぼ問題になりません。
- フルスクリーンアプリの編集途中の状態は記録されません（最終画面のみ）。

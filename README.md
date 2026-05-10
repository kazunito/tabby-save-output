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
[2026-05-09 04:50:47] $ ls -la /tmp/example
[2026-05-09 04:50:48] total 8
[2026-05-09 04:50:48] drwxr-xr-x   3 user  staff   96 May  9 04:50 .
[2026-05-09 04:50:48] drwxrwxrwt  10 root  staff  320 May  9 04:50 ..
[2026-05-09 04:50:48] -rw-r--r--   1 user  staff   42 May  9 04:50 readme.txt
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

---

## インストール手順

このフォークは npm では公開していないため、**ソースを取得 → ビルド → Tabby のプラグインフォルダに配置** という流れになります。

### 前提

以下が必要です（macOS なら Homebrew で入ります）。

| ツール | 確認コマンド | 入っていない場合 |
|---|---|---|
| Node.js（v18 以上推奨） | `node -v` | `brew install node` |
| npm | `npm -v` | Node.js に同梱 |
| git | `git --version` | `brew install git` または Xcode Command Line Tools |

### 手順

**1. ソースを取得**

GitHub Release からソース zip をダウンロード → 解凍するか、git clone します。

```bash
git clone https://github.com/kazunito/tabby-save-output.git
cd tabby-save-output
```

または [Releases ページ](https://github.com/kazunito/tabby-save-output/releases) から `Source code (zip)` をダウンロードして解凍 → そのフォルダに `cd` してください。

**2. 依存パッケージをインストール**

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --legacy-peer-deps
```

各オプションの意味:
- `ELECTRON_SKIP_BINARY_DOWNLOAD=1`: ビルドには Electron 本体は不要なので、ダウンロードをスキップしてインストール時間を短縮します。
- `--legacy-peer-deps`: 古い peer dependency 同士の競合（Tabby 本体由来）を許容するために必要です。

完了まで数十秒〜数分かかります。

**3. プラグインをビルド**

```bash
npm run build
```

`dist/index.js` が生成されれば成功です。

```bash
ls dist/index.js   # ファイルが見えれば OK
```

**4. Tabby のプラグインフォルダに配置**

Tabby は OS ごとに決まったフォルダ配下の `node_modules/tabby-*` を読み込みます。プロジェクトディレクトリ全体をシンボリックリンクで配置します。

**macOS:**
```bash
mkdir -p ~/Library/Application\ Support/tabby/plugins/node_modules
ln -s "$(pwd)" ~/Library/Application\ Support/tabby/plugins/node_modules/tabby-save-output
```

**Linux:**
```bash
mkdir -p ~/.config/tabby/plugins/node_modules
ln -s "$(pwd)" ~/.config/tabby/plugins/node_modules/tabby-save-output
```

**Windows (PowerShell、管理者権限が必要):**
```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\tabby\plugins\node_modules"
New-Item -ItemType SymbolicLink -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-save-output" -Target (Get-Location)
```

**5. 配置の確認**

正しい構造は以下の通りです。`package.json` と `dist/index.js` の **両方** がプラグインフォルダから見えている必要があります。

```
~/Library/Application Support/tabby/plugins/node_modules/tabby-save-output/   ← シンボリックリンク
├── package.json    ← Tabby はこれを読んで dist/index.js を探す
├── dist/
│   └── index.js    ← 実体
└── （その他のソース、node_modules など）
```

確認:
```bash
ls -la ~/Library/Application\ Support/tabby/plugins/node_modules/tabby-save-output/package.json
ls -la ~/Library/Application\ Support/tabby/plugins/node_modules/tabby-save-output/dist/index.js
```

両方とも存在すれば OK です。

**6. Tabby を完全終了 → 再起動**

メニューから **Tabby → Quit Tabby**（macOS は `⌘Q`）で完全に終了し、もう一度起動します。

**7. 動作確認**

Settings を開き、左サイドバーに **Save Output** タブが現れていれば成功です。`Automatically save output for new tabs` を `On` に設定 → 保存先を指定 → 新しいタブを開いて何かコマンドを実行 → 指定したディレクトリにログファイルが作られます。

---

## 警告について

`npm install` および `npm run build` の実行中にいくつかの警告が表示されますが、**すべて想定内** です。プラグインの動作には影響しないので無視して構いません。

| 警告 | 出るタイミング | 性質 |
|---|---|---|
| `npm warn deprecated boolean@3.2.0` ほか | `npm install` | 推移的依存（孫依存）が非推奨化されているだけ。動作には無関係 |
| `N vulnerabilities (... high ...)` | `npm install` | 古い依存に既知の脆弱性。デスクトップ用プラグインのため実害はほぼなし |
| `Deprecation The legacy JS API is deprecated...` | `npm run build` | Sass の旧 API を使っている旨。ビルドは成功する |

これらは **Tabby 本体が古めの Angular に依存していること** が根本原因で、プラグイン側だけでは解消できません。

---

## トラブルシューティング

### Settings に "Save Output" タブが現れない

最も多い原因は **プラグインフォルダの構造が違う** ことです。以下を確認してください。

```bash
ls ~/Library/Application\ Support/tabby/plugins/node_modules/tabby-save-output/
```

ここに `package.json` と `dist` フォルダの両方が見える必要があります。`index.js` などのファイルが直下にある場合、`dist/` の中身だけがコピーされている誤った状態です。インストール手順 4 をやり直してください。

### Tabby が起動しない / 起動時にエラー

ターミナルから Tabby を起動するとエラー内容が見えます。

```bash
/Applications/Tabby.app/Contents/MacOS/Tabby 2>&1 | head -100
```

よくあるエラー:

| エラー文 | 原因と対処 |
|---|---|
| `... does not have a module def (ɵmod property)` | Tabby 本体の Angular バージョンと不一致。お使いの Tabby が古すぎる可能性があります。v1.0.231-nightly 以降にアップデートしてください |
| `Cannot find module 'tabby-core'` 等 | プラグインフォルダの構造が違う。トラブルシューティング上記を確認 |

### ログファイルが作られない

- Settings → Save Output → `Automatically save output for new tabs` が `Off` になっていないか確認
- 設定後に **新しく開いたタブ** で動作します。設定変更前から開いていたタブには反映されません

### 進捗バーや AWS CLI のページャー出力が崩れる

v4.0.0 で対応済みです。古いバージョンを使っている場合は最新版を取得してください。

---

## 開発者向け（コードを変更する場合）

`npm run watch` で webpack を常駐させると、ソースを変更するたびに自動でリビルドされます。**反映には Tabby の再起動が必要です**（ホットリロードはありません）。

```bash
npm run watch
```

---

## 既知の制限

- alt-screen に入るエスケープシーケンス（8 バイト）がチャンク境界で分割された場合、検出を取りこぼす可能性があります。実用上はほぼ問題になりません。
- フルスクリーンアプリの編集途中の状態は記録されません（最終画面のみ）。

# Clinder

![Logo](./src-tauri/gen/windows/Assets/Wide310x150Logo.png)

> A blazing-fast, lightweight, keyboard-centric clipboard manager.

Clinder is a lightweight, always-running clipboard history manager designed for fast, keyboard-only use.
Open it with the global shortcut `Alt + V` and use incremental fuzzy search to find, copy, and paste past clipboard entries.

---

## Usage

### 1. Launching and basic controls

- **`Alt + V`** : Show / hide the window
- **`Esc`** or **click outside the window** : Hide

### 2. Searching and pasting

1. Open with the shortcut
2. Type keywords (fuzzy search)
3. Use **`↑` / `↓`** to select ➔ **`Enter`** to auto-paste (**`Ctrl + Enter`** to copy the selected entry back to the clipboard)

## Inspired

- [CLCL](https://nakka.com/soft/clcl/)
- [fzf](https://github.com/junegunn/fzf)

## Alternatives

- [Clipboard+](https://www.flowlauncher.com/plugins/clipboard-plus/) (Flow Launcher plugin)

---

## TODO

- Improve UI
  - 全体的にとりあえず置いた感からの脱却を図る
  - 全件削除は設定に置く
  - ダークモード切替はスイッチ
  - ページのボタンのところ
  - ボタンが見づらい
  - history size のフィードバック（ボタンいらないか？）
- 機能
  - エクセルがテキストと画像どちらもコピーされるので、一つにまとめて画像・テキスト選択できるようにする
  - キーバインドの重複チェック
  - Ctrl+P(印刷)の無効化
  - フォルダ・ファイルのコピー
- コピーするときに最後の空行を削除する設定
- 画像コピー
  - OCRで文字抽出してテキスト検索可能にする
- Mac version
- Improve and expand this README

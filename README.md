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
  - フォントのテキスト検索対応（セレクトやめる）
  - フォント選択するときに若干固まるのか反応しないのか現象が起きる
- コピーするときに最後の空行を削除する設定
- 画像コピー
  - OCRで文字抽出してテキスト検索可能にする
  - Ctrl + i で画像のみ検索のトグル（設定可）
- ブックマーク機能
  - Ctrl + B でブックマークのみ検索のトグルやブックマークのトグル（設定可）
- Mac version
- Improve and expand this README

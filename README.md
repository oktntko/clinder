# Clinder 📋⚡

![Logo](./doc/image/readme_header.png)

> A blazing-fast, lightweight, keyboard-centric clipboard manager built with **Tauri v2**, **Rust**, and **React**.

`Clinder` は、キーボード操作だけでストレスなく使える爆速な常駐型クリップボード履歴マネージャーです。
`Alt + V` (macOS: `Cmd + V`) のグローバルショートカットで一瞬で起動し、インクリメンタルなあいまい検索（Fuzzy Search）で必要な履歴を即座にコピー＆貼り付けできます。

---

## 📖 Usage

### 1. 起動と基本操作

- **`Alt + V`** (macOS: **`Cmd + V`**): 画面の呼び出し / 非表示
- **`Esc`** または **画面外クリック**: 非表示

### 2. 検索と貼り付け

1. ショートカットキーで呼び出し
2. キーワードを入力（あいまい検索）
3. **`↑` / `↓`** で選択 ➔ **`Enter`** で自動貼り付け

## Inspired

- [CLCL](https://nakka.com/soft/clcl/)
- [Clipboard+](https://www.flowlauncher.com/plugins/clipboard-plus/) (Flow Launcher Plugins)

## TODO

- Fuzzy-Search の ON/OFF
- 単語検索 の ON/OFF
- 大文字小文字区別 の ON/OFF
- (設定) 起動ショートカットキーの設定変更
- (設定) 各種キーバインド
- フォント選定
- 画像のクリップボード履歴の管理
- README補強
- スタートアップ時に自動起動
- DBからの検索

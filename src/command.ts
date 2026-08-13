import { invoke } from '@tauri-apps/api/core';

//////////////////// ////////////////////
// DB 関連
//////////////////// ////////////////////
export type ContentType = 'text' | 'image';

export type Clip = {
  readonly id: number;
  readonly content_type: ContentType;
  readonly content: string;
  readonly updated_at: string;
};

export type Searched = {
  readonly clip: Clip;
  readonly snippet: string;
  readonly score: number;
  readonly indices: number[];
  readonly trimmed_begin: boolean;
  readonly trimmed_end: boolean;
};

async function search_clipboard(query: string, searchMode: 'fuzzy' | 'substring') {
  return invoke<Searched[]>('search_clipboard', { query, searchMode });
}

async function delete_clip(id: number) {
  return invoke('delete_clip', { id });
}

async function clear_clipboard() {
  return invoke('clear_clipboard');
}

//////////////////// ////////////////////
// クリップボード関連
//////////////////// ////////////////////
async function send_clipboard(content: string) {
  try {
    await invoke('send_clipboard', { content });
  } catch (err) {
    console.error('Failed to paste content:', err);
  }
}

async function send_and_paste(content: string) {
  try {
    await invoke('send_and_paste', { content });
  } catch (err) {
    console.error('Failed to paste content:', err);
  }
}

//////////////////// ////////////////////
// グローバルショートカット関連
//////////////////// ////////////////////
async function update_window_toggle_shortcut(newShortcutStr: string) {
  try {
    await invoke('update_window_toggle_shortcut', { newShortcutStr });
  } catch (err) {
    console.error('Failed to update window toggle shortcut:', err);
  }
}

//////////////////// ////////////////////
// その他
//////////////////// ////////////////////
async function list_system_font(): Promise<string[]> {
  return invoke('list_system_font');
}

export default {
  search_clipboard,
  delete_clip,
  clear_clipboard,
  send_clipboard,
  send_and_paste,
  update_window_toggle_shortcut,
  list_system_font,
};

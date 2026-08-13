import { invoke } from '@tauri-apps/api/core';

//////////////////// ////////////////////
// DB 関連
//////////////////// ////////////////////
export type SearchMode = 'fuzzy' | 'substring';
export type ContentType = 'text' | 'image';

export type Clip = {
  readonly id: number;
  readonly content_type: ContentType;
  readonly content: string;
  readonly description: string;
  readonly bookmark: boolean;
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

async function search_clipboard({
  query,
  search_mode: searchMode,
  content_type: contentType,
  bookmark,
}: {
  query: string;
  search_mode: SearchMode;
  content_type: ContentType[];
  bookmark: boolean[];
}) {
  return invoke<Searched[]>('search_clipboard', {
    query,
    searchMode,
    contentType,
    bookmark,
  });
}

async function delete_clip({ id, content, content_type: contentType }: Clip) {
  return invoke('delete_clip', { id, content, contentType });
}

async function clear_clipboard() {
  return invoke('clear_clipboard');
}

//////////////////// ////////////////////
// クリップボード関連
//////////////////// ////////////////////
async function send_clipboard({ content, content_type: contentType }: Clip) {
  try {
    await invoke('send_clipboard', { content, contentType });
  } catch (err) {
    console.error('Failed to paste content:', err);
  }
}

async function send_and_paste({ content, content_type: contentType }: Clip) {
  try {
    await invoke('send_and_paste', { content, contentType });
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

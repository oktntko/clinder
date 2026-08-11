import { invoke } from '@tauri-apps/api/core';

export type SearchResult = {
  readonly id: number;
  readonly content: string;
  readonly snippet: string;
  readonly score: number;
  readonly indices: number[];
  readonly trimmed_begin: boolean;
  readonly trimmed_end: boolean;
};

async function search_history(query: string, searchMode: 'fuzzy' | 'substring') {
  return invoke<SearchResult[]>('search_history', { query, searchMode });
}

async function clear_all_history() {
  return invoke('clear_all_history');
}

async function delete_history_item(id: number) {
  return invoke('delete_history_item', { id });
}

async function select(content: string) {
  try {
    await invoke('select', { content });
  } catch (err) {
    console.error('Failed to paste content:', err);
  }
}

async function select_and_paste(content: string) {
  try {
    await invoke('select_and_paste', { content });
  } catch (err) {
    console.error('Failed to paste content:', err);
  }
}

async function update_window_toggle_shortcut(newShortcutStr: string) {
  try {
    await invoke('update_window_toggle_shortcut', { newShortcutStr });
  } catch (err) {
    console.error('Failed to update window toggle shortcut:', err);
  }
}

async function list_system_font(): Promise<string[]> {
  return invoke('list_system_font');
}

export default {
  search_history,
  clear_all_history,
  delete_history_item,
  select,
  select_and_paste,
  update_window_toggle_shortcut,
  list_system_font,
};

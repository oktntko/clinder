import { invoke } from '@tauri-apps/api/core';

export type SearchResult = {
  id: number;
  content: string;
  snippet: string;
  score: number;
  indices: number[];
};

async function search_history(query: string) {
  return invoke<SearchResult[]>('search_history', { query });
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

export default {
  search_history,
  clear_all_history,
  delete_history_item,
  select,
  select_and_paste,
  update_window_toggle_shortcut,
};

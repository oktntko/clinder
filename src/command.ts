import { invoke } from '@tauri-apps/api/core';

import type { Shortcut } from '~/plugin/storeContext';

//////////////////// ////////////////////
// DB 関連
//////////////////// ////////////////////
export type SearchMode = 'fuzzy' | 'substring';
export type ContentType = 'text' | 'image' | 'files';

export type Clip = {
  readonly id: number;
  readonly content_type: ContentType;
  readonly plain_text: string;
  readonly image_hash: string;
  readonly files: string[];
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
  search_mode,
  content_type,
  bookmark,
}: {
  query: string;
  search_mode: SearchMode;
  content_type: ContentType[];
  bookmark: boolean[];
}) {
  return invoke<Searched[]>('search_clipboard', {
    query,
    search_mode,
    content_type,
    bookmark,
  });
}

async function delete_clip({ id, image_hash }: Clip) {
  return invoke('delete_clip', { id, image_hash });
}

async function clear_clipboard() {
  return invoke('clear_clipboard');
}

async function update_clip_bookmark({ id, bookmark }: Clip) {
  return invoke('update_clip_bookmark', { id, bookmark });
}

//////////////////// ////////////////////
// クリップボード関連
//////////////////// ////////////////////
async function send_text({ plain_text }: Clip) {
  try {
    await invoke('send_text', { plain_text });
  } catch (err) {
    console.error('Failed to send_text:', err);
  }
}

async function paste_text({ plain_text }: Clip) {
  try {
    await invoke('paste_text', { plain_text });
  } catch (err) {
    console.error('Failed to paste_text:', err);
  }
}

async function send_image({ image_hash }: Clip) {
  try {
    await invoke('send_image', { image_hash });
  } catch (err) {
    console.error('Failed to send_image:', err);
  }
}

async function paste_image({ image_hash }: Clip) {
  try {
    await invoke('paste_image', { image_hash });
  } catch (err) {
    console.error('Failed to paste_image:', err);
  }
}

async function send_files({ files }: Clip) {
  try {
    await invoke('send_files', { files });
  } catch (err) {
    console.error('Failed to send_files:', err);
  }
}

async function paste_files({ files }: Clip) {
  try {
    await invoke('paste_files', { files });
  } catch (err) {
    console.error('Failed to paste_files:', err);
  }
}
//////////////////// ////////////////////
// グローバルショートカット関連
//////////////////// ////////////////////
async function update_global_shortcut_toggle_window(new_shortcut_web_view: Shortcut) {
  return invoke('update_global_shortcut_toggle_window', { new_shortcut_web_view });
}

async function open_window() {
  return invoke('open_window');
}

async function hide_window() {
  return invoke('hide_window');
}

//////////////////// ////////////////////
// その他
//////////////////// ////////////////////
async function restart_app(): Promise<void> {
  return invoke('restart_app');
}

async function list_system_font(): Promise<string[]> {
  return invoke('list_system_font');
}

// MSIXパッケージの場合、WindowsのOSレベルでパスが仮想化されるため、
// 実際に使用されるフォルダは app_handle.path().app_local_data_dir() で取れない
// %LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Local\<%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Local\oktntko.clinder>
async function get_real_app_local_data_dir(): Promise<string> {
  return invoke('get_real_app_local_data_dir');
}

// %LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\<%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Local\oktntko.clinder>
async function get_real_app_data_dir(): Promise<string> {
  return invoke('get_real_app_data_dir');
}

async function get_ocr_language(): Promise<string> {
  return invoke('get_ocr_language');
}

export const command = {
  search_clipboard,
  delete_clip,
  clear_clipboard,
  update_clip_bookmark,
  send_text,
  paste_text,
  send_image,
  paste_image,
  send_files,
  paste_files,
  update_global_shortcut_toggle_window,
  open_window,
  hide_window,
  restart_app,
  list_system_font,
  get_real_app_local_data_dir,
  get_real_app_data_dir,
  get_ocr_language,
};

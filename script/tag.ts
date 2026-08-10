import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 引数または環境変数からバージョンを取得（先頭の "v" を除去）
const rawVersion = process.argv[2] || process.env.npm_package_version;
if (!rawVersion) {
  console.error('no arguments.');
  process.exit(1);
}
const version = rawVersion.replace(/^v/, '');

// 1. package.json の更新
const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. src-tauri/tauri.conf.json の更新
const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
}

// 3. src-tauri/Cargo.toml の更新
const cargoPath = path.resolve('src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargoContent = fs.readFileSync(cargoPath, 'utf8');
  // [package] セクション直下の version = "x.x.x" を置換
  cargoContent = cargoContent.replace(
    /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m,
    `$1${version}$3`,
  );
  fs.writeFileSync(cargoPath, cargoContent);
}

execSync(`git tag ${rawVersion}`);

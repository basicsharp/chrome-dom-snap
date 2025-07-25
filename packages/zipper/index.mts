import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { zipBundle } from './lib/index.js';
import { IS_FIREFOX } from '@extension/env';

const pkgPath = resolve(import.meta.dirname, '..', '..', '..', 'package.json');
const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkgJson.version;

// const YYYY_MM_DD = new Date().toISOString().slice(0, 10).replace(/-/g, '');
// const HH_mm_ss = new Date().toISOString().slice(11, 19).replace(/:/g, '');

const fileName = `chrome-dom-snap-v${version}`;
// const fileName = `extension-${YYYY_MM_DD}-${HH_mm_ss}`;

await zipBundle({
  distDirectory: resolve(import.meta.dirname, '..', '..', '..', 'dist'),
  buildDirectory: resolve(import.meta.dirname, '..', '..', '..', 'dist-zip'),
  archiveName: IS_FIREFOX ? `${fileName}.xpi` : `${fileName}.zip`,
});

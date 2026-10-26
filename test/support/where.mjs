// Where things are, so no test writes a path of its own.
//
// THINGS_FOLDER: the shelf's own files, which a test serves as a site of its own (the shelf at "/").
// PLATFORM_FOLDER: a local copy of the platform (the shared code and the test machinery). It is the
// folder named by the PLATFORM_FOLDER environment variable if that is set, and otherwise the folder
// called "platform" beside this one. Pages load the platform from the web; tests need it on disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const THINGS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PLATFORM_FOLDER = process.env.PLATFORM_FOLDER
  ? path.resolve(process.env.PLATFORM_FOLDER)
  : path.resolve(THINGS_FOLDER, '..', 'platform');

if (!fs.existsSync(path.join(PLATFORM_FOLDER, 'test', 'harness.mjs'))) {
  throw new Error(
    'These tests borrow the platform\'s test machinery, and it is not at ' + PLATFORM_FOLDER + '.\n' +
    'Put a copy of the platform beside this folder, or set PLATFORM_FOLDER to where it is.');
}

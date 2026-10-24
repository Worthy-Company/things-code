// Where the shelf's own files are, so a test can serve them as a site of their own (the shelf at "/").
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const THINGS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

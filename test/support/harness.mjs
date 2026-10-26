// The platform's test machinery, found through where.mjs. Tests import startTest from here, so the place
// the platform lives is written down once.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLATFORM_FOLDER } from './where.mjs';

export const { startTest } = await import(pathToFileURL(path.join(PLATFORM_FOLDER, 'test', 'harness.mjs')).href);

import * as fs from 'fs';
import * as path from 'path';

// After compilation: __dirname is dist/; go up to public_nodejs/
const PUBLIC_NODEJS_DIR = path.join(__dirname, '..');

/**
 * Find the project root by walking up from public_nodejs/ until we find 'users.json'.
 */
function findProjectRoot(): string {
  let current = PUBLIC_NODEJS_DIR;
  const maxDepth = 10;
  let depth = 0;
  while (depth < maxDepth) {
    const candidate = path.join(current, 'users.json');
    if (fs.existsSync(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    depth++;
  }
  return path.dirname(PUBLIC_NODEJS_DIR);
}

const PROJECT_ROOT = findProjectRoot();

// Resolve the real path of ROOT_DIR to prevent symlink escapes at the root level
const ROOT_DIR = process.env.WEBDAV_ROOT || path.join(PROJECT_ROOT, 'data');
// Ensure the directory exists before calling realpathSync (fails with ENOENT otherwise)
if (!fs.existsSync(ROOT_DIR)) {
  fs.mkdirSync(ROOT_DIR, { recursive: true });
}
export const RESOLVED_ROOT_DIR = fs.realpathSync(ROOT_DIR);

/**
 * Get the per-user root directory for a given username.
 */
export function getUserRoot(username: string): string {
  const userDir = path.join(RESOLVED_ROOT_DIR, username);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return fs.realpathSync(userDir);
}

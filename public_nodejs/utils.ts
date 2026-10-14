import http = require('http');
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// After compilation: __dirname is dist/; go up to public_nodejs/
const PUBLIC_NODEJS_DIR = path.join(__dirname, '..');

/**
 * Find the project root by walking up from public_nodejs/ until we find 'users.json'.
 * Handles different deployment structures:
 *   - Local dev: public_nodejs/../users.json  (project root = parent of public_nodejs)
 *   - Server: domains/drive.wosz.pl/public_nodejs/ -> users.json may be at drive.wosz.pl/ or higher
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
    if (parent === current) break; // reached filesystem root
    current = parent;
    depth++;
  }
  // Fallback: one level up from public_nodejs
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

const USERS_FILE = path.join(PROJECT_ROOT, 'users.json');

// Load users from file
export function loadUsers(): Array<{ user: string; salt: string; hash: string }> {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    console.error('Failed to load users file:', err.message);
    return [];
  }
}

// Verify basic auth credentials, returns username on success or null on failure
export function authenticate(req: http.IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }

  const encoded = authHeader.slice(6);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  const users = loadUsers();
  const user = users.find((u) => u.user === username);
  if (!user) {
    return null;
  }

  const hash = crypto
    .pbkdf2Sync(password, user.salt, 100000, 64, 'sha512')
    .toString('hex');
  if (hash === user.hash) {
    return username;
  }
  return null;
}

export function requireAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  const username = authenticate(req);
  if (!username) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="WebDAV Server"',
    });
    res.end('Unauthorized');
    return false;
  }
  (req as any).username = username;
  return true;
}

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

/**
 * Decode the URL pathname from req.url, handling percent-encoding.
 */
export function getPath(req: http.IncomingMessage): string {
  let rawPath = req.url || '/';

  const queryIndex = rawPath.indexOf('?');
  if (queryIndex !== -1) {
    rawPath = rawPath.slice(0, queryIndex);
  }

  const fragmentIndex = rawPath.indexOf('#');
  if (fragmentIndex !== -1) {
    rawPath = rawPath.slice(0, fragmentIndex);
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    pathname = rawPath;
  }

  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }

  return pathname;
}

/**
 * Validate that a decoded path does not escape the user's root directory.
 */
export function getFullPath(req: http.IncomingMessage): string | null {
  const decodedPath = getPath(req);
  const userRoot = getUserRoot((req as any).username);

  const rawSegments = decodedPath.split('/').filter((s: string) => s !== '' && s !== '.');
  let depth = 0;
  for (const seg of rawSegments) {
    if (seg === '..') {
      depth--;
      if (depth < 0) {
        return null;
      }
    } else {
      depth++;
    }
  }

  const normalized = path.normalize(decodedPath);
  if (!normalized.startsWith('/')) {
    return null;
  }

  const fullPath = path.join(userRoot, normalized);

  try {
    const resolved = fs.realpathSync(fullPath);
    if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
      return resolved;
    }
    return null;
  } catch (err) {
    let checkPath = fullPath;
    while (
      checkPath !== userRoot &&
      checkPath !== userRoot + path.sep &&
      checkPath !== '/'
    ) {
      try {
        const resolvedAncestor = fs.realpathSync(checkPath);
        if (
          resolvedAncestor === userRoot ||
          resolvedAncestor.startsWith(userRoot + path.sep)
        ) {
          return fullPath;
        }
        return null;
      } catch {
        checkPath = path.dirname(checkPath);
      }
    }
    return fullPath;
  }
}

/**
 * Validate a destination URL path (for COPY/MOVE).
 */
export function getDestinationPath(
  req: http.IncomingMessage,
  destination: string | undefined
): string | null {
  if (!destination) return null;

  let destPathname: string;
  try {
    if (destination.startsWith('http://') || destination.startsWith('https://')) {
      const parsed = new URL(destination);
      destPathname = decodeURIComponent(parsed.pathname);
    } else {
      destPathname = decodeURIComponent(destination);
    }
  } catch {
    return null;
  }

  const normalized = path.normalize(destPathname);
  if (!normalized.startsWith('/')) {
    return null;
  }

  const userRoot = getUserRoot((req as any).username);
  const fullPath = path.join(userRoot, normalized);

  try {
    const resolved = fs.realpathSync(fullPath);
    if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
      return resolved;
    }
    return null;
  } catch {
    const parent = path.dirname(fullPath);
    try {
      const resolvedParent = fs.realpathSync(parent);
      if (
        resolvedParent === userRoot ||
        resolvedParent.startsWith(userRoot + path.sep)
      ) {
        return fullPath;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Encode a path segment for use in a WebDAV D:href URI.
 */
export function encodeWebDavHref(decodedPath: string): string {
  const segments = decodedPath.replace(/^\//, '').split('/');
  const encoded = segments.map((seg) => encodeURIComponent(seg));
  return '/' + encoded.join('/');
}

export function getHeaders(method: string, hasRange?: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    DAV: '1',
    'Content-Type': 'text/html; charset=utf-8',
    Allow: 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH',
  };
  if (hasRange) {
    headers['Accept-Ranges'] = 'bytes';
  }
  return headers;
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'text/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Validate X-OC-Mtime header value.
 */
export function parseOcMtime(headerValue: string | undefined | null): Date | null {
  if (headerValue === undefined || headerValue === null) {
    return null;
  }

  const str = String(headerValue).trim();
  if (!str) {
    return null;
  }

  if (!/^-?\d+$/.test(str)) {
    return null;
  }

  const seconds = Number(str);

  if (!Number.isFinite(seconds)) {
    return null;
  }

  if (seconds < 946684800 || seconds > 4102444800) {
    return null;
  }

  return new Date(seconds * 1000);
}

export function computeSha1(fullPath: string): string {
  const fileContent = fs.readFileSync(fullPath);
  return crypto.createHash('sha1').update(fileContent).digest('hex');
}

export function buildPropStat(fullPath: string, href: string, isDir: boolean): string {
  const stats = fs.statSync(fullPath);
  let checksumProp = '';
  if (!isDir) {
    const sha1 = computeSha1(fullPath);
    checksumProp = `\n      <oc:checksums><oc:checksum>SHA1:${sha1}</oc:checksum></oc:checksums>`;
  }
  return `<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype>${isDir ? '<D:collection/>' : ''}</D:resourcetype>
      <D:getlastmodified>${stats.mtime.toUTCString()}</D:getlastmodified>
      <D:getcontentlength>${isDir ? 0 : stats.size}</D:getcontentlength>${checksumProp}
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}

export function copyDir(
  src: string,
  dest: string,
  callback: (err: Error | null) => void
): void {
  fs.mkdir(dest, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
    if (err) return callback(err);
    const entries = fs.readdirSync(src);
    let remaining = entries.length;
    if (remaining === 0) return callback(null);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      const isDir = fs.statSync(srcPath).isDirectory();
      if (isDir) {
        copyDir(srcPath, destPath, (err) => {
          if (err) return callback(err);
          if (--remaining === 0) callback(null);
        });
      } else {
        const rs = fs.createReadStream(srcPath);
        const ws = fs.createWriteStream(destPath);
        rs.pipe(ws);
        ws.on('finish', () => {
          if (--remaining === 0) callback(null);
        });
        ws.on('error', (err: NodeJS.ErrnoException) => callback(err));
      }
    }
  });
}

export function rmDir(
  dirPath: string,
  callback: (err: Error | null) => void
): void {
  const entries = fs.readdirSync(dirPath);
  let remaining = entries.length;
  if (remaining === 0) {
    fs.rmdir(dirPath, callback);
    return;
  }
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry);
    const isDir = fs.statSync(entryPath).isDirectory();
    if (isDir) {
      rmDir(entryPath, (err: Error | null) => {
        if (err) return callback(err);
        if (--remaining === 0) fs.rmdir(dirPath, callback);
      });
    } else {
      fs.unlink(entryPath, (err: NodeJS.ErrnoException | null) => {
        if (err) return callback(err);
        if (--remaining === 0) fs.rmdir(dirPath, callback);
      });
    }
  }
}

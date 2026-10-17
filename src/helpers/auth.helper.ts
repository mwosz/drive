import http = require('http');
import * as fs from 'fs';
import * as crypto from 'crypto';
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

const USERS_FILE = path.join(PROJECT_ROOT, 'users.json');

// Load users from file (async)
export function loadUsers(callback: (users: Array<{ user: string; salt: string; hash: string }>) => void): void {
  fs.readFile(USERS_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('Failed to load users file:', err.message);
      callback([]);
      return;
    }
    try {
      callback(JSON.parse(data));
    } catch (parseErr: any) {
      console.error('Failed to parse users file:', parseErr.message);
      callback([]);
    }
  });
}

// Verify basic auth credentials, returns username on success or null on failure (async)
export function authenticate(
  req: http.IncomingMessage,
  callback: (username: string | null) => void
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    callback(null);
    return;
  }

  const encoded = authHeader.slice(6);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    callback(null);
    return;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  loadUsers((users) => {
    const user = users.find((u) => u.user === username);
    if (!user) {
      callback(null);
      return;
    }

    crypto.pbkdf2(password, user.salt, 100000, 64, 'sha512', (err, key) => {
      if (err) {
        callback(null);
        return;
      }
      const hash = key.toString('hex');
      if (hash === user.hash) {
        callback(username);
      } else {
        callback(null);
      }
    });
  });
}

export function requireAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  callback: (username: string) => void
): void {
  authenticate(req, (username) => {
    if (!username) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="WebDAV Server"',
      });
      res.end('Unauthorized');
      return;
    }
    (req as any).username = username;
    callback(username);
  });
}

const http = require('http');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
// __dirname is public_nodejs; data and users.json are in the parent directory
const PARENT_DIR = path.join(__dirname, '..');
const ROOT_DIR = process.env.WEBDAV_ROOT || path.join(PARENT_DIR, 'data');
const USERS_FILE = path.join(PARENT_DIR, 'users.json');

// Resolve the real path of ROOT_DIR to prevent symlink escapes at the root level
const RESOLVED_ROOT_DIR = fs.realpathSync(ROOT_DIR);

// Load users from file
function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load users file:', err.message);
    return [];
  }
}

// Verify basic auth credentials, returns username on success or null on failure
function authenticate(req) {
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
  const user = users.find(u => u.user === username);
  if (!user) {
    return null;
  }

  const hash = crypto.pbkdf2Sync(password, user.salt, 100000, 64, 'sha512').toString('hex');
  if (hash === user.hash) {
    return username;
  }
  return null;
}

function requireAuth(req, res) {
  const username = authenticate(req);
  if (!username) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="WebDAV Server"'
    });
    res.end('Unauthorized');
    return false;
  }
  req.username = username;
  return true;
}

/**
 * Get the per-user root directory for a given username.
 * Maps 'notes' -> data/notes, 'drive' -> data/drive, etc.
 */
function getUserRoot(username) {
  const userDir = path.join(RESOLVED_ROOT_DIR, username);
  // Ensure the user directory exists
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return fs.realpathSync(userDir);
}

// Ensure root directory exists
if (!fs.existsSync(ROOT_DIR)) {
  fs.mkdirSync(ROOT_DIR, { recursive: true });
}

function getHeaders(method, range) {
  const headers = {
    'DAV': '1',
    'Content-Type': 'text/html; charset=utf-8',
    'Allow': 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH'
  };
  if (range) {
    headers['Accept-Ranges'] = 'bytes';
  }
  return headers;
}

/**
 * Decode the URL pathname from req.url, handling percent-encoding.
 * Returns the decoded path relative to the WebDAV root (always starts with /).
 * IMPORTANT: We must NOT use new URL() here because it normalizes paths
 * (e.g., '/..' becomes '/'), which would bypass path traversal checks.
 */
function getPath(req) {
  // Extract pathname manually without normalization
  let rawPath = req.url;

  // Remove query string
  const queryIndex = rawPath.indexOf('?');
  if (queryIndex !== -1) {
    rawPath = rawPath.slice(0, queryIndex);
  }

  // Remove fragment
  const fragmentIndex = rawPath.indexOf('#');
  if (fragmentIndex !== -1) {
    rawPath = rawPath.slice(0, fragmentIndex);
  }

  // Decode percent-encoding
  let pathname;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    // If decoding fails, use the raw path
    pathname = rawPath;
  }

  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }

  return pathname;
}

/**
 * Validate that a decoded path does not escape the user's root directory.
 * Returns the resolved full path if safe, or null if the path escapes.
 * Uses per-user root based on req.username.
 */
function getFullPath(req) {
  const decodedPath = getPath(req);
  const userRoot = getUserRoot(req.username);

  // Check for path traversal BEFORE normalization
  // Split the decoded path and check if any .. would escape root
  const rawSegments = decodedPath.split('/').filter(s => s !== '' && s !== '.');
  let depth = 0;
  for (const seg of rawSegments) {
    if (seg === '..') {
      depth--;
      if (depth < 0) {
        return null; // Escapes root
      }
    } else {
      depth++;
    }
  }

  // Normalize the path to remove any .. or . segments
  const normalized = path.normalize(decodedPath);

  // After normalization, the path must still start with /
  if (!normalized.startsWith('/')) {
    return null;
  }

  const fullPath = path.join(userRoot, normalized);

  // Resolve symlinks to get the real path
  try {
    const resolved = fs.realpathSync(fullPath);
    // Ensure the resolved path is still inside user's root
    if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
      return resolved;
    }
    return null;
  } catch (err) {
    // File doesn't exist yet — check the parent directory
    // Walk up the path to find the first existing ancestor
    let checkPath = fullPath;
    while (checkPath !== userRoot && checkPath !== userRoot + path.sep && checkPath !== '/') {
      try {
        const resolvedAncestor = fs.realpathSync(checkPath);
        if (resolvedAncestor === userRoot || resolvedAncestor.startsWith(userRoot + path.sep)) {
          return fullPath;
        }
        return null;
      } catch {
        checkPath = path.dirname(checkPath);
      }
    }
    // If we got here, the path is inside user's root
    return fullPath;
  }
}

/**
 * Validate a destination URL path (for COPY/MOVE).
 * Returns the resolved full path if safe, or null if the path escapes.
 * Uses per-user root based on req.username.
 */
function getDestinationPath(req, destination) {
  if (!destination) return null;

  let destPathname;
  try {
    // Destination may be a full URL or just a path
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

  const userRoot = getUserRoot(req.username);
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
      if (resolvedParent === userRoot || resolvedParent.startsWith(userRoot + path.sep)) {
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
 * Each segment is percent-encoded, then joined with /.
 */
function encodeWebDavHref(decodedPath) {
  // Remove leading slash, split into segments, encode each, rejoin
  const segments = decodedPath.replace(/^\//, '').split('/');
  const encoded = segments.map(seg => encodeURIComponent(seg));
  return '/' + encoded.join('/');
}

function sendResponse(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { ...getHeaders(res.method || 'GET'), ...headers });
  if (body) {
    res.end(body);
  } else {
    res.end();
  }
}

function handleOptions(req, res) {
  res.writeHead(200, {
    'DAV': '1',
    'Allow': 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH',
    'MS-Author-Via': 'DAV'
  });
  res.end();
}

function handleRangeRequest(req, res, fullPath, stats, range) {
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
  const chunksize = (end - start) + 1;
  const stream = fs.createReadStream(fullPath, { start, end });

  res.writeHead(206, {
    ...getHeaders(req.method, true),
    'Content-Type': getContentType(fullPath),
    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize
  });
  stream.pipe(res);
}

function handleGet(req, res) {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (stats.isDirectory()) {
      handleDirectoryListing(req, res, fullPath);
    } else {
      const range = req.headers.range;
      if (range) {
        handleRangeRequest(req, res, fullPath, stats, range);
      } else {
        // For HEAD requests, only send headers, no body
        if (req.method === 'HEAD') {
          res.writeHead(200, {
            ...getHeaders(req.method, true),
            'Content-Type': getContentType(fullPath),
            'Content-Length': stats.size
          });
          res.end();
          return;
        }
        const stream = fs.createReadStream(fullPath);
        res.writeHead(200, {
          ...getHeaders(req.method, true),
          'Content-Type': getContentType(fullPath),
          'Content-Length': stats.size
        });
        stream.pipe(res);
      }
    }
  });
}

function handleDirectoryListing(req, res, fullPath) {
  const decodedPath = getPath(req);
  const entries = fs.readdirSync(fullPath);

  let html = `<!DOCTYPE html>
<html><head><title>Index of ${decodedPath}</title></head>
<body>
<h1>Index of ${decodedPath}</h1>
<ul>`;

  if (decodedPath !== '/') {
    const parentPath = encodeWebDavHref(path.dirname(decodedPath));
    html += `<li><a href="${parentPath}/">../</a></li>`;
  }

  for (const entry of entries) {
    const entryFullPath = path.join(fullPath, entry);
    const isDir = fs.statSync(entryFullPath).isDirectory();
    const entryHref = encodeWebDavHref(decodedPath + (decodedPath.endsWith('/') ? '' : '/') + entry);
    html += `<li><a href="${entryHref}${isDir ? '/' : ''}">${entry}${isDir ? '/' : ''}</a></li>`;
  }

  html += '</ul></body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * Validate X-OC-Mtime header value.
 * Returns a Date object if valid, or null if the header is missing/invalid.
 * The header must be a Unix timestamp in seconds (integer string).
 */
function parseOcMtime(headerValue) {
  if (headerValue === undefined || headerValue === null) {
    return null;
  }

  // Must be a string
  const str = String(headerValue).trim();
  if (!str) {
    return null;
  }

  // Must be an integer (no decimals, no non-numeric chars)
  if (!/^-?\d+$/.test(str)) {
    return null;
  }

  const seconds = Number(str);

  // Must be a finite number
  if (!Number.isFinite(seconds)) {
    return null;
  }

  // Reasonable range: year 2000 to year 2100 in seconds
  // 946684800 = 2000-01-01, 4102444800 = 2100-01-01
  if (seconds < 946684800 || seconds > 4102444800) {
    return null;
  }

  return new Date(seconds * 1000);
}

function handlePut(req, res) {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Validate X-OC-Mtime header early, before accepting the body
  const rawMtime = req.headers['x-oc-mtime'];
  if (rawMtime !== undefined) {
    const mtimeDate = parseOcMtime(rawMtime);
    if (mtimeDate === null) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: Invalid X-OC-Mtime header');
      return;
    }
  }

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writeStream = fs.createWriteStream(fullPath);
  req.pipe(writeStream);
  writeStream.on('finish', async () => {
    // If X-OC-Mtime was provided, set the file modification time
    if (rawMtime !== undefined) {
      const mtimeDate = parseOcMtime(rawMtime);
      try {
        await fsPromises.utimes(fullPath, mtimeDate, mtimeDate);
      } catch (err) {
        console.error('Failed to set mtime:', err.message);
      }
    }

    const responseHeaders = {
      'Content-Type': 'text/plain'
    };

    // Return X-OC-Mtime: accepted if the header was provided and processed
    if (rawMtime !== undefined) {
      responseHeaders['X-OC-Mtime'] = 'accepted';
    }

    res.writeHead(201, responseHeaders);
    res.end();
  });
  writeStream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  });
}

function handleDelete(req, res) {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Prevent deleting the user's root directory
  const userRoot = getUserRoot(req.username);
  if (fullPath === userRoot) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (stats.isDirectory()) {
      rmDir(fullPath, (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
        res.writeHead(204);
        res.end();
      });
    } else {
      fs.unlink(fullPath, (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
        res.writeHead(204);
        res.end();
      });
    }
  });
}

function handleMkCol(req, res) {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Check if the resource already exists
  fs.stat(fullPath, (err, stats) => {
    if (err === null && stats.isDirectory()) {
      // Resource already exists
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed: Collection already exists');
      return;
    }
    if (err === null) {
      // A non-directory resource exists at this path
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed: Non-collection exists');
      return;
    }

    // If the path already exists but we couldn't stat it, it might be a forbidden path
    // Try to create the collection without recursive (RFC 4918: parent must exist)
    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) {
      res.writeHead(409, { 'Content-Type': 'text/plain' });
      res.end('Conflict: Parent collection does not exist');
      return;
    }

    fs.mkdir(fullPath, (err) => {
      if (err) {
        if (err.code === 'EEXIST') {
          res.writeHead(405, { 'Content-Type': 'text/plain' });
          res.end('Method Not Allowed: Collection already exists');
        } else if (err.code === 'EACCES') {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
        return;
      }
      res.writeHead(201);
      res.end();
    });
  });
}

function handlePropPatch(req, res) {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // Joplin's webdav client sends PROPPATCH to set custom properties.
    // We accept the request and return 207 Multi-Status to indicate success.
    const decodedPath = getPath(req);
    const href = encodeWebDavHref(decodedPath);
    const isDir = fs.statSync(fullPath).isDirectory();
    const hrefWithSlash = isDir && !href.endsWith('/') ? href + '/' : href;

    const response = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${hrefWithSlash}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
    res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(response);
  });
}

function handleCopy(req, res) {
  const destination = req.headers.destination;
  if (!destination) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Destination header required');
    return;
  }

  const sourcePath = getFullPath(req);
  if (sourcePath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const destPath = getDestinationPath(req, destination);
  if (destPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: Invalid destination');
    return;
  }

  const destDir = path.dirname(destPath);

  fs.stat(sourcePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // Check if destination already exists
    fs.stat(destPath, (destErr, destStats) => {
      if (destErr === null) {
        // Destination exists - check Overwrite header
        const overwrite = (req.headers.overwrite || 'F').toUpperCase();
        if (overwrite === 'F') {
          res.writeHead(412, { 'Content-Type': 'text/plain' });
          res.end('Precondition Failed: Destination exists and Overwrite=F');
          return;
        }
        // If destination is a collection and source is not, or vice versa
        if (destStats.isDirectory() !== stats.isDirectory()) {
          res.writeHead(409, { 'Content-Type': 'text/plain' });
          res.end('Conflict: Cannot copy between collection and non-collection');
          return;
        }
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      if (stats.isDirectory()) {
        copyDir(sourcePath, destPath, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            return;
          }
          res.writeHead(201);
          res.end();
        });
      } else {
        const readStream = fs.createReadStream(sourcePath);
        const writeStream = fs.createWriteStream(destPath);
        readStream.pipe(writeStream);
        writeStream.on('finish', () => {
          res.writeHead(201);
          res.end();
        });
        writeStream.on('error', () => {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        });
      }
    });
  });
}

function copyDir(src, dest, callback) {
  fs.mkdir(dest, { recursive: true }, (err) => {
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
        ws.on('error', (err) => callback(err));
      }
    }
  });
}

function handleMove(req, res) {
  const destination = req.headers.destination;
  if (!destination) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Destination header required');
    return;
  }

  const sourcePath = getFullPath(req);
  if (sourcePath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const destPath = getDestinationPath(req, destination);
  if (destPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: Invalid destination');
    return;
  }

  const destDir = path.dirname(destPath);

  fs.stat(sourcePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // Check if destination already exists
    fs.stat(destPath, (destErr, destStats) => {
      if (destErr === null) {
        // Destination exists - check Overwrite header
        const overwrite = (req.headers.overwrite || 'F').toUpperCase();
        if (overwrite === 'F') {
          res.writeHead(412, { 'Content-Type': 'text/plain' });
          res.end('Precondition Failed: Destination exists and Overwrite=F');
          return;
        }
        // If destination is a collection and source is not, or vice versa
        if (destStats.isDirectory() !== stats.isDirectory()) {
          res.writeHead(409, { 'Content-Type': 'text/plain' });
          res.end('Conflict: Cannot move between collection and non-collection');
          return;
        }
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.rename(sourcePath, destPath, (err) => {
        if (err) {
          // Fallback: copy then delete for cross-device moves
          if (stats.isDirectory()) {
            copyDir(sourcePath, destPath, (err3) => {
              if (err3) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
              }
              rmDir(sourcePath, (err4) => {
                if (err4) {
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  res.end('Internal Server Error');
                  return;
                }
                res.writeHead(201);
                res.end();
              });
            });
          } else {
            const rs = fs.createReadStream(sourcePath);
            const ws = fs.createWriteStream(destPath);
            rs.pipe(ws);
            ws.on('finish', () => {
              fs.unlink(sourcePath, () => {
                res.writeHead(201);
                res.end();
              });
            });
            ws.on('error', () => {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
            });
          }
          return;
        }
        res.writeHead(201);
        res.end();
      });
    });
  });
}

function rmDir(dirPath, callback) {
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
      rmDir(entryPath, (err) => {
        if (err) return callback(err);
        if (--remaining === 0) fs.rmdir(dirPath, callback);
      });
    } else {
      fs.unlink(entryPath, (err) => {
        if (err) return callback(err);
        if (--remaining === 0) fs.rmdir(dirPath, callback);
      });
    }
  }
}

function handlePropFind(req, res) {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const depth = (req.headers.depth || '0').toUpperCase();
    const decodedPath = getPath(req);
    let response = '<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:" xmlns:oc="http://owncloud.org/ns">';

    if (stats.isDirectory()) {
      // Always include the collection itself
      const selfHref = encodeWebDavHref(decodedPath);
      const selfHrefWithSlash = selfHref.endsWith('/') ? selfHref : selfHref + '/';
      response += buildPropStat(fullPath, selfHrefWithSlash, true);

      if (depth === '1' || depth === 'INFINITY') {
        const entries = fs.readdirSync(fullPath);
        for (const entry of entries) {
          const entryFullPath = path.join(fullPath, entry);
          const isDir = fs.statSync(entryFullPath).isDirectory();
          // Build the decoded path for the entry
          const entryDecodedPath = decodedPath.endsWith('/') ? `${decodedPath}${entry}` : `${decodedPath}/${entry}`;
          const entryHref = encodeWebDavHref(entryDecodedPath);
          // Directories get a trailing slash in the href
          const entryHrefFinal = isDir ? (entryHref.endsWith('/') ? entryHref : entryHref + '/') : entryHref;
          response += buildPropStat(entryFullPath, entryHrefFinal, isDir);
        }
      }
    } else {
      // File resource
      const fileHref = encodeWebDavHref(decodedPath);
      response += buildPropStat(fullPath, fileHref, false);
    }

    response += '</D:multistatus>';
    res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(response);
  });
}

function computeSha1(fullPath) {
  const fileContent = fs.readFileSync(fullPath);
  return crypto.createHash('sha1').update(fileContent).digest('hex');
}

function buildPropStat(fullPath, href, isDir) {
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

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'text/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain'
  };
  return types[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Require authentication for all requests
  if (!requireAuth(req, res)) {
    return;
  }

  const method = req.method.toUpperCase();

  switch (method) {
    case 'OPTIONS':
      handleOptions(req, res);
      break;
    case 'GET':
    case 'HEAD':
      handleGet(req, res);
      break;
    case 'PUT':
      handlePut(req, res);
      break;
    case 'DELETE':
      handleDelete(req, res);
      break;
    case 'MKCOL':
      handleMkCol(req, res);
      break;
    case 'PROPFIND':
      handlePropFind(req, res);
      break;
    case 'PROPPATCH':
      handlePropPatch(req, res);
      break;
    case 'COPY':
      handleCopy(req, res);
      break;
    case 'MOVE':
      handleMove(req, res);
      break;
    default:
      res.writeHead(405, { Allow: 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, COPY, MOVE' });
      res.end('Method Not Allowed');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`WebDAV server running on http://${HOST}:${PORT}`);
  console.log(`Base data directory: ${ROOT_DIR}`);
  console.log(`Each user gets a per-user subdirectory (e.g., data/notes, data/drive)`);
});

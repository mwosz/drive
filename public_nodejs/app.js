// Register tsx to enable importing .ts files
require('tsx');

const http = require('http');
const path = require('path');
const fs = require('fs');

// Import TypeScript actions
const { handleOptions } = require('./action/options.action');
const { handleGet } = require('./action/get.action');
const { handlePut } = require('./action/put.action');
const { handleDelete } = require('./action/delete.action');
const { handleMkCol } = require('./action/mk-col.action');
const { handlePropFind } = require('./action/prop-find.action');
const { handlePropPatch } = require('./action/prop-patch.action');
const { handleCopy } = require('./action/copy.action');
const { handleMove } = require('./action/move.action');

// Import shared utilities
const { requireAuth } = require('./utils');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Ensure root directory exists
const ROOT_DIR = process.env.WEBDAV_ROOT || path.join(__dirname, '..', 'data');
if (!fs.existsSync(ROOT_DIR)) {
  fs.mkdirSync(ROOT_DIR, { recursive: true });
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

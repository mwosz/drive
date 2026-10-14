import http from 'http';

// Import TypeScript actions
import { handleOptions } from './action/options.action';
import { handleGet } from './action/get.action';
import { handlePut } from './action/put.action';
import { handleDelete } from './action/delete.action';
import { handleMkCol } from './action/mk-col.action';
import { handlePropFind } from './action/prop-find.action';
import { handlePropPatch } from './action/prop-patch.action';
import { handleCopy } from './action/copy.action';
import { handleMove } from './action/move.action';

// Import shared utilities
import { requireAuth, RESOLVED_ROOT_DIR } from './utils';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  // Require authentication for all requests
  if (!requireAuth(req, res)) {
    return;
  }

  const method = req.method!.toUpperCase();

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
  console.log(`Base data directory: ${RESOLVED_ROOT_DIR}`);
  console.log(`Each user gets a per-user subdirectory (e.g., data/notes, data/drive)`);
});

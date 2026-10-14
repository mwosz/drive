import http = require('http');
import * as fs from 'fs';
import * as path from 'path';
import { getFullPath } from '../utils';

export function handleMkCol(req: http.IncomingMessage, res: http.ServerResponse): void {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
    if (err === null && stats.isDirectory()) {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed: Collection already exists');
      return;
    }
    if (err === null) {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed: Non-collection exists');
      return;
    }

    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) {
      res.writeHead(409, { 'Content-Type': 'text/plain' });
      res.end('Conflict: Parent collection does not exist');
      return;
    }

    fs.mkdir(fullPath, (err: NodeJS.ErrnoException | null) => {
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

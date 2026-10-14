import http = require('http');
import * as fs from 'fs';
import { getFullPath, getUserRoot, rmDir } from '../utils';

export function handleDelete(req: http.IncomingMessage, res: http.ServerResponse): void {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const userRoot = getUserRoot((req as any).username);
  if (fullPath === userRoot) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (stats.isDirectory()) {
      rmDir(fullPath, (err: Error | null) => {
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

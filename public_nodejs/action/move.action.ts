import http = require('http');
import * as fs from 'fs';
import * as path from 'path';
import { getFullPath, getDestinationPath, copyDir, rmDir } from '../utils';

export function handleMove(req: http.IncomingMessage, res: http.ServerResponse): void {
  const destination = req.headers.destination as string | undefined;
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

  fs.stat(sourcePath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    fs.stat(destPath, (destErr: NodeJS.ErrnoException | null, destStats: fs.Stats) => {
      if (destErr === null) {
        const overwrite = (typeof req.headers.overwrite === 'string' ? req.headers.overwrite : 'F') || 'F';
        if (overwrite === 'F') {
          res.writeHead(412, { 'Content-Type': 'text/plain' });
          res.end('Precondition Failed: Destination exists and Overwrite=F');
          return;
        }
        if (destStats.isDirectory() !== stats.isDirectory()) {
          res.writeHead(409, { 'Content-Type': 'text/plain' });
          res.end('Conflict: Cannot move between collection and non-collection');
          return;
        }
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.rename(sourcePath, destPath, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          if (stats.isDirectory()) {
            copyDir(sourcePath, destPath, (err3: Error | null) => {
              if (err3) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
              }
              rmDir(sourcePath, (err4: Error | null) => {
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

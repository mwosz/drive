import http = require('http');
import * as fs from 'fs';
import { getFullPath } from '../helpers/path.helper';
import { getUserRoot } from '../helpers/user.helper';
import { rmDir } from '../helpers/directory.helper';
import { deleteDirectory, deleteFile } from '../helpers/response.helper';

export function handleDelete(req: http.IncomingMessage, res: http.ServerResponse): void {
  getFullPath(req, (fullPath) => {
    if (fullPath === null) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    getUserRoot((req as any).username, (userRoot) => {
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
          deleteDirectory(fullPath, res, rmDir);
        } else {
          deleteFile(fullPath, res);
        }
      });
    });
  });
}

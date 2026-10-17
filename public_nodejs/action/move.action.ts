import http = require('http');
import * as fs from 'fs';
import { getFullPath, getDestinationPath } from '../helpers/path.helper';
import { copyDir, rmDir } from '../helpers/directory.helper';
import { getDestinationHeader, ensureDestDir, streamFileMove } from '../helpers/file_stream.helper';
import { checkOverwritePrecondition } from '../helpers/file_stat.helper';
import { sendCreated, sendInternalServerError } from '../helpers/response.helper';

export function handleMove(req: http.IncomingMessage, res: http.ServerResponse): void {
  const destination = getDestinationHeader(req, res);
  if (destination === null) {
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

  ensureDestDir(destPath);

  fs.stat(sourcePath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    fs.stat(destPath, (destErr: NodeJS.ErrnoException | null, destStats: fs.Stats) => {
      const destExists = destErr === null;
      const destIsDir = destExists ? destStats.isDirectory() : false;

      if (checkOverwritePrecondition(req, res, destExists, stats.isDirectory(), destIsDir)) {
        return;
      }

      fs.rename(sourcePath, destPath, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          if (stats.isDirectory()) {
            copyDir(sourcePath, destPath, (err3: Error | null) => {
              if (err3) {
                sendInternalServerError(res);
                return;
              }
              rmDir(sourcePath, (err4: Error | null) => {
                if (err4) {
                  sendInternalServerError(res);
                  return;
                }
                sendCreated(res);
              });
            });
          } else {
            streamFileMove(sourcePath, destPath, res);
          }
          return;
        }
        sendCreated(res);
      });
    });
  });
}

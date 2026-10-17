import http = require('http');
import * as fs from 'fs';
import { getFullPath, getDestinationPath } from '../helpers/path.helper';
import { copyDir } from '../helpers/directory.helper';
import { getDestinationHeader, ensureDestDir, streamFileCopy } from '../helpers/file_stream.helper';
import { checkOverwritePrecondition } from '../helpers/file_stat.helper';
import { sendCreated, sendInternalServerError } from '../helpers/response.helper';

export function handleCopy(req: http.IncomingMessage, res: http.ServerResponse): void {
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

      if (stats.isDirectory()) {
        copyDir(sourcePath, destPath, (err: Error | null) => {
          if (err) {
            sendInternalServerError(res);
            return;
          }
          sendCreated(res);
        });
      } else {
        streamFileCopy(sourcePath, destPath, res);
      }
    });
  });
}

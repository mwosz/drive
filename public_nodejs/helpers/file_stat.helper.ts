import http = require('http');
import * as fs from 'fs';

/**
 * Performs fs.stat on a path and handles errors.
 * If the path doesn't exist, sends 404 and calls callback with null.
 * If successful, calls callback with stats.
 */
export function statPath(
  fullPath: string,
  res: http.ServerResponse,
  callback: (stats: fs.Stats) => void
): void {
  fs.stat(fullPath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    callback(stats);
  });
}

/**
 * Checks if Overwrite header is set to 'F' and destination exists.
 * Returns true if the request should be rejected (412 Precondition Failed).
 */
export function checkOverwritePrecondition(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  destExists: boolean,
  sourceIsDir: boolean,
  destIsDir: boolean
): boolean {
  if (!destExists) {
    return false;
  }

  const overwrite = (typeof req.headers.overwrite === 'string' ? req.headers.overwrite : 'F') || 'F';
  if (overwrite === 'F') {
    res.writeHead(412, { 'Content-Type': 'text/plain' });
    res.end('Precondition Failed: Destination exists and Overwrite=F');
    return true;
  }

  if (sourceIsDir !== destIsDir) {
    res.writeHead(409, { 'Content-Type': 'text/plain' });
    res.end('Conflict: Cannot operate between collection and non-collection');
    return true;
  }

  return false;
}

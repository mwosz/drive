import http = require('http');
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extracts and validates the Destination header from the request.
 * Returns the destination string or null if missing.
 */
export function getDestinationHeader(req: http.IncomingMessage, res: http.ServerResponse): string | null {
  const destination = req.headers.destination as string | undefined;
  if (!destination) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Destination header required');
    return null;
  }
  return destination;
}

/**
 * Ensures the parent directory of the destination path exists, creating it recursively if needed.
 */
export function ensureDestDir(destPath: string): void {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
}

/**
 * Copies a single file from source to destination using streams.
 * Sends 201 on success, 500 on error.
 */
export function streamFileCopy(
  sourcePath: string,
  destPath: string,
  res: http.ServerResponse
): void {
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

/**
 * Moves a single file from source to destination using streams, then deletes the source.
 * Sends 201 on success, 500 on error.
 */
export function streamFileMove(
  sourcePath: string,
  destPath: string,
  res: http.ServerResponse
): void {
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

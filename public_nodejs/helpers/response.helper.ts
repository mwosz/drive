import http = require('http');
import * as fs from 'fs';

/**
 * Sends a 201 Created response.
 */
export function sendCreated(res: http.ServerResponse): void {
  res.writeHead(201);
  res.end();
}

/**
 * Sends a 204 No Content response.
 */
export function sendNoContent(res: http.ServerResponse): void {
  res.writeHead(204);
  res.end();
}

/**
 * Handles directory deletion with callback for success/error.
 */
export function deleteDirectory(
  fullPath: string,
  res: http.ServerResponse,
  rmDir: (path: string, callback: (err: Error | null) => void) => void
): void {
  rmDir(fullPath, (err: Error | null) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    sendNoContent(res);
  });
}

/**
 * Handles file deletion with callback for success/error.
 */
export function deleteFile(
  fullPath: string,
  res: http.ServerResponse
): void {
  fs.unlink(fullPath, (err) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    sendNoContent(res);
  });
}

/**
 * Checks if a path is a directory using fs.statSync.
 */
export function isDirectory(fullPath: string): boolean {
  return fs.statSync(fullPath).isDirectory();
}

/**
 * Sends a 500 Internal Server Error response.
 */
export function sendInternalServerError(res: http.ServerResponse): void {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Internal Server Error');
}

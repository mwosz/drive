import http = require('http');

/**
 * Validates that the full path is not null (user-authenticated).
 * If null, sends 403 Forbidden and returns true to signal early exit.
 */
export function requireFullPath(req: http.IncomingMessage, res: http.ServerResponse): string | null {
  const fullPath = (req as any).fullPath as string | undefined;
  if (fullPath === undefined || fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return null;
  }
  return fullPath;
}

/**
 * Sends a 403 Forbidden response.
 */
export function sendForbidden(res: http.ServerResponse, message = 'Forbidden'): void {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end(message);
}

/**
 * Sends a 404 Not Found response.
 */
export function sendNotFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

/**
 * Sends a 500 Internal Server Error response.
 */
export function sendInternalServerError(res: http.ServerResponse): void {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Internal Server Error');
}

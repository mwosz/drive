import * as path from 'path';

export function getHeaders(method: string, hasRange?: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    DAV: '1',
    'Content-Type': 'text/html; charset=utf-8',
    Allow: 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH',
  };
  if (hasRange) {
    headers['Accept-Ranges'] = 'bytes';
  }
  return headers;
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'text/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
}

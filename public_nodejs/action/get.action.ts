import http = require('http');
import * as fs from 'fs';
import * as path from 'path';
import {
  getFullPath,
  getPath,
  encodeWebDavHref,
  getHeaders,
  getContentType
} from '../utils';

function handleRangeRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  fullPath: string,
  stats: fs.Stats,
  range: string
): void {
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
  const chunksize = (end - start) + 1;
  const stream = fs.createReadStream(fullPath, { start, end });

  res.writeHead(206, {
    ...getHeaders(req.method || 'GET', true),
    'Content-Type': getContentType(fullPath),
    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize
  });
  stream.pipe(res);
}

function handleDirectoryListing(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  fullPath: string
): void {
  const decodedPath = getPath(req);
  const entries = fs.readdirSync(fullPath);

  let html = `<!DOCTYPE html>
<html><head><title>Index of ${decodedPath}</title></head>
<body>
<h1>Index of ${decodedPath}</h1>
<ul>`;

  if (decodedPath !== '/') {
    const parentPath = encodeWebDavHref(path.dirname(decodedPath));
    html += `<li><a href="${parentPath}/">../</a></li>`;
  }

  for (const entry of entries) {
    const entryFullPath = path.join(fullPath, entry);
    const isDir = fs.statSync(entryFullPath).isDirectory();
    const entryHref = encodeWebDavHref(decodedPath + (decodedPath.endsWith('/') ? '' : '/') + entry);
    html += `<li><a href="${entryHref}${isDir ? '/' : ''}">${entry}${isDir ? '/' : ''}</a></li>`;
  }

  html += '</ul></body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

export function handleGet(req: http.IncomingMessage, res: http.ServerResponse): void {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
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
      handleDirectoryListing(req, res, fullPath);
    } else {
      const range = req.headers.range as string | undefined;
      if (range) {
        handleRangeRequest(req, res, fullPath, stats, range);
      } else {
        if (req.method === 'HEAD') {
          res.writeHead(200, {
            ...getHeaders(req.method || 'GET', true),
            'Content-Type': getContentType(fullPath),
            'Content-Length': stats.size
          });
          res.end();
          return;
        }
        const stream = fs.createReadStream(fullPath);
        res.writeHead(200, {
          ...getHeaders(req.method || 'GET', true),
          'Content-Type': getContentType(fullPath),
          'Content-Length': stats.size
        });
        stream.pipe(res);
      }
    }
  });
}

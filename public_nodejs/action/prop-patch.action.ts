import http = require('http');
import * as fs from 'fs';
import { getFullPath, getPath, encodeWebDavHref } from '../utils';

export function handlePropPatch(req: http.IncomingMessage, res: http.ServerResponse): void {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err: NodeJS.ErrnoException | null) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const decodedPath = getPath(req);
    const href = encodeWebDavHref(decodedPath);
    const isDir = fs.statSync(fullPath).isDirectory();
    const hrefWithSlash = isDir && !href.endsWith('/') ? href + '/' : href;

    const response = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${hrefWithSlash}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
    res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(response);
  });
}

import http = require('http');
import * as fs from 'fs';
import * as path from 'path';
import { getFullPath, getPath, encodeWebDavHref } from '../helpers/path.helper';
import { buildPropStat } from '../helpers/metadata.helper';
import { isDirectory } from '../helpers/response.helper';

export function handlePropFind(req: http.IncomingMessage, res: http.ServerResponse): void {
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

    const depth = (typeof req.headers.depth === 'string' ? req.headers.depth : '0').toUpperCase();
    const decodedPath = getPath(req);
    let response = '<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:" xmlns:oc="http://owncloud.org/ns">';

    if (stats.isDirectory()) {
      const selfHref = encodeWebDavHref(decodedPath);
      const selfHrefWithSlash = selfHref.endsWith('/') ? selfHref : selfHref + '/';
      response += buildPropStat(fullPath, selfHrefWithSlash, true);

      if (depth === '1' || depth === 'INFINITY') {
        const entries = fs.readdirSync(fullPath);
        for (const entry of entries) {
          const entryFullPath = path.join(fullPath, entry);
          const isDir = isDirectory(entryFullPath);
          const entryDecodedPath = decodedPath.endsWith('/') ? `${decodedPath}${entry}` : `${decodedPath}/${entry}`;
          const entryHref = encodeWebDavHref(entryDecodedPath);
          const entryHrefFinal = isDir ? (entryHref.endsWith('/') ? entryHref : entryHref + '/') : entryHref;
          response += buildPropStat(entryFullPath, entryHrefFinal, isDir);
        }
      }
    } else {
      const fileHref = encodeWebDavHref(decodedPath);
      response += buildPropStat(fullPath, fileHref, false);
    }

    response += '</D:multistatus>';
    res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(response);
  });
}

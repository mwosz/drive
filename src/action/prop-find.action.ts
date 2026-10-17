import http = require('http');
import * as fs from 'fs';
import * as path from 'path';
import { getFullPath, getPath, encodeWebDavHref } from '../helpers/path.helper';
import { buildPropStatAsync } from '../helpers/metadata.helper';
import { isDirectoryAsync } from '../helpers/response.helper';

export function handlePropFind(req: http.IncomingMessage, res: http.ServerResponse): void {
  getFullPath(req, (fullPath) => {
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
        buildPropStatAsync(fullPath, selfHrefWithSlash, true, (selfProp) => {
          response += selfProp;

          if (depth === '1' || depth === 'INFINITY') {
            fs.readdir(fullPath, (err, entries) => {
              if (err || !entries) {
                response += '</D:multistatus>';
                res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
                res.end(response);
                return;
              }

              let remaining = entries.length;
              if (remaining === 0) {
                response += '</D:multistatus>';
                res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
                res.end(response);
                return;
              }

              for (const entry of entries) {
                const entryFullPath = path.join(fullPath, entry);
                const entryDecodedPath = decodedPath.endsWith('/') ? `${decodedPath}${entry}` : `${decodedPath}/${entry}`;
                const entryHref = encodeWebDavHref(entryDecodedPath);
                isDirectoryAsync(entryFullPath, (isDir) => {
                  const entryHrefFinal = isDir ? (entryHref.endsWith('/') ? entryHref : entryHref + '/') : entryHref;
                  buildPropStatAsync(entryFullPath, entryHrefFinal, isDir, (entryProp) => {
                    response += entryProp;
                    if (--remaining === 0) {
                      response += '</D:multistatus>';
                      res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
                      res.end(response);
                    }
                  });
                });
              }
            });
          } else {
            response += '</D:multistatus>';
            res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
            res.end(response);
          }
        });
      } else {
        const fileHref = encodeWebDavHref(decodedPath);
        buildPropStatAsync(fullPath, fileHref, false, (fileProp) => {
          response += fileProp;
          response += '</D:multistatus>';
          res.writeHead(207, { 'Content-Type': 'text/xml; charset=utf-8' });
          res.end(response);
        });
      }
    });
  });
}

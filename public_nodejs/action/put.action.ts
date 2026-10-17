import http = require('http');
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { getFullPath } from '../helpers/path.helper';
import { parseOcMtime } from '../helpers/metadata.helper';
import { sendInternalServerError } from '../helpers/response.helper';

export function handlePut(req: http.IncomingMessage, res: http.ServerResponse): void {
  const fullPath = getFullPath(req);
  if (fullPath === null) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const rawMtime = req.headers['x-oc-mtime'] as string | undefined;
  if (rawMtime !== undefined) {
    const mtimeDate = parseOcMtime(rawMtime);
    if (mtimeDate === null) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: Invalid X-OC-Mtime header');
      return;
    }
  }

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writeStream = fs.createWriteStream(fullPath);
  req.pipe(writeStream);
  writeStream.on('finish', async () => {
    if (rawMtime !== undefined) {
      const mtimeDate = parseOcMtime(rawMtime);
      if (mtimeDate !== null) {
        try {
          await fsPromises.utimes(fullPath, mtimeDate, mtimeDate);
        } catch (err: any) {
          console.error('Failed to set mtime:', err.message);
        }
      }
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain'
    };

    if (rawMtime !== undefined) {
      responseHeaders['X-OC-Mtime'] = 'accepted';
    }

    res.writeHead(201, responseHeaders);
    res.end();
  });
  writeStream.on('error', () => {
    sendInternalServerError(res);
  });
}

import http from 'http';

import { handleOptions } from '../action/options.action';
import { handleGet } from '../action/get.action';
import { handlePut } from '../action/put.action';
import { handleDelete } from '../action/delete.action';
import { handleMkCol } from '../action/mk-col.action';
import { handlePropFind } from '../action/prop-find.action';
import { handlePropPatch } from '../action/prop-patch.action';
import { handleCopy } from '../action/copy.action';
import { handleMove } from '../action/move.action';
import { requireAuth } from './auth.helper';

export function createWebDAVServer(): http.Server {
  return http.createServer((req, res) => {
    requireAuth(req, res, () => {
      const method = req.method!.toUpperCase();

      switch (method) {
        case 'OPTIONS':
          handleOptions(req, res);
          break;
        case 'GET':
        case 'HEAD':
          handleGet(req, res);
          break;
        case 'PUT':
          handlePut(req, res);
          break;
        case 'DELETE':
          handleDelete(req, res);
          break;
        case 'MKCOL':
          handleMkCol(req, res);
          break;
        case 'PROPFIND':
          handlePropFind(req, res);
          break;
        case 'PROPPATCH':
          handlePropPatch(req, res);
          break;
        case 'COPY':
          handleCopy(req, res);
          break;
        case 'MOVE':
          handleMove(req, res);
          break;
        default:
          res.writeHead(405, { Allow: 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, COPY, MOVE' });
          res.end('Method Not Allowed');
      }
    });
  });
}

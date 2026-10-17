import http = require('http');

export function handleOptions(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, {
    'DAV': '1',
    'Allow': 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH',
    'MS-Author-Via': 'DAV'
  });
  res.end();
}

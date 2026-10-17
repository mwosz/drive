import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Validate X-OC-Mtime header value.
 */
export function parseOcMtime(headerValue: string | undefined | null): Date | null {
  if (headerValue === undefined || headerValue === null) {
    return null;
  }

  const str = String(headerValue).trim();
  if (!str) {
    return null;
  }

  if (!/^-?\d+$/.test(str)) {
    return null;
  }

  const seconds = Number(str);

  if (!Number.isFinite(seconds)) {
    return null;
  }

  if (seconds < 946684800 || seconds > 4102444800) {
    return null;
  }

  return new Date(seconds * 1000);
}

export function computeSha1(fullPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(fullPath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function buildPropStatAsync(
  fullPath: string,
  href: string,
  isDir: boolean,
  callback: (result: string) => void
): void {
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats) {
      callback('');
      return;
    }
    if (isDir) {
      callback(`<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype><D:collection/></D:resourcetype>
      <D:getlastmodified>${stats.mtime.toUTCString()}</D:getlastmodified>
      <D:getcontentlength>0</D:getcontentlength>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
:</D:response>`);
      return;
    }
    computeSha1(fullPath).then((sha1) => {
      callback(`<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype/>
      <D:getlastmodified>${stats.mtime.toUTCString()}</D:getlastmodified>
      <D:getcontentlength>${stats.size}</D:getcontentlength>
      <oc:checksums><oc:checksum>SHA1:${sha1}</oc:checksum></oc:checksums>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
:</D:response>`);
    }, () => {
      callback(`<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype/>
      <D:getlastmodified>${stats.mtime.toUTCString()}</D:getlastmodified>
      <D:getcontentlength>${stats.size}</D:getcontentlength>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
:</D:response>`);
    });
  });
}

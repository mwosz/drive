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

export function computeSha1(fullPath: string): string {
  const fileContent = fs.readFileSync(fullPath);
  return crypto.createHash('sha1').update(fileContent).digest('hex');
}

export function buildPropStat(fullPath: string, href: string, isDir: boolean): string {
  const stats = fs.statSync(fullPath);
  let checksumProp = '';
  if (!isDir) {
    const sha1 = computeSha1(fullPath);
    checksumProp = `\n      <oc:checksums><oc:checksum>SHA1:${sha1}</oc:checksum></oc:checksums>`;
  }
  return `<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype>${isDir ? '<D:collection/>' : ''}</D:resourcetype>
      <D:getlastmodified>${stats.mtime.toUTCString()}</D:getlastmodified>
      <D:getcontentlength>${isDir ? 0 : stats.size}</D:getcontentlength>${checksumProp}
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}

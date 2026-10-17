import http = require('http');
import * as path from 'path';
import * as fs from 'fs';
import { getUserRoot } from './user.helper';

/**
 * Decode the URL pathname from req.url, handling percent-encoding.
 */
export function getPath(req: http.IncomingMessage): string {
  let rawPath = req.url || '/';

  const queryIndex = rawPath.indexOf('?');
  if (queryIndex !== -1) {
    rawPath = rawPath.slice(0, queryIndex);
  }

  const fragmentIndex = rawPath.indexOf('#');
  if (fragmentIndex !== -1) {
    rawPath = rawPath.slice(0, fragmentIndex);
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    pathname = rawPath;
  }

  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }

  return pathname;
}

/**
 * Validate that a decoded path does not escape the user's root directory.
 */
export function getFullPath(req: http.IncomingMessage): string | null {
  const decodedPath = getPath(req);
  const userRoot = getUserRoot((req as any).username);

  const rawSegments = decodedPath.split('/').filter((s: string) => s !== '' && s !== '.');
  let depth = 0;
  for (const seg of rawSegments) {
    if (seg === '..') {
      depth--;
      if (depth < 0) {
        return null;
      }
    } else {
      depth++;
    }
  }

  const normalized = path.normalize(decodedPath);
  if (!normalized.startsWith('/')) {
    return null;
  }

  const fullPath = path.join(userRoot, normalized);

  try {
    const resolved = fs.realpathSync(fullPath);
    if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
      return resolved;
    }
    return null;
  } catch (err) {
    let checkPath = fullPath;
    while (
      checkPath !== userRoot &&
      checkPath !== userRoot + path.sep &&
      checkPath !== '/'
    ) {
      try {
        const resolvedAncestor = fs.realpathSync(checkPath);
        if (
          resolvedAncestor === userRoot ||
          resolvedAncestor.startsWith(userRoot + path.sep)
        ) {
          return fullPath;
        }
        return null;
      } catch {
        checkPath = path.dirname(checkPath);
      }
    }
    return fullPath;
  }
}

/**
 * Validate a destination URL path (for COPY/MOVE).
 */
export function getDestinationPath(
  req: http.IncomingMessage,
  destination: string | undefined
): string | null {
  if (!destination) return null;

  let destPathname: string;
  try {
    if (destination.startsWith('http://') || destination.startsWith('https://')) {
      const parsed = new URL(destination);
      destPathname = decodeURIComponent(parsed.pathname);
    } else {
      destPathname = decodeURIComponent(destination);
    }
  } catch {
    return null;
  }

  const normalized = path.normalize(destPathname);
  if (!normalized.startsWith('/')) {
    return null;
  }

  const userRoot = getUserRoot((req as any).username);
  const fullPath = path.join(userRoot, normalized);

  try {
    const resolved = fs.realpathSync(fullPath);
    if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
      return resolved;
    }
    return null;
  } catch {
    const parent = path.dirname(fullPath);
    try {
      const resolvedParent = fs.realpathSync(parent);
      if (
        resolvedParent === userRoot ||
        resolvedParent.startsWith(userRoot + path.sep)
      ) {
        return fullPath;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Encode a path segment for use in a WebDAV D:href URI.
 */
export function encodeWebDavHref(decodedPath: string): string {
  const segments = decodedPath.replace(/^\//, '').split('/');
  const encoded = segments.map((seg) => encodeURIComponent(seg));
  return '/' + encoded.join('/');
}

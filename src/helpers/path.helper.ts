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
export function getFullPath(
  req: http.IncomingMessage,
  callback: (fullPath: string | null) => void
): void {
  const decodedPath = getPath(req);
  getUserRoot((req as any).username, (userRoot) => {
    const rawSegments = decodedPath.split('/').filter((s: string) => s !== '' && s !== '.');
    let depth = 0;
    for (const seg of rawSegments) {
      if (seg === '..') {
        depth--;
        if (depth < 0) {
          callback(null);
          return;
        }
      } else {
        depth++;
      }
    }

    const normalized = path.normalize(decodedPath);
    if (!normalized.startsWith('/')) {
      callback(null);
      return;
    }

    const fullPath = path.join(userRoot, normalized);

    fs.realpath(fullPath, (err, resolved) => {
      if (!err) {
        if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
          callback(resolved);
        } else {
          callback(null);
        }
        return;
      }
      // File doesn't exist yet, check ancestors
      let checkPath = fullPath;
      const checkAncestor = () => {
        if (checkPath === userRoot || checkPath === userRoot + path.sep || checkPath === '/') {
          callback(fullPath);
          return;
        }
        fs.realpath(checkPath, (err, resolvedAncestor) => {
          if (!err) {
            if (
              resolvedAncestor === userRoot ||
              resolvedAncestor.startsWith(userRoot + path.sep)
            ) {
              callback(fullPath);
            } else {
              callback(null);
            }
          } else {
            checkPath = path.dirname(checkPath);
            checkAncestor();
          }
        });
      };
      checkAncestor();
    });
  });
}

/**
 * Validate a destination URL path (for COPY/MOVE).
 */
export function getDestinationPath(
  req: http.IncomingMessage,
  destination: string | undefined,
  callback: (result: string | null) => void
): void {
  if (!destination) {
    callback(null);
    return;
  }

  let destPathname: string;
  try {
    if (destination.startsWith('http://') || destination.startsWith('https://')) {
      const parsed = new URL(destination);
      destPathname = decodeURIComponent(parsed.pathname);
    } else {
      destPathname = decodeURIComponent(destination);
    }
  } catch {
    callback(null);
    return;
  }

  const normalized = path.normalize(destPathname);
  if (!normalized.startsWith('/')) {
    callback(null);
    return;
  }

  getUserRoot((req as any).username, (userRoot) => {
    const fullPath = path.join(userRoot, normalized);

    fs.realpath(fullPath, (err, resolved) => {
      if (!err) {
        if (resolved === userRoot || resolved.startsWith(userRoot + path.sep)) {
          callback(resolved);
        } else {
          callback(null);
        }
        return;
      }
      const parent = path.dirname(fullPath);
      fs.realpath(parent, (err, resolvedParent) => {
        if (!err) {
          if (
            resolvedParent === userRoot ||
            resolvedParent.startsWith(userRoot + path.sep)
          ) {
            callback(fullPath);
          } else {
            callback(null);
          }
        } else {
          callback(null);
        }
      });
    });
  });
}

/**
 * Encode a path segment for use in a WebDAV D:href URI.
 */
export function encodeWebDavHref(decodedPath: string): string {
  const segments = decodedPath.replace(/^\//, '').split('/');
  const encoded = segments.map((seg) => encodeURIComponent(seg));
  return '/' + encoded.join('/');
}

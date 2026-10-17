import * as fs from 'fs';
import * as path from 'path';

export function copyDir(
  src: string,
  dest: string,
  callback: (err: Error | null) => void
): void {
  fs.mkdir(dest, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
    if (err) return callback(err);
    fs.readdir(src, (err, entries) => {
      if (err) return callback(err);
      let remaining = entries.length;
      if (remaining === 0) return callback(null);
      for (const entry of entries) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        fs.stat(srcPath, (err, stats) => {
          if (err) return callback(err);
          if (stats.isDirectory()) {
            copyDir(srcPath, destPath, (err) => {
              if (err) return callback(err);
              if (--remaining === 0) callback(null);
            });
          } else {
            const rs = fs.createReadStream(srcPath);
            const ws = fs.createWriteStream(destPath);
            rs.pipe(ws);
            ws.on('finish', () => {
              if (--remaining === 0) callback(null);
            });
            ws.on('error', (err: NodeJS.ErrnoException) => callback(err));
          }
        });
      }
    });
  });
}

export function rmDir(
  dirPath: string,
  callback: (err: Error | null) => void
): void {
  fs.readdir(dirPath, (err, entries) => {
    if (err) return callback(err);
    let remaining = entries.length;
    if (remaining === 0) {
      fs.rmdir(dirPath, callback);
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      fs.stat(entryPath, (err, stats) => {
        if (err) return callback(err);
        if (stats.isDirectory()) {
          rmDir(entryPath, (err: Error | null) => {
            if (err) return callback(err);
            if (--remaining === 0) fs.rmdir(dirPath, callback);
          });
        } else {
          fs.unlink(entryPath, (err: NodeJS.ErrnoException | null) => {
            if (err) return callback(err);
            if (--remaining === 0) fs.rmdir(dirPath, callback);
          });
        }
      });
    }
  });
}

import * as fs from 'fs';
import * as path from 'path';

export function copyDir(
  src: string,
  dest: string,
  callback: (err: Error | null) => void
): void {
  fs.mkdir(dest, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
    if (err) return callback(err);
    const entries = fs.readdirSync(src);
    let remaining = entries.length;
    if (remaining === 0) return callback(null);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      const isDir = fs.statSync(srcPath).isDirectory();
      if (isDir) {
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
    }
  });
}

export function rmDir(
  dirPath: string,
  callback: (err: Error | null) => void
): void {
  const entries = fs.readdirSync(dirPath);
  let remaining = entries.length;
  if (remaining === 0) {
    fs.rmdir(dirPath, callback);
    return;
  }
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry);
    const isDir = fs.statSync(entryPath).isDirectory();
    if (isDir) {
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
  }
}

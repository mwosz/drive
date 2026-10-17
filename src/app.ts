import { createWebDAVServer } from './helpers/server.helper';
import { RESOLVED_ROOT_DIR } from './helpers/user.helper';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const server = createWebDAVServer();

server.listen(PORT, HOST, () => {
  console.log(`WebDAV server running on http://${HOST}:${PORT}`);
  console.log(`Base data directory: ${RESOLVED_ROOT_DIR}`);
  console.log(`Each user gets a per-user subdirectory (e.g., data/notes, data/drive)`);
});

import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { createWebDAVServer } from '../helpers/server.helper';

// Create a test server
const server = createWebDAVServer();

// HTTP client helper that supports all WebDAV methods
interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

function makeRequest(
  method: string,
  pathname: string,
  authHeader: string,
  body?: string | Buffer,
  extraHeaders?: Record<string, string>
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr !== 'object') {
      reject(new Error('Server not listening'));
      return;
    }

    const headers: Record<string, string> = {
      Authorization: authHeader,
      ...extraHeaders,
    };

    if (body) {
      const buf = typeof body === 'string' ? Buffer.from(body) : body;
      headers['Content-Length'] = String(buf.length);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'text/plain';
      }
    }

    const options = {
      hostname: addr.address,
      port: addr.port,
      method,
      path: pathname,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode!, headers: res.headers, text: data });
      });
    });

    req.on('error', reject);

    if (body) {
      const buf = typeof body === 'string' ? Buffer.from(body) : body;
      req.write(buf);
    }

    req.end();
  });
}

// Convenience methods
function reqGet(pathname: string, auth: string, extraHeaders?: Record<string, string>) {
  return makeRequest('GET', pathname, auth, undefined, extraHeaders);
}
function reqHead(pathname: string, auth: string) {
  return makeRequest('HEAD', pathname, auth);
}
function reqPut(pathname: string, auth: string, body: string | Buffer, extraHeaders?: Record<string, string>) {
  return makeRequest('PUT', pathname, auth, body, extraHeaders);
}
function reqDelete(pathname: string, auth: string) {
  return makeRequest('DELETE', pathname, auth);
}
function reqMkCol(pathname: string, auth: string) {
  return makeRequest('MKCOL', pathname, auth);
}
function reqPropFind(pathname: string, auth: string, depth: string) {
  return makeRequest('PROPFIND', pathname, auth, undefined, { Depth: depth });
}
function reqPropPatch(pathname: string, auth: string, body: string) {
  return makeRequest('PROPPATCH', pathname, auth, body, { 'Content-Type': 'text/xml' });
}
function reqCopy(source: string, auth: string, destination: string, extraHeaders?: Record<string, string>) {
  return makeRequest('COPY', source, auth, undefined, { Destination: destination, ...extraHeaders });
}
function reqMove(source: string, auth: string, destination: string, extraHeaders?: Record<string, string>) {
  return makeRequest('MOVE', source, auth, undefined, { Destination: destination, ...extraHeaders });
}
function reqOptions(pathname: string, auth: string) {
  return makeRequest('OPTIONS', pathname, auth);
}
function reqPatch(pathname: string, auth: string) {
  return makeRequest('PATCH', pathname, auth);
}

// Test configuration
const TEST_USER = 'testuser';
const TEST_PASSWORD = 'testpass123';
const TEST_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'test-integration');
let originalUsersFile: string | null = null;
const TEST_USERS_FILE = path.join(__dirname, '..', '..', 'users.json');

// Helper: generate basic auth header
function basicAuth(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

// Helper: create a test user with known password
function createTestUser(): void {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(TEST_PASSWORD, salt, 100000, 64, 'sha512')
    .toString('hex');

  // Back up original users.json
  if (fs.existsSync(TEST_USERS_FILE)) {
    originalUsersFile = fs.readFileSync(TEST_USERS_FILE, 'utf-8');
  }

  // Write test user
  fs.writeFileSync(
    TEST_USERS_FILE,
    JSON.stringify([{ user: TEST_USER, salt, hash }], null, 2)
  );
}

// Helper: restore original users.json
function restoreUsersFile(): void {
  if (originalUsersFile !== null) {
    fs.writeFileSync(TEST_USERS_FILE, originalUsersFile);
  } else if (fs.existsSync(TEST_USERS_FILE)) {
    // If there was no original file, remove the test one
    // Actually, keep it if it existed before
  }
}


beforeAll((done) => {
  // Set up test data directory
  process.env.WEBDAV_ROOT = TEST_DATA_DIR;
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  // Create test user with known password
  createTestUser();

  // Start server on a random port
  server.listen(0, '127.0.0.1', done);
});

afterAll(() => {
  // Restore original users.json
  restoreUsersFile();

  // Clean up test data
  delete process.env.WEBDAV_ROOT;
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  server.close();
});

describe('WebDAV Server Integration Tests', () => {
  const auth = basicAuth(TEST_USER, TEST_PASSWORD);

  describe('Authentication', () => {
    it('should return 401 without auth header', async () => {
      const res = await makeRequest('GET', '/', '');
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBeDefined();
    });

    it('should return 401 with invalid credentials', async () => {
      const res = await makeRequest('GET', '/', basicAuth('wrong', 'wrong'));
      expect(res.status).toBe(401);
    });

    it('should return 401 with wrong password', async () => {
      const res = await makeRequest('GET', '/', basicAuth(TEST_USER, 'wrongpassword'));
      expect(res.status).toBe(401);
    });

    it('should return 401 with wrong username', async () => {
      const res = await makeRequest('GET', '/', basicAuth('nonexistent', TEST_PASSWORD));
      expect(res.status).toBe(401);
    });

    it('should authenticate with valid credentials', async () => {
      const res = await reqGet('/', auth);
      expect(res.status).toBe(200);
    });
  });

  describe('OPTIONS', () => {
    it('should return 200 with DAV header', async () => {
      const res = await reqOptions('/', auth);
      expect(res.status).toBe(200);
      expect(res.headers['dav']).toBe('1');
      expect(res.headers['allow']).toContain('OPTIONS');
      expect(res.headers['allow']).toContain('PROPFIND');
    });
  });

  describe('MKCOL', () => {
    afterEach(async () => {
      await reqDelete('/testdir', auth);
    });

    it('should create a new collection', async () => {
      const res = await reqMkCol('/testdir', auth);
      expect(res.status).toBe(201);
      const propRes = await reqPropFind('/testdir', auth, '0');
      expect(propRes.status).toBe(207);
    });

    it('should return 405 if collection already exists', async () => {
      await reqMkCol('/testdir', auth);
      const res = await reqMkCol('/testdir', auth);
      expect(res.status).toBe(405);
    });

    it('should return 409 if parent does not exist', async () => {
      const res = await reqMkCol('/nonexistent/testdir', auth);
      expect(res.status).toBe(409);
    });

    it('should create nested collection', async () => {
      await reqMkCol('/parent', auth);
      const res = await reqMkCol('/parent/child', auth);
      expect(res.status).toBe(201);
      await reqDelete('/parent/child', auth);
      await reqDelete('/parent', auth);
    });
  });

  describe('PUT', () => {
    afterEach(async () => {
      await reqDelete('/testfile.txt', auth);
      await reqDelete('/testdir/file.txt', auth);
      await reqDelete('/testdir', auth);
    });

    it('should create a new file', async () => {
      const res = await reqPut('/testfile.txt', auth, 'Hello WebDAV');
      expect(res.status).toBe(201);
      const getRes = await reqGet('/testfile.txt', auth);
      expect(getRes.text).toBe('Hello WebDAV');
    });

    it('should overwrite an existing file', async () => {
      await reqPut('/testfile.txt', auth, 'Original content');
      const res = await reqPut('/testfile.txt', auth, 'Updated content');
      expect(res.status).toBe(201);
      const getRes = await reqGet('/testfile.txt', auth);
      expect(getRes.text).toBe('Updated content');
    });

    it('should create file in non-existent directory', async () => {
      const res = await reqPut('/testdir/file.txt', auth, 'Nested file');
      expect(res.status).toBe(201);
    });

    it('should accept X-OC-Mtime header', async () => {
      const res = await reqPut('/testfile.txt', auth, 'File with mtime', { 'X-OC-Mtime': '1609459200' });
      expect(res.status).toBe(201);
      expect(res.headers['x-oc-mtime']).toBe('accepted');
    });

    it('should reject invalid X-OC-Mtime header', async () => {
      const res = await reqPut('/testfile.txt', auth, 'File with invalid mtime', { 'X-OC-Mtime': 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should create binary file', async () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await reqPut('/testfile.txt', auth, buffer);
      expect(res.status).toBe(201);
    });
  });

  describe('GET', () => {
    beforeEach(async () => {
      await reqPut('/testfile.txt', auth, 'Hello World');
    });

    afterEach(async () => {
      await reqDelete('/testfile.txt', auth);
      await reqDelete('/testdir', auth);
    });

    it('should return directory listing for root', async () => {
      const res = await reqGet('/', auth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Index of /');
    });

    it('should return file content', async () => {
      const res = await reqGet('/testfile.txt', auth);
      expect(res.status).toBe(200);
      expect(res.text).toBe('Hello World');
      expect(res.headers['content-type']).toBe('text/plain');
    });

    it('should return 404 for non-existent file', async () => {
      const res = await reqGet('/nonexistent.txt', auth);
      expect(res.status).toBe(404);
    });

    it('should return directory listing', async () => {
      await reqMkCol('/testdir', auth);
      const res = await reqGet('/testdir', auth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('should handle range requests', async () => {
      const res = await reqGet('/testfile.txt', auth, { Range: 'bytes=0-4' });
      expect(res.status).toBe(206);
      expect(res.text).toBe('Hello');
      expect(res.headers['content-range']).toMatch(/bytes 0-4\/11/);
    });
  });

  describe('HEAD', () => {
    beforeEach(async () => {
      await reqPut('/testfile.txt', auth, 'Hello World');
    });

    afterEach(async () => {
      await reqDelete('/testfile.txt', auth);
    });

    it('should return headers without body', async () => {
      const res = await reqHead('/testfile.txt', auth);
      expect(res.status).toBe(200);
      expect(res.headers['content-length']).toBe('11');
      expect(res.text).toBe('');
    });

    it('should return 404 for non-existent file', async () => {
      const res = await reqHead('/nonexistent.txt', auth);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE', () => {
    beforeEach(async () => {
      await reqPut('/testfile.txt', auth, 'To delete');
    });

    it('should delete a file', async () => {
      const res = await reqDelete('/testfile.txt', auth);
      expect(res.status).toBe(204);
      const getRes = await reqGet('/testfile.txt', auth);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent file', async () => {
      await reqDelete('/testfile.txt', auth);
      const res = await reqDelete('/testfile.txt', auth);
      expect(res.status).toBe(404);
    });

    it('should delete a directory', async () => {
      await reqMkCol('/testdir', auth);
      await reqPut('/testdir/file.txt', auth, 'content');
      const res = await reqDelete('/testdir', auth);
      expect(res.status).toBe(204);
    });

    it('should not delete root directory', async () => {
      const res = await reqDelete('/', auth);
      expect(res.status).toBe(403);
    });
  });

  describe('PROPFIND', () => {
    beforeEach(async () => {
      await reqPut('/testfile.txt', auth, 'Hello World');
      await reqMkCol('/testdir', auth);
    });

    afterEach(async () => {
      await reqDelete('/testfile.txt', auth);
      await reqDelete('/testdir', auth);
    });

    it('should return 207 Multi-Status for directory with depth 0', async () => {
      const res = await reqPropFind('/', auth, '0');
      expect(res.status).toBe(207);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.text).toContain('<D:multistatus');
    });

    it('should return 207 for file', async () => {
      const res = await reqPropFind('/testfile.txt', auth, '0');
      expect(res.status).toBe(207);
      expect(res.text).toContain('testfile.txt');
    });

    it('should list children with depth 1', async () => {
      const res = await reqPropFind('/', auth, '1');
      expect(res.status).toBe(207);
      expect(res.text).toContain('testfile.txt');
      expect(res.text).toContain('testdir');
    });

    it('should include resourcetype for collections', async () => {
      const res = await reqPropFind('/', auth, '1');
      expect(res.status).toBe(207);
      expect(res.text).toContain('<D:collection/>');
    });

    it('should include checksum for files', async () => {
      const res = await reqPropFind('/testfile.txt', auth, '0');
      expect(res.status).toBe(207);
      expect(res.text).toContain('SHA1:');
    });

    it('should return 404 for non-existent path', async () => {
      const res = await reqPropFind('/nonexistent', auth, '0');
      expect(res.status).toBe(404);
    });
  });

  describe('PROPPATCH', () => {
    beforeEach(async () => {
      await reqPut('/testfile.txt', auth, 'Hello World');
    });

    afterEach(async () => {
      await reqDelete('/testfile.txt', auth);
    });

    it('should return 207 Multi-Status', async () => {
      const res = await reqPropPatch('/testfile.txt', auth, '<xml></xml>');
      expect(res.status).toBe(207);
      expect(res.headers['content-type']).toContain('text/xml');
    });

    it('should return 404 for non-existent file', async () => {
      const res = await reqPropPatch('/nonexistent.txt', auth, '<xml></xml>');
      expect(res.status).toBe(404);
    });
  });

  describe('COPY', () => {
    beforeEach(async () => {
      await reqPut('/source.txt', auth, 'Source content');
    });

    afterEach(async () => {
      await reqDelete('/source.txt', auth);
      await reqDelete('/dest.txt', auth);
      await reqDelete('/sourcedir', auth);
      await reqDelete('/destdir', auth);
    });

    it('should copy a file', async () => {
      const res = await reqCopy('/source.txt', auth, 'http://localhost/dest.txt');
      expect(res.status).toBe(201);
      const getRes = await reqGet('/dest.txt', auth);
      expect(getRes.text).toBe('Source content');
    });

    it('should return 400 without Destination header', async () => {
      const res = await makeRequest('COPY', '/source.txt', auth);
      expect(res.status).toBe(400);
    });

    it('should return 412 when overwriting with Overwrite: F', async () => {
      await reqPut('/dest.txt', auth, 'Existing content');
      const res = await reqCopy('/source.txt', auth, 'http://localhost/dest.txt', { Overwrite: 'F' });
      expect(res.status).toBe(412);
    });

    it('should overwrite with Overwrite: T', async () => {
      await reqPut('/dest.txt', auth, 'Existing content');
      const res = await reqCopy('/source.txt', auth, 'http://localhost/dest.txt', { Overwrite: 'T' });
      expect(res.status).toBe(201);
      const getRes = await reqGet('/dest.txt', auth);
      expect(getRes.text).toBe('Source content');
    });

    it('should copy a directory', async () => {
      await reqMkCol('/sourcedir', auth);
      await reqPut('/sourcedir/file.txt', auth, 'In directory');
      const res = await reqCopy('/sourcedir', auth, 'http://localhost/destdir');
      expect(res.status).toBe(201);
      const getRes = await reqGet('/destdir/file.txt', auth);
      expect(getRes.text).toBe('In directory');
    });

    it('should return 404 for non-existent source', async () => {
      const res = await reqCopy('/nonexistent.txt', auth, 'http://localhost/dest.txt');
      expect(res.status).toBe(404);
    });
  });

  describe('MOVE', () => {
    beforeEach(async () => {
      await reqPut('/moveme.txt', auth, 'Move this file');
    });

    afterEach(async () => {
      await reqDelete('/moveme.txt', auth);
      await reqDelete('/moved.txt', auth);
    });

    it('should move a file', async () => {
      const res = await reqMove('/moveme.txt', auth, 'http://localhost/moved.txt');
      expect(res.status).toBe(201);
      const sourceRes = await reqGet('/moveme.txt', auth);
      expect(sourceRes.status).toBe(404);
      const destRes = await reqGet('/moved.txt', auth);
      expect(destRes.text).toBe('Move this file');
    });

    it('should return 400 without Destination header', async () => {
      const res = await makeRequest('MOVE', '/moveme.txt', auth);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent source', async () => {
      const res = await reqMove('/nonexistent.txt', auth, 'http://localhost/dest.txt');
      expect(res.status).toBe(404);
    });

    it('should return 412 when overwriting with Overwrite: F', async () => {
      await reqPut('/moved.txt', auth, 'Existing');
      const res = await reqMove('/moveme.txt', auth, 'http://localhost/moved.txt', { Overwrite: 'F' });
      expect(res.status).toBe(412);
    });
  });

  describe('Unsupported methods', () => {
    it('should return 405 for PATCH', async () => {
      const res = await reqPatch('/', auth);
      expect(res.status).toBe(405);
    });

    it('should return 401 for PATCH without auth', async () => {
      const res = await makeRequest('PATCH', '/', '');
      expect(res.status).toBe(401);
    });
  });

  describe('Path encoding', () => {
    afterEach(async () => {
      const userDir = path.join(TEST_DATA_DIR, TEST_USER);
      if (fs.existsSync(userDir)) {
        const entries = fs.readdirSync(userDir);
        for (const entry of entries) {
          const entryPath = path.join(userDir, entry);
          if (fs.statSync(entryPath).isDirectory()) {
            fs.rmSync(entryPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(entryPath);
          }
        }
      }
    });

    it('should handle files with spaces in name', async () => {
      const res = await reqPut('/file%20with%20spaces.txt', auth, 'Content');
      expect(res.status).toBe(201);
      const getRes = await reqGet('/file%20with%20spaces.txt', auth);
      expect(getRes.text).toBe('Content');
    });

    it('should handle unicode filenames', async () => {
      const res = await reqPut('/caf%C3%A9.txt', auth, 'Coffee content');
      expect(res.status).toBe(201);
      const getRes = await reqGet('/caf%C3%A9.txt', auth);
      expect(getRes.text).toBe('Coffee content');
    });
  });

  describe('Large files', () => {
    afterEach(async () => {
      await reqDelete('/largefile.txt', auth);
    });

    it('should handle large file upload', async () => {
      const largeContent = 'x'.repeat(1024 * 1024);
      const res = await reqPut('/largefile.txt', auth, largeContent);
      expect(res.status).toBe(201);
      const getRes = await reqGet('/largefile.txt', auth);
      expect(getRes.text.length).toBe(1024 * 1024);
    });
  });
});

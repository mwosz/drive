import * as fs from 'fs';
import * as path from 'path';

const TEST_USERS_FILE = path.join(__dirname, '..', '..', 'users.json');

describe('auth.helper — users.json security', () => {
  let originalContent: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(TEST_USERS_FILE)) {
      originalContent = fs.readFileSync(TEST_USERS_FILE, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalContent !== null) {
      fs.writeFileSync(TEST_USERS_FILE, originalContent);
    }
  });

  it('should have users.json in the project', () => {
    expect(fs.existsSync(TEST_USERS_FILE)).toBe(true);
  });

  it('should have valid users.json format', () => {
    const content = fs.readFileSync(TEST_USERS_FILE, 'utf-8');
    const users = JSON.parse(content);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user).toHaveProperty('user');
      expect(user).toHaveProperty('salt');
      expect(user).toHaveProperty('hash');
      expect(typeof user.user).toBe('string');
      expect(typeof user.salt).toBe('string');
      expect(typeof user.hash).toBe('string');
    }
  });

  it('should call process.exit on malformed users.json', (done) => {
    const originalExit = process.exit;

    // Write malformed JSON
    fs.writeFileSync(TEST_USERS_FILE, '{invalid json content', 'utf-8');

    // Clear the dist module cache so it re-reads the file
    jest.resetModules();

    process.exit = ((code: number) => {
      expect(code).toBe(1);
      // Restore
      process.exit = originalExit;
      if (originalContent !== null) {
        fs.writeFileSync(TEST_USERS_FILE, originalContent);
      }
      done();
    }) as any;

    // Import fresh — USERS_FILE is set at module load time, but loadUsers reads the file asynchronously
    const distAuthHelper = require('../../dist/helpers/auth.helper');
    distAuthHelper.loadUsers(() => {
      // This callback should not be called when JSON is malformed
      process.exit = originalExit;
      if (originalContent !== null) {
        fs.writeFileSync(TEST_USERS_FILE, originalContent);
      }
      done(new Error('loadUsers callback should not be called for malformed JSON'));
    });
  });
});

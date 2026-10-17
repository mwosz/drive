import * as http from 'http';
import { getDestinationHeader, ensureDestDir } from './file_stream.helper';
import * as fs from 'fs';

describe('getDestinationHeader', () => {
  let mockRes: http.ServerResponse;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;
  });

  it('should return null and send 400 when destination header is missing', () => {
    const mockReq = { headers: {} } as any;
    const result = getDestinationHeader(mockReq, mockRes);
    expect(result).toBeNull();
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Bad Request: Destination header required');
  });

  it('should return destination when header is present', () => {
    const mockReq = { headers: { destination: 'http://localhost/target' } } as any;
    const result = getDestinationHeader(mockReq, mockRes);
    expect(result).toBe('http://localhost/target');
    expect(mockRes.writeHead).not.toHaveBeenCalled();
  });

  it('should return null when destination is empty string', () => {
    const mockReq = { headers: { destination: '' } } as any;
    const result = getDestinationHeader(mockReq, mockRes);
    expect(result).toBeNull();
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/plain' });
  });
});

describe('ensureDestDir', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync('/tmp/webdav-test-');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create parent directory if it does not exist', (done) => {
    const destPath = `${tmpDir}/newdir/subdir/file.txt`;
    ensureDestDir(destPath, (err) => {
      expect(err).toBeNull();
      expect(fs.existsSync(`${tmpDir}/newdir/subdir`)).toBe(true);
      fs.rmSync(`${tmpDir}/newdir`, { recursive: true });
      done();
    });
  });

  it('should not fail if parent directory already exists', (done) => {
    const destPath = `${tmpDir}/existing/file.txt`;
    fs.mkdirSync(`${tmpDir}/existing`, { recursive: true });
    ensureDestDir(destPath, (err) => {
      expect(err).toBeNull();
      fs.rmSync(`${tmpDir}/existing`, { recursive: true });
      done();
    });
  });
});

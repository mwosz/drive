import * as http from 'http';
import { requireFullPath, sendForbidden, sendNotFound, sendInternalServerError } from './path_validation.helper';

describe('requireFullPath', () => {
  let mockRes: http.ServerResponse;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;
  });

  it('should return null and send 403 when fullPath is undefined', () => {
    const mockReq = {} as http.IncomingMessage;
    const result = requireFullPath(mockReq, mockRes);
    expect(result).toBeNull();
    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Forbidden');
  });

  it('should return null and send 403 when fullPath is null', () => {
    const mockReq = { fullPath: null } as any;
    const result = requireFullPath(mockReq, mockRes);
    expect(result).toBeNull();
    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
  });

  it('should return fullPath when it is defined', () => {
    const mockReq = { fullPath: '/some/path' } as any;
    const result = requireFullPath(mockReq, mockRes);
    expect(result).toBe('/some/path');
    expect(mockRes.writeHead).not.toHaveBeenCalled();
  });
});

describe('sendForbidden', () => {
  let mockRes: http.ServerResponse;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;
  });

  it('should send 403 with default message', () => {
    sendForbidden(mockRes);
    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Forbidden');
  });

  it('should send 403 with custom message', () => {
    sendForbidden(mockRes, 'Access Denied');
    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Access Denied');
  });
});

describe('sendNotFound', () => {
  let mockRes: http.ServerResponse;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;
  });

  it('should send 404', () => {
    sendNotFound(mockRes);
    expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Not Found');
  });
});

describe('sendInternalServerError', () => {
  let mockRes: http.ServerResponse;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;
  });

  it('should send 500', () => {
    sendInternalServerError(mockRes);
    expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Internal Server Error');
  });
});

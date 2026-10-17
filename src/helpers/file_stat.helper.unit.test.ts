import * as http from 'http';
import { checkOverwritePrecondition } from './file_stat.helper';

describe('checkOverwritePrecondition', () => {
  let mockReq: http.IncomingMessage;
  let mockRes: http.ServerResponse;

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;
    mockReq = {
      headers: {},
    } as any;
  });

  it('should return false when destination does not exist', () => {
    const result = checkOverwritePrecondition(mockReq, mockRes, false, false, false);
    expect(result).toBe(false);
    expect(mockRes.writeHead).not.toHaveBeenCalled();
  });

  it('should return true and send 412 when overwrite is F and dest exists', () => {
    const result = checkOverwritePrecondition(mockReq, mockRes, true, false, false);
    expect(result).toBe(true);
    expect(mockRes.writeHead).toHaveBeenCalledWith(412, { 'Content-Type': 'text/plain' });
  });

  it('should return true and send 412 when overwrite header is explicitly F', () => {
    mockReq.headers.overwrite = 'F';
    const result = checkOverwritePrecondition(mockReq, mockRes, true, false, false);
    expect(result).toBe(true);
    expect(mockRes.writeHead).toHaveBeenCalledWith(412, { 'Content-Type': 'text/plain' });
  });

  it('should return false when overwrite is T and dest exists', () => {
    mockReq.headers.overwrite = 'T';
    const result = checkOverwritePrecondition(mockReq, mockRes, true, false, false);
    expect(result).toBe(false);
    expect(mockRes.writeHead).not.toHaveBeenCalled();
  });

  it('should return true and send 409 when source and dest types mismatch with overwrite T', () => {
    mockReq.headers.overwrite = 'T';
    const result = checkOverwritePrecondition(mockReq, mockRes, true, true, false);
    expect(result).toBe(true);
    expect(mockRes.writeHead).toHaveBeenCalledWith(409, { 'Content-Type': 'text/plain' });
  });

  it('should return false when source and dest types match with overwrite T', () => {
    mockReq.headers.overwrite = 'T';
    const result = checkOverwritePrecondition(mockReq, mockRes, true, true, true);
    expect(result).toBe(false);
    expect(mockRes.writeHead).not.toHaveBeenCalled();
  });
});

import { getHeaders, getContentType } from './http.helper';

describe('getHeaders', () => {
  it('should return default headers', () => {
    const headers = getHeaders('GET');
    expect(headers['DAV']).toBe('1');
    expect(headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(headers['Allow']).toBe('OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH');
    expect(headers['Accept-Ranges']).toBeUndefined();
  });

  it('should include Accept-Ranges when hasRange is true', () => {
    const headers = getHeaders('GET', true);
    expect(headers['Accept-Ranges']).toBe('bytes');
  });

  it('should not include Accept-Ranges when hasRange is false', () => {
    const headers = getHeaders('GET', false);
    expect(headers['Accept-Ranges']).toBeUndefined();
  });
});

describe('getContentType', () => {
  it('should return correct content type for html', () => {
    expect(getContentType('file.html')).toBe('text/html');
  });

  it('should return correct content type for css', () => {
    expect(getContentType('file.css')).toBe('text/css');
  });

  it('should return correct content type for js', () => {
    expect(getContentType('file.js')).toBe('application/javascript');
  });

  it('should return correct content type for json', () => {
    expect(getContentType('file.json')).toBe('application/json');
  });

  it('should return correct content type for xml', () => {
    expect(getContentType('file.xml')).toBe('text/xml');
  });

  it('should return correct content type for png', () => {
    expect(getContentType('file.png')).toBe('image/png');
  });

  it('should return correct content type for jpg', () => {
    expect(getContentType('file.jpg')).toBe('image/jpeg');
  });

  it('should return correct content type for gif', () => {
    expect(getContentType('file.gif')).toBe('image/gif');
  });

  it('should return correct content type for pdf', () => {
    expect(getContentType('file.pdf')).toBe('application/pdf');
  });

  it('should return correct content type for txt', () => {
    expect(getContentType('file.txt')).toBe('text/plain');
  });

  it('should return octet-stream for unknown extension', () => {
    expect(getContentType('file.xyz')).toBe('application/octet-stream');
  });

  it('should handle uppercase extensions', () => {
    expect(getContentType('file.HTML')).toBe('text/html');
  });
});

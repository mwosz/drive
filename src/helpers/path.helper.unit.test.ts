import { encodeWebDavHref } from './path.helper';

describe('encodeWebDavHref', () => {
  it('should encode a simple path', () => {
    expect(encodeWebDavHref('/file.txt')).toBe('/file.txt');
  });

  it('should encode a path with spaces', () => {
    expect(encodeWebDavHref('/my file.txt')).toBe('/my%20file.txt');
  });

  it('should encode a nested path', () => {
    expect(encodeWebDavHref('/dir/file.txt')).toBe('/dir/file.txt');
  });

  it('should encode special characters in path segments', () => {
    expect(encodeWebDavHref('/dir name/file name.txt')).toBe('/dir%20name/file%20name.txt');
  });

  it('should handle root path', () => {
    expect(encodeWebDavHref('/')).toBe('/');
  });

  it('should encode unicode characters', () => {
    expect(encodeWebDavHref('/café.txt')).toBe('/caf%C3%A9.txt');
  });

  it('should encode percent signs', () => {
    expect(encodeWebDavHref('/100%.txt')).toBe('/100%25.txt');
  });

  it('should encode plus signs', () => {
    expect(encodeWebDavHref('/a+b.txt')).toBe('/a%2Bb.txt');
  });
});

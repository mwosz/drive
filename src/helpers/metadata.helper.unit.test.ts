import { parseOcMtime } from './metadata.helper';

describe('parseOcMtime', () => {
  it('should return null for undefined', () => {
    expect(parseOcMtime(undefined)).toBeNull();
  });

  it('should return null for null', () => {
    expect(parseOcMtime(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseOcMtime('')).toBeNull();
  });

  it('should return null for whitespace only', () => {
    expect(parseOcMtime('   ')).toBeNull();
  });

  it('should return null for non-numeric string', () => {
    expect(parseOcMtime('abc')).toBeNull();
  });

  it('should return null for float string', () => {
    expect(parseOcMtime('123.45')).toBeNull();
  });

  it('should return null for value below range', () => {
    // Before 2000-01-01
    expect(parseOcMtime('946684799')).toBeNull();
  });

  it('should return null for value above range', () => {
    // After 2100-01-01
    expect(parseOcMtime('4102444801')).toBeNull();
  });

  it('should return Date for valid timestamp', () => {
    // 2021-01-01 00:00:00 UTC = 1609459200
    const result = parseOcMtime('1609459200');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1609459200 * 1000);
  });

  it('should handle negative timestamps within range', () => {
    // Negative timestamps are rejected by regex
    expect(parseOcMtime('-100')).toBeNull();
  });

  it('should handle boundary value 946684800 (2000-01-01)', () => {
    const result = parseOcMtime('946684800');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2000);
  });

  it('should handle boundary value 4102444800 (2100-01-01)', () => {
    const result = parseOcMtime('4102444800');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2100);
  });

  it('should trim whitespace from valid input', () => {
    const result = parseOcMtime('  1609459200  ');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1609459200 * 1000);
  });
});

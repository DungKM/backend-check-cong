const { decodeBirthYearFromCCCD, checkNgaySinh } = require('../../../reconciliation/checkNgaySinh');

describe('decodeBirthYearFromCCCD', () => {
  test('decodes thế kỷ 20 nam (digit 0)', () => {
    expect(decodeBirthYearFromCCCD('001054010978')).toBe(1954);
  });

  test('decodes thế kỷ 21 nữ (digit 3)', () => {
    expect(decodeBirthYearFromCCCD('001398010978')).toBe(2098);
  });

  test('not 12 digits -> null', () => {
    expect(decodeBirthYearFromCCCD('12345')).toBeNull();
    expect(decodeBirthYearFromCCCD('')).toBeNull();
    expect(decodeBirthYearFromCCCD(undefined)).toBeNull();
  });

  test('non-numeric characters -> null', () => {
    expect(decodeBirthYearFromCCCD('00105401097A')).toBeNull();
  });
});

describe('checkNgaySinh', () => {
  test('missing số CCCD -> nothing to check', () => {
    expect(checkNgaySinh({ ngaySinh: new Date('1954-03-28') })).toBeNull();
  });

  test('missing ngày sinh -> nothing to check', () => {
    expect(checkNgaySinh({ soCCCD: '001054010978' })).toBeNull();
  });

  test('năm sinh khớp số CCCD -> no flag', () => {
    const note = checkNgaySinh({ soCCCD: '001054010978', ngaySinh: new Date(Date.UTC(1954, 2, 28)) });
    expect(note).toBeNull();
  });

  test('năm sinh lệch số CCCD -> flagged with a ghi chú message', () => {
    const note = checkNgaySinh({ soCCCD: '001054010978', ngaySinh: new Date(Date.UTC(1975, 2, 28)) });
    expect(note).toEqual(expect.stringContaining('1975'));
    expect(note).toEqual(expect.stringContaining('1954'));
  });

  test('số CCCD không hợp lệ (không đủ 12 số) -> nothing to check', () => {
    expect(checkNgaySinh({ soCCCD: '12345', ngaySinh: new Date('1954-03-28') })).toBeNull();
  });
});

const { extractMucHuongFromThe, isTraiTuyen, checkMucHuong } = require('../../../reconciliation/checkMucHuong');

describe('extractMucHuongFromThe', () => {
  test('reads mã mức hưởng digit (3rd char) and maps to %', () => {
    expect(extractMucHuongFromThe('TC3363621769845')).toBe(95);
    expect(extractMucHuongFromThe('HS4123456789012')).toBe(80);
    expect(extractMucHuongFromThe('DN1123456789012')).toBe(100);
  });

  test('too short or missing -> null', () => {
    expect(extractMucHuongFromThe('')).toBeNull();
    expect(extractMucHuongFromThe(null)).toBeNull();
    expect(extractMucHuongFromThe('TC')).toBeNull();
  });

  test('digit outside 1-5 -> null', () => {
    expect(extractMucHuongFromThe('TC9123456789012')).toBeNull();
  });
});

describe('isTraiTuyen', () => {
  test('missing maDkbd or maCSKCB -> null (không xác định được)', () => {
    expect(isTraiTuyen({ maCSKCB: '01007' })).toBeNull();
    expect(isTraiTuyen({ maDkbd: '36907' })).toBeNull();
  });

  test('has giấy chuyển tuyến -> not trái tuyến regardless of mismatch', () => {
    expect(isTraiTuyen({ maDkbd: '36907', maCSKCB: '01007', giayChuyenTuyen: 'SO123' })).toBe(false);
  });

  test('maDkbd differs from maCSKCB, no giấy chuyển tuyến -> trái tuyến', () => {
    expect(isTraiTuyen({ maDkbd: '36907', maCSKCB: '01007', giayChuyenTuyen: '' })).toBe(true);
  });

  test('maDkbd matches maCSKCB -> not trái tuyến', () => {
    expect(isTraiTuyen({ maDkbd: '01007', maCSKCB: '01007', giayChuyenTuyen: '' })).toBe(false);
  });
});

describe('checkMucHuong', () => {
  const baseRow = {
    maThe: 'TC3363621769845', // mã mức hưởng "3" -> 95%
    maDkbd: '36907',
    maCSKCB: '01007',
    giayChuyenTuyen: '',
  };

  test('mức hưởng khai báo khớp mã thẻ, không trái tuyến -> no flag', () => {
    const row = { ...baseRow, maDkbd: '01007', mucHuong: 95, tyLeTtBh: 100 };
    expect(checkMucHuong(row)).toBeNull();
  });

  test('mức hưởng khai báo khác mã thẻ -> flagged', () => {
    const row = { ...baseRow, maDkbd: '01007', mucHuong: 80, tyLeTtBh: 100 };
    const note = checkMucHuong(row);
    expect(note).toEqual(expect.stringContaining('80%'));
    expect(note).toEqual(expect.stringContaining('95%'));
  });

  test('trái tuyến nhưng tỷ lệ thanh toán vẫn 100% -> flagged', () => {
    const row = { ...baseRow, mucHuong: 95, tyLeTtBh: 100 };
    const note = checkMucHuong(row);
    expect(note).toEqual(expect.stringContaining('trái tuyến'));
    expect(note).toEqual(expect.stringContaining('36907'));
    expect(note).toEqual(expect.stringContaining('01007'));
  });

  test('trái tuyến với tỷ lệ thanh toán đã giảm trừ (<100%) -> no flag', () => {
    const row = { ...baseRow, mucHuong: 95, tyLeTtBh: 40 };
    expect(checkMucHuong(row)).toBeNull();
  });

  test('có giấy chuyển tuyến hợp lệ -> không bị flag dù mã DKBD khác CSKCB', () => {
    const row = { ...baseRow, giayChuyenTuyen: 'SO123', mucHuong: 95, tyLeTtBh: 100 };
    expect(checkMucHuong(row)).toBeNull();
  });

  test('thiếu dữ liệu (mã thẻ/mã DKBD) -> no flag (không đủ căn cứ)', () => {
    expect(checkMucHuong({ mucHuong: 95, tyLeTtBh: 100 })).toBeNull();
  });
});

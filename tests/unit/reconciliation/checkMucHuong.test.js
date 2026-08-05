const {
  extractMucHuongFromThe,
  extractDoiTuongFromThe,
  isTraiTuyen,
  buildBenefitRateMap,
  checkMucHuong,
} = require('../../../reconciliation/checkMucHuong');

const capCuuHeaders = ['Bệnh nhân cấp cứu', 'CẤP CỨU', 'cap cuu'];
const tuDenHeaders = ['Người bệnh tự đến', 'BN tự đi khám', 'tự tới khám bệnh'];

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

describe('extractDoiTuongFromThe', () => {
  test('reads first 2 chars of mã thẻ, uppercased', () => {
    expect(extractDoiTuongFromThe('tc3010124582880')).toBe('TC');
    expect(extractDoiTuongFromThe('HT4123456789012')).toBe('HT');
  });

  test('too short or missing -> null', () => {
    expect(extractDoiTuongFromThe('')).toBeNull();
    expect(extractDoiTuongFromThe(null)).toBeNull();
    expect(extractDoiTuongFromThe('T')).toBeNull();
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

  test.each(capCuuHeaders)(
    'LY_DO_VV cấp cứu "%s" -> not trái tuyến dù maDkbd khác maCSKCB',
    (lyDoVv) => {
      expect(isTraiTuyen({ maDkbd: '36907', maCSKCB: '01007', giayChuyenTuyen: '', lyDoVv })).toBe(
        false
      );
    }
  );

  test.each(tuDenHeaders)(
    'thiếu maDkbd/maCSKCB nhưng LY_DO_VV "%s" -> trái tuyến',
    (lyDoVv) => {
      expect(isTraiTuyen({ giayChuyenTuyen: '', lyDoVv })).toBe(true);
    }
  );

  test('thiếu maDkbd/maCSKCB và LY_DO_VV không khớp từ khóa nào -> null', () => {
    expect(isTraiTuyen({ giayChuyenTuyen: '', lyDoVv: 'Người bệnh khám định kỳ' })).toBeNull();
  });

  test('mã đối tượng KCB nhóm "1" -> không trái tuyến dù maDkbd khác maCSKCB (ca thực tế 1.3 tái khám)', () => {
    expect(
      isTraiTuyen({
        maDkbd: '01E54',
        maCSKCB: '01007',
        giayChuyenTuyen: '',
        maDoiTuongKCB: '1.3',
        lyDoVv: 'Tái khám',
      })
    ).toBe(false);
  });

  test('mã đối tượng KCB nhóm "2" -> vẫn trái tuyến khi maDkbd khác maCSKCB', () => {
    expect(
      isTraiTuyen({ maDkbd: '36907', maCSKCB: '01007', giayChuyenTuyen: '', maDoiTuongKCB: '2' })
    ).toBe(true);
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

describe('checkMucHuong với BenefitRateCatalog (mã đối tượng + MA_LOAI_KCB)', () => {
  const benefitRateMap = buildBenefitRateMap([
    { ma: 'TC', nhom: '2', chiTraDungTuyen: 100, chiTraTraiTuyen: 60 },
    { ma: 'HT', nhom: '4', chiTraDungTuyen: 80, chiTraTraiTuyen: 48 },
  ]);

  const baseRow = {
    maThe: 'TC3010124582880', // mã đối tượng "TC", ký tự thứ 3 "3" -> 95% (fallback theo mã thẻ)
    loaiKCB: '2',
    maDkbd: '01007',
    maCSKCB: '01007',
    giayChuyenTuyen: '',
  };

  test('đúng tuyến, mức hưởng khớp % chuẩn trong danh mục -> no flag', () => {
    const row = { ...baseRow, mucHuong: 100 };
    expect(checkMucHuong(row, benefitRateMap)).toBeNull();
  });

  test('đúng tuyến, mức hưởng không khớp % chuẩn trong danh mục -> flagged theo danh mục', () => {
    const row = { ...baseRow, mucHuong: 80 };
    const note = checkMucHuong(row, benefitRateMap);
    expect(note).toEqual(expect.stringContaining('80%'));
    expect(note).toEqual(expect.stringContaining('100%'));
    expect(note).toEqual(expect.stringContaining('"TC"'));
    expect(note).toEqual(expect.stringContaining('đúng tuyến'));
  });

  test('trái tuyến, mức hưởng khớp % trái tuyến trong danh mục -> no flag (dù khác % theo mã thẻ)', () => {
    const row = { ...baseRow, maDkbd: '36907', mucHuong: 60 };
    expect(checkMucHuong(row, benefitRateMap)).toBeNull();
  });

  test('trái tuyến nhưng vẫn khai theo % đúng tuyến -> flagged theo danh mục', () => {
    const row = { ...baseRow, maDkbd: '36907', mucHuong: 100 };
    const note = checkMucHuong(row, benefitRateMap);
    expect(note).toEqual(expect.stringContaining('trái tuyến'));
    expect(note).toEqual(expect.stringContaining('60%'));
  });

  test('không có dòng khớp (mã đối tượng, MA_LOAI_KCB) trong danh mục -> rơi về check tự-nhất-quán theo mã thẻ', () => {
    const row = {
      maThe: 'XX3010124582880', // mã đối tượng "XX" không có trong danh mục mẫu
      loaiKCB: '9',
      maDkbd: '01007',
      maCSKCB: '01007',
      giayChuyenTuyen: '',
      mucHuong: 80,
    };
    const note = checkMucHuong(row, benefitRateMap);
    expect(note).toEqual(expect.stringContaining('mã thẻ BHYT'));
  });

  test('không truyền benefitRateMap -> hành vi như trước khi có danh mục', () => {
    const row = { ...baseRow, mucHuong: 95 };
    expect(checkMucHuong(row)).toBeNull();
  });
});

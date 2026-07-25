const { isKhamBenhRow, checkKhamBenhBatch } = require('../../../reconciliation/checkKhamBenh');

describe('isKhamBenhRow', () => {
  test('tên bắt đầu bằng "Khám" -> true', () => {
    expect(isKhamBenhRow({ tenChiPhi: 'Khám Ngoại tổng hợp' })).toBe(true);
    expect(isKhamBenhRow({ tenChiPhi: 'khám nội tiêu hóa' })).toBe(true);
  });

  test('tên không bắt đầu bằng "Khám" -> false', () => {
    expect(isKhamBenhRow({ tenChiPhi: 'Xét nghiệm công thức máu' })).toBe(false);
    expect(isKhamBenhRow({ tenChiPhi: 'Tư vấn khám dinh dưỡng' })).toBe(false);
  });

  test('thiếu tenChiPhi -> false', () => {
    expect(isKhamBenhRow({})).toBe(false);
  });
});

describe('checkKhamBenhBatch', () => {
  test('cùng mã dịch vụ khám dùng 2 lần trong 1 hồ sơ -> flagged', () => {
    const rows = [
      { maLK: 'LK001', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp' },
      { maLK: 'LK001', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp' },
    ];
    const notes = checkKhamBenhBatch(rows);
    expect(notes.get('LK001|10.19')).toEqual(expect.stringContaining('2 lần'));
  });

  test('mã dịch vụ khám chỉ dùng 1 lần -> no flag', () => {
    const rows = [{ maLK: 'LK001', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp' }];
    expect(checkKhamBenhBatch(rows).size).toBe(0);
  });

  test('2 mã dịch vụ khám KHÁC NHAU trong cùng hồ sơ (2 chuyên khoa) -> không flag', () => {
    const rows = [
      { maLK: 'LK001', maChiPhi: '02.05', tenChiPhi: 'Khám Nội tiêu hóa' },
      { maLK: 'LK001', maChiPhi: '02.08', tenChiPhi: 'Khám Nội tiết' },
    ];
    expect(checkKhamBenhBatch(rows).size).toBe(0);
  });

  test('cùng mã dịch vụ nhưng khác hồ sơ -> mỗi hồ sơ tính riêng, không flag', () => {
    const rows = [
      { maLK: 'LK001', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp' },
      { maLK: 'LK002', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp' },
    ];
    expect(checkKhamBenhBatch(rows).size).toBe(0);
  });

  test('dòng không phải khám bệnh không được tính dù trùng mã', () => {
    const rows = [
      { maLK: 'LK001', maChiPhi: 'X1', tenChiPhi: 'Xét nghiệm công thức máu' },
      { maLK: 'LK001', maChiPhi: 'X1', tenChiPhi: 'Xét nghiệm công thức máu' },
    ];
    expect(checkKhamBenhBatch(rows).size).toBe(0);
  });
});

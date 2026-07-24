const {
  sumGiuongSoLuong,
  computeExpectedNgayDieuTri,
  checkNgayGiuongBatch,
} = require('../../../reconciliation/checkNgayGiuong');

function d(str) {
  return new Date(str);
}

function giuongRow(overrides) {
  return {
    maLK: 'LK001',
    maGiuong: 'T021',
    soLuong: 1,
    ngayVaoNoiTru: d('2024-06-01T09:00:00Z'),
    ngayRa: d('2024-06-03T11:00:00Z'), // 2 ngày theo công thức mặc định
    ...overrides,
  };
}

describe('sumGiuongSoLuong', () => {
  test('sums only rows with maGiuong set', () => {
    const rows = [giuongRow({ soLuong: 1 }), giuongRow({ soLuong: 0.5 }), { maLK: 'LK001', maGiuong: '', soLuong: 100 }];
    expect(sumGiuongSoLuong(rows)).toBe(1.5);
  });

  test('non-numeric soLuong is ignored', () => {
    expect(sumGiuongSoLuong([giuongRow({ soLuong: 'abc' })])).toBe(0);
  });
});

describe('computeExpectedNgayDieuTri', () => {
  test('nằm viện <= 4h -> 0 ngày', () => {
    expect(computeExpectedNgayDieuTri(d('2024-06-01T08:00:00Z'), d('2024-06-01T12:00:00Z'))).toBe(0);
  });

  test('nằm viện > 4h và < 24h -> 1 ngày', () => {
    expect(computeExpectedNgayDieuTri(d('2024-06-01T08:00:00Z'), d('2024-06-01T20:00:00Z'))).toBe(1);
  });

  test('nằm viện nhiều ngày -> ngày ra - ngày vào, KHÔNG +1', () => {
    expect(computeExpectedNgayDieuTri(d('2024-06-28T09:26:00Z'), d('2024-06-30T11:00:00Z'))).toBe(2);
  });

  test('thiếu ngày vào hoặc ngày ra -> null', () => {
    expect(computeExpectedNgayDieuTri(null, d('2024-06-01'))).toBeNull();
    expect(computeExpectedNgayDieuTri(d('2024-06-01'), null)).toBeNull();
  });
});

describe('checkNgayGiuongBatch', () => {
  test('billing thừa so với công thức mặc định -> flagged (ca thực tế 2606280054)', () => {
    const rows = [
      giuongRow({ soLuong: 0.5, ngayVaoNoiTru: d('2026-06-28T09:26:00Z'), ngayRa: d('2026-06-30T11:00:00Z') }),
      giuongRow({ soLuong: 0.5, ngayVaoNoiTru: d('2026-06-28T09:26:00Z'), ngayRa: d('2026-06-30T11:00:00Z') }),
      giuongRow({ soLuong: 1, ngayVaoNoiTru: d('2026-06-28T09:26:00Z'), ngayRa: d('2026-06-30T11:00:00Z') }),
      giuongRow({ soLuong: 1, ngayVaoNoiTru: d('2026-06-28T09:26:00Z'), ngayRa: d('2026-06-30T11:00:00Z') }),
    ];
    const notes = checkNgayGiuongBatch(rows);
    expect(notes.get('LK001')).toEqual(expect.stringContaining('3'));
    expect(notes.get('LK001')).toEqual(expect.stringContaining('2'));
  });

  test('billing khớp đúng công thức mặc định -> no flag', () => {
    const rows = [giuongRow({ soLuong: 1 }), giuongRow({ soLuong: 1 })]; // 2 ngày, khớp
    expect(checkNgayGiuongBatch(rows).size).toBe(0);
  });

  test('billing ÍT hơn công thức mặc định -> không flag (thiếu ngày không phải lỗi BHXH quan tâm)', () => {
    const rows = [giuongRow({ soLuong: 1 })]; // chỉ 1, trong khi công thức mặc định = 2
    expect(checkNgayGiuongBatch(rows).size).toBe(0);
  });

  test('hồ sơ không có dòng giường nào -> không so sánh, không flag', () => {
    const rows = [{ maLK: 'LK002', maChiPhi: 'T001', ngayVaoNoiTru: d('2024-06-01'), ngayRa: d('2024-06-05') }];
    expect(checkNgayGiuongBatch(rows).size).toBe(0);
  });

  test('thiếu ngày vào/ngày ra trên mọi dòng -> không thể tính, không flag', () => {
    const rows = [giuongRow({ soLuong: 5, ngayVaoNoiTru: null, ngayRa: null })];
    expect(checkNgayGiuongBatch(rows).size).toBe(0);
  });

  test('ưu tiên ngayVaoNoiTru, chỉ dùng ngayVao khi thiếu ngayVaoNoiTru', () => {
    const rows = [
      giuongRow({
        soLuong: 5,
        ngayVaoNoiTru: null,
        ngayVao: d('2024-06-01T09:00:00Z'),
        ngayRa: d('2024-06-03T11:00:00Z'),
      }),
    ];
    const notes = checkNgayGiuongBatch(rows);
    expect(notes.get('LK001')).toEqual(expect.stringContaining('5'));
    expect(notes.get('LK001')).toEqual(expect.stringContaining('2'));
  });

  test('ghi chú kèm KET_QUA_DTRI/MA_LOAI_RV thô để người dùng tự đối chiếu, không tự loại trừ', () => {
    const rows = [
      giuongRow({ soLuong: 1, ketQuaDieuTri: '2', maLoaiRaVien: '5' }),
      giuongRow({ soLuong: 1, ketQuaDieuTri: '2', maLoaiRaVien: '5' }),
      giuongRow({ soLuong: 1, ketQuaDieuTri: '2', maLoaiRaVien: '5' }),
    ];
    const note = checkNgayGiuongBatch(rows).get('LK001');
    expect(note).toEqual(expect.stringContaining('KET_QUA_DTRI=2'));
    expect(note).toEqual(expect.stringContaining('MA_LOAI_RV=5'));
  });

  test('nhiều hồ sơ độc lập -> chỉ hồ sơ vượt công thức mới bị flag', () => {
    const rows = [
      giuongRow({ maLK: 'LK001', soLuong: 1 }), // 1 <= 2, ok
      giuongRow({ maLK: 'LK002', soLuong: 3 }), // 3 > 2, flag
    ];
    const notes = checkNgayGiuongBatch(rows);
    expect(notes.has('LK001')).toBe(false);
    expect(notes.has('LK002')).toBe(true);
  });
});

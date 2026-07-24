const { findHeaderRow, ParseError } = require('../../../parsers/excelHeaderFinder');

// Minimal fake "row" objects mimicking the subset of the ExcelJS Row API
// (eachCell) that findHeaderRow depends on, so this test needs no real .xlsx file.
function fakeRow(values) {
  return {
    eachCell(_opts, callback) {
      values.forEach((value, idx) => {
        if (value === null || value === undefined || value === '') return;
        callback({ text: String(value), value }, idx + 1);
      });
    },
  };
}

const aliasMap = {
  maThuoc: ['ma_thuoc', 'ma thuoc'],
  tenThuoc: ['ten_thuoc', 'ten thuoc'],
  donViTinh: ['don_vi_tinh', 'don vi tinh'],
  hamLuong: ['ham_luong', 'ham luong'],
  soDangKy: ['so_dang_ky', 'so dang ky'],
};

describe('findHeaderRow', () => {
  test('finds header on row 1 when it is the first row', () => {
    const rows = {
      1: fakeRow(['MA_THUOC', 'TEN_THUOC', 'DON_VI_TINH', 'HAM_LUONG', 'SO_DANG_KY']),
      2: fakeRow(['T001', 'Paracetamol', 'Vien', '500mg', 'VD-1']),
    };
    const { rowNumber, colMap } = findHeaderRow((r) => rows[r], aliasMap);
    expect(rowNumber).toBe(1);
    expect(colMap.maThuoc).toBe(1);
    expect(colMap.tenThuoc).toBe(2);
  });

  test('finds header row after leading metadata rows (e.g. row 6)', () => {
    const rows = {
      1: fakeRow(['Báo cáo lỗi tự động']),
      2: fakeRow(['Tháng 6/2026']),
      3: fakeRow([]),
      4: fakeRow(['Bệnh viện ABC']),
      5: fakeRow([]),
      6: fakeRow(['MA_THUOC', 'TEN_THUOC', 'DON_VI_TINH', 'HAM_LUONG', 'SO_DANG_KY']),
      7: fakeRow(['T001', 'Paracetamol', 'Vien', '500mg', 'VD-1']),
    };
    const { rowNumber, colMap } = findHeaderRow((r) => rows[r] || fakeRow([]), aliasMap, {
      maxScanRows: 15,
    });
    expect(rowNumber).toBe(6);
    expect(colMap.maThuoc).toBe(1);
  });

  test('throws a descriptive ParseError when no row clears the match threshold', () => {
    const rows = {
      1: fakeRow(['foo', 'bar']),
      2: fakeRow(['baz', 'qux']),
    };
    expect(() =>
      findHeaderRow((r) => rows[r] || fakeRow([]), aliasMap, { maxScanRows: 5, minMatches: 3 })
    ).toThrow(ParseError);
  });
});

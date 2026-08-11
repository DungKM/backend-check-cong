const { compareDrugFields, compareServiceFields, compareVatTuFields } = require('../../../reconciliation/compareFields');

describe('compareDrugFields', () => {
  const catalogRow = {
    donViTinh: 'Viên',
    hamLuong: '500mg',
    soDangKy: 'VD-12345-19',
  };

  test('all fields match -> empty diff', () => {
    const errorRow = { donViTinh: 'Viên', hamLuong: '500mg', soDangKy: 'VD-12345-19' };
    expect(compareDrugFields(errorRow, catalogRow)).toEqual([]);
  });

  test('hàm lượng differs -> flagged', () => {
    const errorRow = { donViTinh: 'Viên', hamLuong: '250mg', soDangKy: 'VD-12345-19' };
    const diff = compareDrugFields(errorRow, catalogRow);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ truong: 'Hàm lượng', giaTriXML: '250mg', giaTriDanhMuc: '500mg' });
  });

  test('trailing whitespace / case differences are NOT flagged', () => {
    const errorRow = { donViTinh: 'viên ', hamLuong: '500MG', soDangKy: 'vd-12345-19' };
    expect(compareDrugFields(errorRow, catalogRow)).toEqual([]);
  });

  test('số đăng ký differs -> flagged', () => {
    const errorRow = { donViTinh: 'Viên', hamLuong: '500mg', soDangKy: 'VD-99999-19' };
    const diff = compareDrugFields(errorRow, catalogRow);
    expect(diff).toEqual([
      { truong: 'Số đăng ký', giaTriXML: 'VD-99999-19', giaTriDanhMuc: 'VD-12345-19' },
    ]);
  });

  test('multiple fields differ simultaneously -> all present', () => {
    const errorRow = { donViTinh: 'Ống', hamLuong: '250mg', soDangKy: 'VD-99999-19' };
    const diff = compareDrugFields(errorRow, catalogRow);
    expect(diff).toHaveLength(3);
    const fields = diff.map((d) => d.truong).sort();
    expect(fields).toEqual(['Hàm lượng', 'Số đăng ký', 'Đơn vị tính'].sort());
  });
});

describe('compareServiceFields', () => {
  test('tên dịch vụ differs -> flagged', () => {
    const errorRow = { tenChiPhi: 'Khám nội khoa' };
    const catalogRow = { tenDvktPheDuyet: 'Khám ngoại khoa' };
    const diff = compareServiceFields(errorRow, catalogRow);
    expect(diff).toEqual([
      { truong: 'Tên dịch vụ', giaTriXML: 'Khám nội khoa', giaTriDanhMuc: 'Khám ngoại khoa' },
    ]);
  });

  test('catalog row missing comparable field does not crash', () => {
    const errorRow = { tenChiPhi: 'Khám nội khoa' };
    const catalogRow = { tenDvktPheDuyet: undefined };
    expect(() => compareServiceFields(errorRow, catalogRow)).not.toThrow();
    expect(compareServiceFields(errorRow, catalogRow)).toEqual([
      { truong: 'Tên dịch vụ', giaTriXML: 'Khám nội khoa', giaTriDanhMuc: '' },
    ]);
  });

  test('matching names (normalized) -> empty diff', () => {
    const errorRow = { tenChiPhi: 'kham noi khoa' };
    const catalogRow = { tenDvktPheDuyet: 'Khám Nội Khoa' };
    expect(compareServiceFields(errorRow, catalogRow)).toEqual([]);
  });
});

describe('compareVatTuFields', () => {
  test('all fields match -> empty diff', () => {
    const errorRow = { tenChiPhi: 'Kim luồn tĩnh mạch', donGia: 15000 };
    const catalogRow = { tenVatTu: 'Kim luồn tĩnh mạch', donGiaBH: 15000 };
    expect(compareVatTuFields(errorRow, catalogRow)).toEqual([]);
  });

  test('tên vật tư differs -> flagged', () => {
    const errorRow = { tenChiPhi: 'Kim luồn tĩnh mạch 22G', donGia: 15000 };
    const catalogRow = { tenVatTu: 'Kim luồn tĩnh mạch 24G', donGiaBH: 15000 };
    const diff = compareVatTuFields(errorRow, catalogRow);
    expect(diff).toEqual([
      { truong: 'Tên vật tư', giaTriXML: 'Kim luồn tĩnh mạch 22G', giaTriDanhMuc: 'Kim luồn tĩnh mạch 24G' },
    ]);
  });

  test('đơn giá differs -> flagged', () => {
    const errorRow = { tenChiPhi: 'Băng gạc', donGia: 6000 };
    const catalogRow = { tenVatTu: 'Băng gạc', donGiaBH: 5000 };
    const diff = compareVatTuFields(errorRow, catalogRow);
    expect(diff).toEqual([
      {
        truong: 'Đơn giá',
        giaTriXML: '6000',
        giaTriDanhMuc: '5000',
        apDungTruongTag: 'DON_GIA_VAT_TU_CAO_HON',
      },
    ]);
  });

  test('donGia null/undefined (not on the claim line) -> đơn giá not compared', () => {
    const errorRow = { tenChiPhi: 'Băng gạc', donGia: null };
    const catalogRow = { tenVatTu: 'Băng gạc', donGiaBH: 5000 };
    expect(compareVatTuFields(errorRow, catalogRow)).toEqual([]);
  });
});

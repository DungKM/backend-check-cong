const { buildServiceGroupMap, checkNhomDvkt } = require('../../../reconciliation/checkNhomDvkt');

describe('buildServiceGroupMap + checkNhomDvkt', () => {
  const serviceGroupRows = [
    { ma: '10.0811.0559_GT', maNhom: '8' },
    { ma: '11.0073.0534_GT', maNhom: '5' },
  ];

  test('no ServiceGroupCatalog loaded -> no check performed', () => {
    const errorRow = { maChiPhi: '10.0811.0559_GT', maNhom: '3' };
    expect(checkNhomDvkt(errorRow, new Map())).toBeNull();
    expect(checkNhomDvkt(errorRow, undefined)).toBeNull();
  });

  test('row has no mã nhóm khai báo -> nothing to check', () => {
    const map = buildServiceGroupMap(serviceGroupRows);
    expect(checkNhomDvkt({ maChiPhi: '10.0811.0559_GT', maNhom: '' }, map)).toBeNull();
    expect(checkNhomDvkt({ maChiPhi: '10.0811.0559_GT' }, map)).toBeNull();
  });

  test('DVKT code not found in ServiceGroupCatalog -> nothing to check', () => {
    const map = buildServiceGroupMap(serviceGroupRows);
    expect(checkNhomDvkt({ maChiPhi: 'KHONG_TON_TAI', maNhom: '8' }, map)).toBeNull();
  });

  test('mã nhóm khai báo khớp mã nhóm chuẩn -> no flag', () => {
    const map = buildServiceGroupMap(serviceGroupRows);
    expect(checkNhomDvkt({ maChiPhi: '10.0811.0559_GT', maNhom: '8' }, map)).toBeNull();
  });

  test('match is whitespace-insensitive', () => {
    const map = buildServiceGroupMap(serviceGroupRows);
    expect(checkNhomDvkt({ maChiPhi: '10.0811.0559_GT', maNhom: ' 8 ' }, map)).toBeNull();
  });

  test('mã nhóm khai báo khác mã nhóm chuẩn -> flagged with a ghi chú message', () => {
    const map = buildServiceGroupMap(serviceGroupRows);
    const note = checkNhomDvkt({ maChiPhi: '10.0811.0559_GT', maNhom: '3' }, map);
    expect(note).toEqual(expect.stringContaining('10.0811.0559_GT'));
    expect(note).toEqual(expect.stringContaining('"3"'));
    expect(note).toEqual(expect.stringContaining('"8"'));
  });
});

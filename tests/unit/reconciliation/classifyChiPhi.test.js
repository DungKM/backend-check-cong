const { classifyChiPhi } = require('../../../reconciliation/classifyChiPhi');

describe('classifyChiPhi', () => {
  test('classifies "Thuốc trong danh mục BHYT" as THUOC', () => {
    expect(classifyChiPhi('Thuốc trong danh mục BHYT')).toBe('THUOC');
  });

  test('classifies "Khám bệnh" as DICH_VU', () => {
    expect(classifyChiPhi('Khám bệnh')).toBe('DICH_VU');
  });

  test('classifies "Dịch vụ kỹ thuật" as DICH_VU', () => {
    expect(classifyChiPhi('Dịch vụ kỹ thuật')).toBe('DICH_VU');
  });

  test('returns KHONG_XAC_DINH for empty/unexpected text without throwing', () => {
    expect(classifyChiPhi('')).toBe('KHONG_XAC_DINH');
    expect(classifyChiPhi(undefined)).toBe('KHONG_XAC_DINH');
    expect(classifyChiPhi('Vật liệu văn phòng phẩm không liên quan')).toBe('KHONG_XAC_DINH');
  });

  test('is case and accent insensitive', () => {
    expect(classifyChiPhi('THUỐC')).toBe('THUOC');
    expect(classifyChiPhi('thuoc')).toBe('THUOC');
  });
});

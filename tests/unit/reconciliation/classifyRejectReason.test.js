const { classifyRejectReason } = require('../../../reconciliation/classifyRejectReason');

describe('classifyRejectReason', () => {
  test('"Sai hàm lượng thuốc" -> SAI_DANH_MUC', () => {
    expect(classifyRejectReason('Sai hàm lượng thuốc').category).toBe('SAI_DANH_MUC');
  });

  test('"Sai đơn vị tính" -> SAI_DANH_MUC', () => {
    expect(classifyRejectReason('Sai đơn vị tính').category).toBe('SAI_DANH_MUC');
  });

  test('"Vượt trần thanh toán" / "Vượt định mức" -> VUOT_DINH_MUC', () => {
    expect(classifyRejectReason('Vượt trần thanh toán').category).toBe('VUOT_DINH_MUC');
    expect(classifyRejectReason('Vượt định mức quy định').category).toBe('VUOT_DINH_MUC');
  });

  test('"Đề nghị tiền khám trên 1 chuyên khoa sai quy định" -> SAI_QUY_TAC_THANH_TOAN', () => {
    expect(
      classifyRejectReason('Đề nghị tiền khám trên 1 chuyên khoa sai quy định').category
    ).toBe('SAI_QUY_TAC_THANH_TOAN');
  });

  test('unrecognized free text -> KHONG_XAC_DINH, does not throw', () => {
    expect(() => classifyRejectReason('abc xyz không rõ')).not.toThrow();
    expect(classifyRejectReason('abc xyz không rõ').category).toBe('KHONG_XAC_DINH');
    expect(classifyRejectReason('').category).toBe('KHONG_XAC_DINH');
    expect(classifyRejectReason(undefined).category).toBe('KHONG_XAC_DINH');
  });

  test('text matching keywords from two categories resolves via defined priority order', () => {
    // "vuot dinh muc" (VUOT_DINH_MUC) is checked before SAI_DANH_MUC keywords in
    // config/constants.js — first matching category wins.
    const result = classifyRejectReason('Vượt định mức và sai hàm lượng thuốc');
    expect(result.category).toBe('VUOT_DINH_MUC');
  });
});

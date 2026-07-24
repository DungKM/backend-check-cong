const {
  buildErrorCodeIndex,
  predictErrorCode,
  predictBacSiErrorCode,
  predictNgaySinhErrorCode,
} = require('../../../reconciliation/predictErrorCode');
const { KET_LUAN } = require('../../../config/constants');

function errorCodeRow(overrides) {
  return {
    maLoi: 'L000',
    tenLoi: 'Mặc định',
    dienGiai: '',
    nhomLoi: 'SAI_DANH_MUC',
    apDungTruong: '',
    mucDo: 'CANH_BAO',
    active: true,
    tuNgay: new Date('2020-01-01'),
    denNgay: null,
    ...overrides,
  };
}

describe('predictErrorCode', () => {
  test('a mã lỗi tagged to "Đơn giá" only fires for price mismatches, not hàm lượng mismatches', () => {
    const rows = [
      errorCodeRow({ maLoi: 'L001', tenLoi: 'Sai đơn giá', apDungTruong: 'Đơn giá' }),
      errorCodeRow({ maLoi: 'L002', tenLoi: 'Sai hàm lượng', apDungTruong: 'Hàm lượng' }),
    ];
    const index = buildErrorCodeIndex(rows);

    const priceMismatch = predictErrorCode(
      { ketLuan: KET_LUAN.LECH_DU_LIEU, chiTietLech: [{ truong: 'Đơn giá', giaTriXML: '1', giaTriDanhMuc: '2' }] },
      index
    );
    expect(priceMismatch.map((w) => w.maLoi)).toEqual(['L001']);

    const hamLuongMismatch = predictErrorCode(
      { ketLuan: KET_LUAN.LECH_DU_LIEU, chiTietLech: [{ truong: 'Hàm lượng', giaTriXML: 'a', giaTriDanhMuc: 'b' }] },
      index
    );
    expect(hamLuongMismatch.map((w) => w.maLoi)).toEqual(['L002']);
  });

  test('KHONG_TIM_THAY only matches mã lỗi tagged KHONG_TIM_THAY, not field-specific ones', () => {
    const rows = [
      errorCodeRow({ maLoi: 'L001', tenLoi: 'Sai đơn giá', apDungTruong: 'Đơn giá' }),
      errorCodeRow({ maLoi: 'L003', tenLoi: 'Mã không có trong danh mục', apDungTruong: 'KHONG_TIM_THAY' }),
    ];
    const index = buildErrorCodeIndex(rows);

    const result = predictErrorCode({ ketLuan: KET_LUAN.KHONG_TIM_THAY, chiTietLech: [] }, index);
    expect(result.map((w) => w.maLoi)).toEqual(['L003']);
  });

  test('untagged mã lỗi only apply as a fallback when nothing specific matched', () => {
    const rows = [
      errorCodeRow({ maLoi: 'L001', tenLoi: 'Sai đơn giá', apDungTruong: 'Đơn giá' }),
      errorCodeRow({ maLoi: 'L999', tenLoi: 'Chung chung', apDungTruong: '' }),
    ];
    const index = buildErrorCodeIndex(rows);

    // Specific match exists for "Đơn giá" -> fallback should NOT also appear.
    const priceMismatch = predictErrorCode(
      { ketLuan: KET_LUAN.LECH_DU_LIEU, chiTietLech: [{ truong: 'Đơn giá' }] },
      index
    );
    expect(priceMismatch.map((w) => w.maLoi)).toEqual(['L001']);

    // No specific tag covers "Hàm lượng" -> falls back to the untagged mã lỗi.
    const hamLuongMismatch = predictErrorCode(
      { ketLuan: KET_LUAN.LECH_DU_LIEU, chiTietLech: [{ truong: 'Hàm lượng' }] },
      index
    );
    expect(hamLuongMismatch.map((w) => w.maLoi)).toEqual(['L999']);
  });

  test('multiple distinct mismatches in one row surface multiple distinct mã lỗi', () => {
    const rows = [
      errorCodeRow({ maLoi: 'L001', tenLoi: 'Sai đơn giá', apDungTruong: 'Đơn giá' }),
      errorCodeRow({ maLoi: 'L002', tenLoi: 'Sai hàm lượng', apDungTruong: 'Hàm lượng' }),
    ];
    const index = buildErrorCodeIndex(rows);

    const result = predictErrorCode(
      {
        ketLuan: KET_LUAN.LECH_DU_LIEU,
        chiTietLech: [
          { truong: 'Đơn giá' },
          { truong: 'Hàm lượng' },
        ],
      },
      index
    );
    expect(result.map((w) => w.maLoi).sort()).toEqual(['L001', 'L002']);
  });

  test('KHONG_LIEN_QUAN_DANH_MUC (no mismatch) never predicts anything', () => {
    const rows = [errorCodeRow({ maLoi: 'L001', apDungTruong: '' })];
    const index = buildErrorCodeIndex(rows);
    const result = predictErrorCode({ ketLuan: KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC, chiTietLech: [] }, index);
    expect(result).toEqual([]);
  });
});

describe('predictBacSiErrorCode', () => {
  test('untagged mã lỗi whose tên mentions "mã bác sĩ" matches automatically, unrelated untagged codes do not', () => {
    const rows = [
      errorCodeRow({ maLoi: 'ML009', tenLoi: 'Mã bác sĩ không đúng với danh mục được duyệt', apDungTruong: '' }),
      errorCodeRow({ maLoi: 'L999', tenLoi: 'Chung chung', apDungTruong: '' }),
    ];
    const index = buildErrorCodeIndex(rows);
    const result = predictBacSiErrorCode(index);
    expect(result.map((w) => w.maLoi)).toEqual(['ML009']);
  });

  test('mã lỗi explicitly tagged apDungTruong = MA_BAC_SI also matches, even with unrelated tên', () => {
    const rows = [errorCodeRow({ maLoi: 'L777', tenLoi: 'Sai bác sĩ chỉ định', apDungTruong: 'MA_BAC_SI' })];
    const index = buildErrorCodeIndex(rows);
    expect(predictBacSiErrorCode(index).map((w) => w.maLoi)).toEqual(['L777']);
  });

  test('no mã lỗi related to bác sĩ -> empty result', () => {
    const rows = [errorCodeRow({ maLoi: 'L001', apDungTruong: 'Đơn giá' })];
    const index = buildErrorCodeIndex(rows);
    expect(predictBacSiErrorCode(index)).toEqual([]);
  });
});

describe('predictNgaySinhErrorCode', () => {
  test('untagged mã lỗi whose tên mentions "ngày sinh" matches automatically, unrelated untagged codes do not', () => {
    const rows = [
      errorCodeRow({ maLoi: 'ML011', tenLoi: 'Thẻ sai ngày sinh', apDungTruong: '' }),
      errorCodeRow({ maLoi: 'L999', tenLoi: 'Chung chung', apDungTruong: '' }),
    ];
    const index = buildErrorCodeIndex(rows);
    const result = predictNgaySinhErrorCode(index);
    expect(result.map((w) => w.maLoi)).toEqual(['ML011']);
  });

  test('mã lỗi explicitly tagged apDungTruong = NGAY_SINH also matches, even with unrelated tên', () => {
    const rows = [errorCodeRow({ maLoi: 'L777', tenLoi: 'Sai lệch thông tin cá nhân', apDungTruong: 'NGAY_SINH' })];
    const index = buildErrorCodeIndex(rows);
    expect(predictNgaySinhErrorCode(index).map((w) => w.maLoi)).toEqual(['L777']);
  });

  test('no mã lỗi related to ngày sinh -> empty result', () => {
    const rows = [errorCodeRow({ maLoi: 'L001', apDungTruong: 'Đơn giá' })];
    const index = buildErrorCodeIndex(rows);
    expect(predictNgaySinhErrorCode(index)).toEqual([]);
  });
});

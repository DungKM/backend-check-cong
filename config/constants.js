const KET_LUAN = {
  LECH_DU_LIEU: 'LECH_DU_LIEU',
  KHONG_TIM_THAY: 'KHONG_TIM_THAY',
  KHONG_LIEN_QUAN_DANH_MUC: 'KHONG_LIEN_QUAN_DANH_MUC',
};

const LOAI_CHI_PHI = {
  THUOC: 'THUOC',
  DICH_VU: 'DICH_VU',
  KHONG_XAC_DINH: 'KHONG_XAC_DINH',
};

const REJECT_REASON_CATEGORY = {
  SAI_DANH_MUC: 'SAI_DANH_MUC',
  SAI_QUY_TAC_THANH_TOAN: 'SAI_QUY_TAC_THANH_TOAN',
  VUOT_DINH_MUC: 'VUOT_DINH_MUC',
  KHONG_XAC_DINH: 'KHONG_XAC_DINH',
};

const MA_LOI_MUC_DO = {
  CANH_BAO: 'CANH_BAO',
  TU_CHOI: 'TU_CHOI',
  NGHIEM_TRONG: 'NGHIEM_TRONG',
};

// Canonical "truong" labels chiTietLech entries use (see compareFields.js), plus the
// KHONG_TIM_THAY sentinel for "mã không có trong danh mục". Shared by ErrorCodeCatalog's
// apDungTruong tag and predictErrorCode.js so a mã lỗi can be pinned to the exact kind
// of mismatch it represents instead of matching every row in its nhómLỗi.
const CHI_TIET_LECH_TRUONG = {
  DON_GIA: 'Đơn giá',
  HAM_LUONG: 'Hàm lượng',
  DON_VI_TINH: 'Đơn vị tính',
  SO_DANG_KY: 'Số đăng ký',
  TEN_DICH_VU: 'Tên dịch vụ',
};

const MA_LOI_AP_DUNG_TRUONG = {
  ...CHI_TIET_LECH_TRUONG,
  KHONG_TIM_THAY: 'KHONG_TIM_THAY',
  MA_BAC_SI: 'MA_BAC_SI',
  NGAY_SINH: 'NGAY_SINH',
};

// Keyword groups are matched against normalized (accent-stripped, lowercased) text.
// Order matters when multiple categories share keywords: first matching group wins.
const CHI_PHI_KEYWORDS = {
  [LOAI_CHI_PHI.THUOC]: ['thuoc'],
  [LOAI_CHI_PHI.DICH_VU]: [
    'dich vu',
    'kham benh',
    'xet nghiem',
    'chan doan hinh anh',
    'vat tu y te',
    'pttt',
    'giuong',
  ],
};

// Auto-detects mã lỗi rows that describe a "mã bác sĩ sai/không đúng danh mục"
// error by matching their tenLoi/dienGiai text, so predictBacSiErrorCode links
// them without requiring the admin to manually tag apDungTruong = MA_BAC_SI first.
const BAC_SI_KEYWORDS = ['ma bac si'];

// Same auto-detect role as BAC_SI_KEYWORDS above, for "thẻ sai ngày sinh" mã lỗi rows.
const NGAY_SINH_KEYWORDS = ['ngay sinh'];

const REJECT_REASON_KEYWORDS = {
  [REJECT_REASON_CATEGORY.VUOT_DINH_MUC]: ['vuot tran', 'vuot dinh muc', 'qua dinh muc'],
  [REJECT_REASON_CATEGORY.SAI_QUY_TAC_THANH_TOAN]: [
    'sai ty le thanh toan',
    'sai quy dinh thanh toan',
    'khong dung tuyen',
    'sai doi tuong',
    'tren 1 chuyen khoa',
    'sai quy dinh lam sang',
  ],
  [REJECT_REASON_CATEGORY.SAI_DANH_MUC]: [
    'sai ham luong',
    'sai don vi tinh',
    'sai so dang ky',
    'sai gia',
    'sai don gia',
    'sai ma',
    'khong dung danh muc',
    'khong co trong danh muc',
  ],
};

module.exports = {
  KET_LUAN,
  LOAI_CHI_PHI,
  REJECT_REASON_CATEGORY,
  MA_LOI_MUC_DO,
  CHI_TIET_LECH_TRUONG,
  MA_LOI_AP_DUNG_TRUONG,
  CHI_PHI_KEYWORDS,
  REJECT_REASON_KEYWORDS,
  BAC_SI_KEYWORDS,
  NGAY_SINH_KEYWORDS,
};

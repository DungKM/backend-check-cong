// Admin: toàn quyền (quản lý tài khoản, danh mục, cài đặt). Nhân viên (staff): chỉ tạo
// đối chiếu mới và xem kết quả/dashboard — không được vào danh mục hay cài đặt.
const USER_ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
};

const KET_LUAN = {
  LECH_DU_LIEU: 'LECH_DU_LIEU',
  KHONG_TIM_THAY: 'KHONG_TIM_THAY',
  KHONG_LIEN_QUAN_DANH_MUC: 'KHONG_LIEN_QUAN_DANH_MUC',
};

const LOAI_CHI_PHI = {
  THUOC: 'THUOC',
  DICH_VU: 'DICH_VU',
  VAT_TU: 'VAT_TU',
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
  TEN_VAT_TU: 'Tên vật tư',
};

const MA_LOI_AP_DUNG_TRUONG = {
  ...CHI_TIET_LECH_TRUONG,
  KHONG_TIM_THAY: 'KHONG_TIM_THAY',
  // Scoped variant of KHONG_TIM_THAY used only for "mã vật tư y tế không có
  // trong danh mục" (ML016/ML017) — kept separate from the generic
  // KHONG_TIM_THAY tag (used by ML003/ML012 for DVKT/thuốc) so a VTYT-not-found
  // row predicts only the VTYT-specific mã lỗi, not every KHONG_TIM_THAY-tagged
  // code regardless of loại chi phí. See predictErrorCode.js.
  KHONG_TIM_THAY_VAT_TU: 'KHONG_TIM_THAY_VAT_TU',
  MA_BAC_SI: 'MA_BAC_SI',
  NGAY_SINH: 'NGAY_SINH',
  NGAY_GIUONG: 'NGAY_GIUONG',
  KHAM_TRUNG_LAP: 'KHAM_TRUNG_LAP',
  NHOM_DVKT: 'NHOM_DVKT',
  MUC_HUONG: 'MUC_HUONG',
};

// Mã mức hưởng ghi trên thẻ BHYT (ký tự thứ 3 của số thẻ, VD "TC3363621769845"
// -> "3") -> % mức hưởng chuẩn. Bảng này ổn định từ khi đổi định dạng thẻ BHYT
// 15 ký tự (không đổi qua các lần sửa Luật BHYT) — dùng để đối chiếu tự-nhất-quán
// giữa MUC_HUONG khai trên XML và mã thẻ, xem checkMucHuong.js.
const MUC_HUONG_THE_MAP = {
  1: 100,
  2: 100,
  3: 95,
  4: 80,
  5: 100,
};

// Keyword groups are matched against normalized (accent-stripped, lowercased) text.
// Order matters when multiple categories share keywords: first matching group wins.
const CHI_PHI_KEYWORDS = {
  [LOAI_CHI_PHI.THUOC]: ['thuoc'],
  [LOAI_CHI_PHI.VAT_TU]: ['vat tu y te', 'vtyt', 'vat tu'],
  [LOAI_CHI_PHI.DICH_VU]: [
    'dich vu',
    'kham benh',
    'xet nghiem',
    'chan doan hinh anh',
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

// Same auto-detect role as BAC_SI_KEYWORDS above, for "thanh toán ngày giường sai quy
// định" mã lỗi rows.
const NGAY_GIUONG_KEYWORDS = ['ngay giuong'];

// Same auto-detect role as BAC_SI_KEYWORDS above, for "hồ sơ sử dụng một dịch vụ khám
// bệnh nhiều hơn 1 lần" mã lỗi rows.
const KHAM_TRUNG_LAP_KEYWORDS = ['dich vu kham benh nhieu hon'];

// Same auto-detect role as BAC_SI_KEYWORDS above, for "DVKT sai mã nhóm với danh mục
// được thực hiện" (ML004) mã lỗi rows.
const NHOM_DVKT_KEYWORDS = ['sai ma nhom', 'ma nhom dvkt', 'nhom dvkt'];

// Same auto-detect role as BAC_SI_KEYWORDS above, for "Vào viện trái tuyến, Bệnh
// viện đề nghị sai Mức hưởng" (ML015) mã lỗi rows.
const MUC_HUONG_KEYWORDS = ['sai muc huong', 'trai tuyen'];

// LY_DO_VV/LY_DO_VNT (lý do vào viện) là text tự do, mỗi bệnh viện ghi một kiểu
// khác nhau — dùng để bổ sung tín hiệu đúng/trái tuyến bên cạnh so MA_DKBD/MA_CSKCB
// và GIAY_CHUYEN_TUYEN, xem checkMucHuong.js. Danh sách chưa đầy đủ, cần bổ sung
// dần khi gặp cách ghi mới.
const LY_DO_VV_CAP_CUU_KEYWORDS = ['cap cuu'];
const LY_DO_VV_TU_DEN_KEYWORDS = ['tu den', 'tu di kham', 'tu toi kham'];
const LY_DO_VV_DUNG_TUYEN_KEYWORDS = ['tai kham', 'kham lai theo giay hen'];

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
  USER_ROLES,
  KET_LUAN,
  LOAI_CHI_PHI,
  REJECT_REASON_CATEGORY,
  MA_LOI_MUC_DO,
  CHI_TIET_LECH_TRUONG,
  MA_LOI_AP_DUNG_TRUONG,
  MUC_HUONG_THE_MAP,
  CHI_PHI_KEYWORDS,
  REJECT_REASON_KEYWORDS,
  BAC_SI_KEYWORDS,
  NGAY_SINH_KEYWORDS,
  NGAY_GIUONG_KEYWORDS,
  KHAM_TRUNG_LAP_KEYWORDS,
  NHOM_DVKT_KEYWORDS,
  MUC_HUONG_KEYWORDS,
  LY_DO_VV_CAP_CUU_KEYWORDS,
  LY_DO_VV_TU_DEN_KEYWORDS,
  LY_DO_VV_DUNG_TUYEN_KEYWORDS,
};

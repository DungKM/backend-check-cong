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
  TT_THAU: 'TT thầu',
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
  // Cùng lý do với KHONG_TIM_THAY_VAT_TU ở trên — tách riêng thuốc/DVKT để mã lỗi
  // "thuốc ngoài danh mục" (ML012) không bị gắn cho dòng DVKT không tìm thấy, và
  // ngược lại "DVKT không nằm trong danh mục" (ML003) không bị gắn cho dòng thuốc.
  KHONG_TIM_THAY_THUOC: 'KHONG_TIM_THAY_THUOC',
  KHONG_TIM_THAY_DVKT: 'KHONG_TIM_THAY_DVKT',
  MA_BAC_SI: 'MA_BAC_SI',
  // Thẻ sai ngày sinh/họ tên so với CSDL thẻ BHYT thật của BHXH (ML011/ML019) — đối
  // chiếu qua API cổng BHXH (services/bhxhEgwService.js), không còn suy đoán qua CCCD
  // như trước (đã bỏ vì sai bản chất).
  NGAY_SINH: 'NGAY_SINH',
  HO_TEN: 'HO_TEN',
  // Thẻ sai giới tính so với CSDL thẻ BHYT thật của BHXH (ML020) — cùng cơ chế đối
  // chiếu qua API cổng BHXH như NGAY_SINH/HO_TEN, nhưng API không nhận giới tính làm
  // input để BHXH tự validate, nên phải tự so response.gioiTinh với GIOI_TINH khai
  // trên XML (xem bhxhEgwService.js).
  GIOI_TINH: 'GIOI_TINH',
  NGAY_GIUONG: 'NGAY_GIUONG',
  KHAM_TRUNG_LAP: 'KHAM_TRUNG_LAP',
  NHOM_DVKT: 'NHOM_DVKT',
  MUC_HUONG: 'MUC_HUONG',
  // Riêng cho ML018 (đúng tuyến, chi phí >=15% LCS) — tách khỏi MUC_HUONG (ML015,
  // trái tuyến) vì hai mã lỗi mô tả điều kiện tuyến ngược nhau.
  MUC_HUONG_DUNG_TUYEN: 'MUC_HUONG_DUNG_TUYEN',
  // Lệch đơn giá, tách theo loại chi phí + chiều lệch (cao hơn/thấp hơn danh mục) —
  // các mã lỗi chuẩn BHYT phân biệt rõ 2 điều này (VD ML006 "giá THUỐC" chỉ áp dụng
  // khi CAO HƠN giá phê duyệt, không áp dụng cho DVKT/vật tư hay khi giá thấp hơn).
  // compareFields.js gắn đúng 1 trong 6 tag này cho mỗi lệch đơn giá — không còn rơi
  // về tag "Đơn giá" chung (generic DON_GIA ở trên) nữa, xem predictErrorCode.js.
  DON_GIA_THUOC_CAO_HON: 'DON_GIA_THUOC_CAO_HON',
  DON_GIA_THUOC_THAP_HON: 'DON_GIA_THUOC_THAP_HON',
  DON_GIA_DVKT_CAO_HON: 'DON_GIA_DVKT_CAO_HON',
  DON_GIA_DVKT_THAP_HON: 'DON_GIA_DVKT_THAP_HON',
  DON_GIA_VAT_TU_CAO_HON: 'DON_GIA_VAT_TU_CAO_HON',
  DON_GIA_VAT_TU_THAP_HON: 'DON_GIA_VAT_TU_THAP_HON',
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

// Mức lương cơ sở (LCS) theo từng giai đoạn hiệu lực — do Chính phủ quy định và
// thay đổi theo Nghị định (mốc gần nhất đã xác nhận: NĐ 24/2023/NĐ-CP hiệu lực
// 01/07/2023, NĐ 73/2024/NĐ-CP hiệu lực 01/07/2024). Dùng làm ngưỡng 15% LCS cho
// ML018 ("Vào viện đúng tuyến, Chi phí >=15% TLCS, Bệnh viện đề nghị sai Mức
// hưởng", xem checkMucHuong.js). denNgay: null nghĩa là mốc hiện đang hiệu lực —
// CẦN KIỂM TRA lại xem đã có Nghị định điều chỉnh mức lương cơ sở mới hơn chưa
// (đặc biệt nếu đối chiếu hồ sơ phát sinh gần thời điểm hiện tại) và bổ sung dòng
// mới (kèm denNgay cho dòng cũ) nếu có, tránh dùng nhầm mốc đã hết hiệu lực.
const MUC_LUONG_CO_SO_LICH_SU = [
  { tuNgay: '2019-07-01', denNgay: '2023-06-30', gia: 1490000 },
  { tuNgay: '2023-07-01', denNgay: '2024-06-30', gia: 1800000 },
  { tuNgay: '2024-07-01', denNgay: null, gia: 2340000 },
];

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

// Same auto-detect role as BAC_SI_KEYWORDS above, for "thẻ sai ngày sinh"/"thẻ sai họ
// tên" (ML011/ML019) mã lỗi rows — kết quả đối chiếu lấy từ API cổng BHXH thật (xem
// theBhxhBatchCheck.js), không phải suy đoán trong dữ liệu offline.
const NGAY_SINH_KEYWORDS = ['ngay sinh'];
const HO_TEN_KEYWORDS = ['sai ho ten', 'ho ten'];
const GIOI_TINH_KEYWORDS = ['gioi tinh'];

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

// Same auto-detect role as BAC_SI_KEYWORDS above, for "Vào viện đúng tuyến, Chi
// phí >=15% TLCS, Bệnh viện đề nghị sai Mức hưởng" (ML018) mã lỗi rows — kept
// separate from MUC_HUONG_KEYWORDS (ML015, trái tuyến) since the two describe
// opposite tuyến conditions.
const MUC_HUONG_DUNG_TUYEN_KEYWORDS = ['15% tlcs', '15% muc luong co so', 'dung tuyen'];

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
  MUC_LUONG_CO_SO_LICH_SU,
  CHI_PHI_KEYWORDS,
  REJECT_REASON_KEYWORDS,
  BAC_SI_KEYWORDS,
  NGAY_SINH_KEYWORDS,
  HO_TEN_KEYWORDS,
  GIOI_TINH_KEYWORDS,
  NGAY_GIUONG_KEYWORDS,
  KHAM_TRUNG_LAP_KEYWORDS,
  NHOM_DVKT_KEYWORDS,
  MUC_HUONG_KEYWORDS,
  MUC_HUONG_DUNG_TUYEN_KEYWORDS,
  LY_DO_VV_CAP_CUU_KEYWORDS,
  LY_DO_VV_TU_DEN_KEYWORDS,
  LY_DO_VV_DUNG_TUYEN_KEYWORDS,
};

// Canonical field name -> accepted header text variants (normalized: accent-stripped,
// lowercased, whitespace-collapsed via utils/normalizeText). Used by excelHeaderFinder
// to locate the header row and build a column-name -> column-index map, so parsing
// tolerates header text/column-order variations instead of relying on fixed indices.

const ERROR_REPORT_ALIASES = {
  stt: ['stt'],
  maBN: ['ma bn', 'ma benh nhan'],
  hoTen: ['ho ten'],
  ngayVao: ['ngay vao'],
  ngayRa: ['ngay ra'],
  loaiKCB: ['loai kcb'],
  maKhoa: ['ma khoa'],
  maBacSi: ['ma bac si'],
  loaiChiPhi: ['loai chi phi'],
  maChiPhi: ['ma chi phi'],
  tenChiPhi: ['ten chi phi'],
  soDangKy: ['so dk, gpnk benh vien', 'so dk gpnk benh vien', 'so dang ky gpnk', 'so dk gpnk', 'so dang ky'],
  ttThau: ['tt thau'],
  donViTinh: ['don vi tinh'],
  duongDung: ['duong dung'],
  hamLuong: ['ham luong'],
  deNghi: ['de nghi'],
  giamTru: ['giam tru'],
  ngayYLenh: ['ngay y lenh'],
  ngayTT: ['ngay tt'],
  lyDoTuChoi: ['ly do tu choi'],
  loaiGiamTru: ['loai giam tru'],
  sttXML: ['stt xml'],
};

const DRUG_CATALOG_ALIASES = {
  maThuoc: ['ma_thuoc', 'ma thuoc'],
  tenHoatChat: ['ten_hoat_chat', 'ten hoat chat'],
  tenThuoc: ['ten_thuoc', 'ten thuoc'],
  donViTinh: ['don_vi_tinh', 'don vi tinh'],
  hamLuong: ['ham_luong', 'ham luong'],
  duongDung: ['duong_dung', 'duong dung'],
  maDuongDung: ['ma_duong_dung', 'ma duong dung'],
  dangBaoChe: ['dang_bao_che', 'dang bao che'],
  soDangKy: ['so_dang_ky', 'so dang ky'],
  soLuong: ['so_luong', 'so luong'],
  donGia: ['don_gia', 'don gia'],
  donGiaBH: ['don_gia_bh', 'don gia bh'],
  quyCach: ['quy_cach', 'quy cach'],
  nhaSx: ['nha_sx', 'nha sx'],
  nuocSx: ['nuoc_sx', 'nuoc sx'],
  nhaThau: ['nha_thau', 'nha thau'],
  ttThau: ['tt_thau', 'tt thau'],
  tuNgay: ['tu_ngay', 'tu ngay'],
  denNgay: ['den_ngay', 'den ngay'],
  maCSKCB: ['ma_cskcb', 'ma cskcb'],
  loaiThuoc: ['loai_thuoc', 'loai thuoc'],
  loaiThau: ['loai_thau', 'loai thau'],
  htThau: ['ht_thau', 'ht thau'],
};

const SERVICE_CATALOG_ALIASES = {
  maTuongDuong: ['ma_tuong_duong', 'ma tuong duong'],
  tenDvktPheDuyet: ['ten_dvkt_pheduyet', 'ten dvkt pheduyet', 'ten dvkt phe duyet'],
  donGia: ['don_gia', 'don gia'],
  tuNgay: ['tungay', 'tu ngay'],
  denNgay: ['denngay', 'den ngay'],
};

const DOCTOR_CATALOG_ALIASES = {
  hoTen: ['ho_ten', 'ho ten'],
  maCCHN: ['macchn', 'ma_cchn', 'ma cchn', 'so cchn', 'so_cchn', 'so cchn hanh nghe'],
  maCSKCB: ['ma_cskcb', 'ma cskcb'],
};

const ERROR_CODE_CATALOG_ALIASES = {
  maLoi: ['ma_loi', 'ma loi'],
  tenLoi: ['ten_loi', 'ten loi'],
  dienGiai: ['dien_giai', 'dien giai', 'mo ta'],
  nhomLoi: ['nhom_loi', 'nhom loi'],
  apDungTruong: ['ap_dung_truong', 'ap dung truong', 'ap dung cho'],
  mucDo: ['muc_do', 'muc do'],
  ghiChu: ['ghi_chu', 'ghi chu'],
  tuNgay: ['tu_ngay', 'tu ngay'],
  denNgay: ['den_ngay', 'den ngay'],
};

// Dùng để đối chiếu MA_NHOM trên XML với mã nhóm chuẩn theo dịch vụ — MA là mã dịch
// vụ/thủ thuật chi tiết (có thể có đuôi phân loại, VD "_GT"), MA_NHOM là mã nhóm chi phí
// chuẩn cần so sánh.
const SERVICE_GROUP_CATALOG_ALIASES = {
  ma: ['ma'],
  ten: ['ten'],
  loaiPTTT: ['loaipttt', 'loai pttt'],
  maGia: ['magia', 'ma gia'],
  tenGia: ['tengia', 'ten gia'],
  gia: ['gia'],
  giaSau: ['giasau', 'gia sau'],
  ghiChu: ['ghichu', 'ghi chu'],
  maNhom: ['manhom_5937', 'manhom', 'ma nhom', 'ma_nhom'],
};

const VAT_TU_CATALOG_ALIASES = {
  maVatTu: ['ma_vat_tu', 'ma vat tu'],
  nhomVatTu: ['nhom_vat_tu', 'nhom vat tu'],
  tenVatTu: ['ten_vat_tu', 'ten vat tu'],
  maHieu: ['ma_hieu', 'ma hieu'],
  hangSx: ['hang_sx', 'hang sx'],
  donViTinh: ['don_vi_tinh', 'don vi tinh'],
  donGia: ['don_gia', 'don gia'],
  donGiaBH: ['don_gia_bh', 'don gia bh'],
  tyLeTtBh: ['tyle_tt_bh', 'tyle tt bh'],
  soLuong: ['so_luong', 'so luong'],
  dinhMuc: ['dinh_muc', 'dinh muc'],
  nhaThau: ['nha_thau', 'nha thau'],
  ttThau: ['tt_thau', 'tt thau'],
  maCSKCB: ['ma_cskcb', 'ma cskcb'],
  loaiThau: ['loai_thau', 'loai thau'],
  htThau: ['ht_thau', 'ht thau'],
};

// Dùng để đối chiếu MUC_HUONG trên XML3 (checkMucHuong.js): MA là 2 ký tự đầu MA_THE_BHYT
// (mã đối tượng), NHOM là MA_LOAI_KCB — cùng cặp (MA, NHOM) tra ra % chi trả đúng/trái tuyến.
const BENEFIT_RATE_CATALOG_ALIASES = {
  ma: ['ma'],
  nhom: ['nhom'],
  chiTraDungTuyen: ['chitradungtuyen', 'chi tra dung tuyen', 'chi_tra_dung_tuyen'],
  chiTraTraiTuyen: ['chitratraituyen', 'chi tra trai tuyen', 'chi_tra_trai_tuyen'],
};

module.exports = {
  ERROR_REPORT_ALIASES,
  DRUG_CATALOG_ALIASES,
  SERVICE_CATALOG_ALIASES,
  ERROR_CODE_CATALOG_ALIASES,
  DOCTOR_CATALOG_ALIASES,
  SERVICE_GROUP_CATALOG_ALIASES,
  VAT_TU_CATALOG_ALIASES,
  BENEFIT_RATE_CATALOG_ALIASES,
};

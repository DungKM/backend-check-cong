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
  tenThuoc: ['ten_thuoc', 'ten thuoc'],
  donViTinh: ['don_vi_tinh', 'don vi tinh'],
  hamLuong: ['ham_luong', 'ham luong'],
  soDangKy: ['so_dang_ky', 'so dang ky'],
  donGiaBH: ['don_gia_bh', 'don gia bh'],
  ttThau: ['tt_thau', 'tt thau'],
  tuNgay: ['tu_ngay', 'tu ngay'],
  denNgay: ['den_ngay', 'den ngay'],
  maCSKCB: ['ma_cskcb', 'ma cskcb'],
};

const SERVICE_CATALOG_ALIASES = {
  maTuongDuong: ['ma_tuong_duong', 'ma tuong duong'],
  tenDvktPheDuyet: ['ten_dvkt_pheduyet', 'ten dvkt pheduyet', 'ten dvkt phe duyet'],
  donGia: ['don_gia', 'don gia'],
  tuNgay: ['tungay', 'tu ngay'],
  denNgay: ['denngay', 'den ngay'],
  maCSKCB: ['ma_cskcb', 'ma cskcb'],
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

module.exports = {
  ERROR_REPORT_ALIASES,
  DRUG_CATALOG_ALIASES,
  SERVICE_CATALOG_ALIASES,
  ERROR_CODE_CATALOG_ALIASES,
  DOCTOR_CATALOG_ALIASES,
};

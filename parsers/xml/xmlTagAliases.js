// Canonical internal field -> accepted XML tag names, mirroring the role of
// ../columnAliases.js for the Excel parsers. This is the single place to edit
// when a real BHYT XML sample surfaces a tag name variant not listed here.
//
// Confirmed against a real GIAMDINHHS sample: XML1 = TONG_HOP (case header),
// XML2 = CHITIEU_CHITIET_THUOC (drug lines), XML3 = CHITIEU_CHITIET_DVKT_VTYT
// (service/DVKT lines). XML4/5/7/8 carry no cost fields and are not mapped here.

const XML1_ALIASES = {
  maLK: ['MA_LK'],
  maBN: ['MA_BN'],
  hoTen: ['HO_TEN'],
  maCSKCB: ['MA_CSKCB'],
  ngayVao: ['NGAY_VAO'],
  ngayRa: ['NGAY_RA'],
  maKhoa: ['MA_KHOA'],
  ngaySinh: ['NGAY_SINH'],
  soCCCD: ['SO_CCCD'],
  soNgayDieuTri: ['SO_NGAY_DTRI'],
  ngayVaoNoiTru: ['NGAY_VAO_NOI_TRU'],
  ketQuaDieuTri: ['KET_QUA_DTRI'],
  maLoaiRaVien: ['MA_LOAI_RV'],
  // Dùng để xác định trái tuyến (checkMucHuong.js): MA_THE_BHYT chứa mã mức hưởng
  // (ký tự thứ 3), MA_DKBD là nơi đăng ký KCB ban đầu để so với MA_CSKCB (nơi khám
  // thực tế), GIAY_CHUYEN_TUYEN không rỗng nghĩa là có giấy chuyển tuyến hợp lệ,
  // MA_LOAI_KCB populates ClaimItem.loaiKCB (trước đây khai báo trên schema nhưng
  // chưa từng được parse).
  maThe: ['MA_THE_BHYT'],
  maDkbd: ['MA_DKBD'],
  giayChuyenTuyen: ['GIAY_CHUYEN_TUYEN'],
  maLoaiKCB: ['MA_LOAI_KCB'],
};

const XML2_ALIASES = {
  maLK: ['MA_LK'],
  maChiPhi: ['MA_THUOC'],
  tenChiPhi: ['TEN_THUOC'],
  donViTinh: ['DON_VI_TINH'],
  hamLuong: ['HAM_LUONG'],
  soDangKy: ['SO_DANG_KY'],
  ttThau: ['TT_THAU'],
  donGia: ['DON_GIA'],
  soLuong: ['SO_LUONG'],
  deNghi: ['THANH_TIEN_BH'],
  ngayYLenh: ['NGAY_YL'],
  maKhoa: ['MA_KHOA'],
  maBacSi: ['MA_BAC_SI'],
  // Mức hưởng (%) và tỷ lệ thanh toán BHYT áp dụng cho dòng chi phí — dùng để đối
  // chiếu trái tuyến, xem checkMucHuong.js.
  mucHuong: ['MUC_HUONG'],
  tyLeTtBh: ['TYLE_TT_BH'],
};

// CHITIEU_CHITIET_DVKT_VTYT (XML3) mixes two line kinds: dịch vụ kỹ thuật (MA_DICH_VU)
// and vật tư y tế (MA_VAT_TU, e.g. "N03.01.070.0976.000.0007" — a different code format,
// no matching master catalog yet). Only MA_DICH_VU lines are reconciled for now; VTYT
// lines are recognized and skipped explicitly (see xmlClaimParser.buildCostRow) rather
// than silently mismatched against the DVKT catalog.
const XML3_ALIASES = {
  maLK: ['MA_LK'],
  maChiPhi: ['MA_DICH_VU'],
  maVatTu: ['MA_VAT_TU'],
  tenChiPhi: ['TEN_DICH_VU'],
  donGia: ['DON_GIA_BH'],
  ttThau: ['TT_THAU'],
  soLuong: ['SO_LUONG'],
  deNghi: ['THANH_TIEN_BH'],
  ngayYLenh: ['NGAY_YL'],
  maKhoa: ['MA_KHOA'],
  maBacSi: ['MA_BAC_SI'],
  // Non-empty only on ngày-giường (bed-day) DVKT lines — the reliable signal for
  // "this line is a bed charge", unlike keyword-matching TEN_DICH_VU (see checkNgayGiuong.js).
  maGiuong: ['MA_GIUONG'],
  // Mã nhóm chi phí (theo QĐ 5937) mà cơ sở khai báo khi thanh toán DVKT — đối chiếu
  // với MANHOM_5937 chuẩn theo mã DVKT trong ServiceGroupCatalog, xem checkNhomDvkt.js.
  maNhom: ['MA_NHOM'],
  // Mức hưởng (%) và tỷ lệ thanh toán BHYT áp dụng cho dòng chi phí — dùng để đối
  // chiếu trái tuyến, xem checkMucHuong.js.
  mucHuong: ['MUC_HUONG'],
  tyLeTtBh: ['TYLE_TT_BH'],
};

// XML types that carry cost/claim-line data consumable by the reconciliation engine.
// XML4 (CLS results), XML5 (diễn biến lâm sàng), XML7 (giấy ra viện), XML8 (tóm tắt
// hồ sơ bệnh án) are clinical/administrative only — parsed and stored if needed later,
// but never turned into ClaimItem rows.
const COST_XML_TYPES = {
  XML2: { aliases: XML2_ALIASES, loaiChiPhi: 'THUOC', detailTag: 'CHI_TIET_THUOC' },
  XML3: { aliases: XML3_ALIASES, loaiChiPhi: 'DICH_VU', detailTag: 'CHI_TIET_DVKT' },
};

module.exports = { XML1_ALIASES, XML2_ALIASES, XML3_ALIASES, COST_XML_TYPES };

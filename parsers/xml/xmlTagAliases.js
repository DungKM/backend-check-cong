// Canonical internal field -> accepted XML tag names, mirroring the role of
// ../columnAliases.js for the Excel parsers. This is the single place to edit
// when a real BHYT XML sample surfaces a tag name variant not listed here.
//
// Confirmed against a real GIAMDINHHS sample: XML1 = TONG_HOP (case header),
// XML2 = CHITIEU_CHITIET_THUOC (drug lines), XML3 = CHITIEU_CHITIET_DVKT_VTYT
// (service/DVKT lines). XML4/5/7/8/13 carry no cost fields, so they have no aliases
// table here — see XML_DETAIL_CONFIG below for how their raw records are still
// extracted for the per-file XML detail viewer.

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
  // STT của dòng trong XML gốc — khoá nối giữa ClaimItem và bản ghi thô lưu ở
  // ClaimXmlDetail (xem xmlClaimParser.js), dùng để đánh dấu cảnh báo đúng dòng
  // trên bảng chi tiết theo file.
  stt: ['STT'],
};

// CHITIEU_CHITIET_DVKT_VTYT (XML3) mixes two line kinds: dịch vụ kỹ thuật (MA_DICH_VU,
// reconciled against ServiceCatalogMaster) and vật tư y tế (MA_VAT_TU, e.g.
// "N03.01.070.0976.000.0007" — a different code format, reconciled against
// VatTuCatalogMaster). xmlClaimParser.buildCostRow tells the two apart by which of
// MA_DICH_VU/MA_VAT_TU is present on the line and tags loaiChiPhi accordingly.
const XML3_ALIASES = {
  maLK: ['MA_LK'],
  maChiPhi: ['MA_DICH_VU'],
  maVatTu: ['MA_VAT_TU'],
  tenChiPhi: ['TEN_DICH_VU'],
  tenVatTu: ['TEN_VAT_TU'],
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
  // Xem ghi chú ở XML2_ALIASES.stt.
  stt: ['STT'],
};

// XML types that carry cost/claim-line data consumable by the reconciliation engine.
// XML4 (CLS results), XML5 (diễn biến lâm sàng), XML7 (giấy ra viện), XML8 (tóm tắt
// hồ sơ bệnh án) are clinical/administrative only — parsed and stored (see
// XML_DETAIL_CONFIG below, for the per-file XML detail viewer) but never turned into
// ClaimItem rows.
const COST_XML_TYPES = {
  XML2: { aliases: XML2_ALIASES, loaiChiPhi: 'THUOC', detailTag: 'CHI_TIET_THUOC' },
  XML3: { aliases: XML3_ALIASES, loaiChiPhi: 'DICH_VU', detailTag: 'CHI_TIET_DVKT' },
};

// How to pull raw (un-normalized) records out of each XML type's decoded document, for
// the per-file "xem theo tab XML1..XML13" detail viewer (ClaimXmlDetail). `detailTag` types
// hold a repeating array (found at any depth via findArrayByKey, same as COST_XML_TYPES
// above); `rootTag` types hold exactly one record for the whole hồ sơ. Confirmed against a
// real GIAMDINHHS sample — XML6, XML9-12 weren't present in it and aren't mapped here;
// a file containing them will simply not raise those tabs (see xmlClaimParser.js).
const XML_DETAIL_CONFIG = {
  XML1: { rootTag: 'TONG_HOP' },
  XML2: { detailTag: 'CHI_TIET_THUOC' },
  XML3: { detailTag: 'CHI_TIET_DVKT' },
  XML4: { detailTag: 'CHI_TIET_CLS' },
  XML5: { detailTag: 'CHI_TIET_DIEN_BIEN_BENH' },
  XML7: { rootTag: 'CHI_TIEU_DU_LIEU_GIAY_RA_VIEN' },
  XML8: { rootTag: 'CHI_TIEU_DU_LIEU_TOM_TAT_HO_SO_BENH_AN' },
  XML13: { rootTag: 'CHI_TIEU_GIAYCHUYENTUYEN' },
};

module.exports = { XML1_ALIASES, XML2_ALIASES, XML3_ALIASES, COST_XML_TYPES, XML_DETAIL_CONFIG };

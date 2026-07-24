// Shared builder for a minimal but structurally real GIAMDINHHS "hồ sơ gửi cổng
// giám định" bundle, used by both the xmlClaimParser unit test and the e2e test.

function xmlEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toBase64Xml(rootTag, fields) {
  const body = Object.entries(fields)
    .map(([tag, value]) => `<${tag}>${xmlEscape(value ?? '')}</${tag}>`)
    .join('');
  const xml = `<?xml version='1.0' encoding='UTF-8'?><${rootTag}>${body}</${rootTag}>`;
  return Buffer.from(xml, 'utf8').toString('base64');
}

function buildXml1Base64({ maLK, maBN, hoTen, maCSKCB }) {
  return toBase64Xml('TONG_HOP', { MA_LK: maLK, MA_BN: maBN, HO_TEN: hoTen, MA_CSKCB: maCSKCB });
}

function buildXml2Base64({ maLK, maKhoa, thuoc }) {
  const chiTiet = thuoc
    .map((t) => {
      const fields = {
        MA_LK: maLK,
        MA_THUOC: t.maThuoc,
        TEN_THUOC: t.tenThuoc,
        DON_VI_TINH: t.donViTinh,
        HAM_LUONG: t.hamLuong,
        SO_DANG_KY: t.soDangKy,
        TT_THAU: t.ttThau,
        DON_GIA: t.donGia,
        SO_LUONG: t.soLuong,
        THANH_TIEN_BH: t.thanhTienBH,
        NGAY_YL: t.ngayYL,
        MA_KHOA: maKhoa,
      };
      const body = Object.entries(fields).map(([tag, value]) => `<${tag}>${xmlEscape(value ?? '')}</${tag}>`).join('');
      return `<CHI_TIET_THUOC>${body}</CHI_TIET_THUOC>`;
    })
    .join('');
  const xml =
    `<?xml version='1.0' encoding='UTF-8'?><CHITIEU_CHITIET_THUOC><DSACH_CHI_TIET_THUOC>${chiTiet}</DSACH_CHI_TIET_THUOC></CHITIEU_CHITIET_THUOC>`;
  return Buffer.from(xml, 'utf8').toString('base64');
}

function buildXml3Base64({ maLK, maKhoa, dichVu }) {
  const chiTiet = dichVu
    .map((d) => {
      const fields = {
        MA_LK: maLK,
        MA_DICH_VU: d.maDichVu,
        TEN_DICH_VU: d.tenDichVu,
        DON_GIA_BH: d.donGia,
        SO_LUONG: d.soLuong,
        THANH_TIEN_BH: d.thanhTienBH,
        NGAY_YL: d.ngayYL,
        MA_KHOA: maKhoa,
      };
      const body = Object.entries(fields).map(([tag, value]) => `<${tag}>${xmlEscape(value ?? '')}</${tag}>`).join('');
      return `<CHI_TIET_DVKT>${body}</CHI_TIET_DVKT>`;
    })
    .join('');
  const xml =
    `<?xml version='1.0' encoding='UTF-8'?><CHITIEU_CHITIET_DVKT_VTYT><DSACH_CHI_TIET_DVKT>${chiTiet}</DSACH_CHI_TIET_DVKT></CHITIEU_CHITIET_DVKT_VTYT>`;
  return Buffer.from(xml, 'utf8').toString('base64');
}

function buildFileHoSo(loaiHoSo, noiDungFileBase64) {
  return `<FILEHOSO><LOAIHOSO>${loaiHoSo}</LOAIHOSO><NOIDUNGFILE>${noiDungFileBase64}</NOIDUNGFILE></FILEHOSO>`;
}

// cases: [{ maLK, maBN, hoTen, maKhoa, thuoc: [...], dichVu: [...] }]
function buildGiamDinhHsXml(cases) {
  const hosoXml = cases
    .map((c) => {
      const files = [buildFileHoSo('XML1', buildXml1Base64({ maLK: c.maLK, maBN: c.maBN, hoTen: c.hoTen, maCSKCB: 'CSKCB01' }))];
      if (c.thuoc && c.thuoc.length > 0) {
        files.push(buildFileHoSo('XML2', buildXml2Base64({ maLK: c.maLK, maKhoa: c.maKhoa, thuoc: c.thuoc })));
      }
      if (c.dichVu && c.dichVu.length > 0) {
        files.push(buildFileHoSo('XML3', buildXml3Base64({ maLK: c.maLK, maKhoa: c.maKhoa, dichVu: c.dichVu })));
      }
      return `<HOSO>${files.join('')}</HOSO>`;
    })
    .join('');

  return (
    `<?xml version='1.0' encoding='UTF-8'?>` +
    `<GIAMDINHHS><THONGTINDONVI><MACSKCB>CSKCB01</MACSKCB></THONGTINDONVI>` +
    `<THONGTINHOSO><NGAYLAP>20240601</NGAYLAP><SOLUONGHOSO>${cases.length}</SOLUONGHOSO>` +
    `<DANHSACHHOSO>${hosoXml}</DANHSACHHOSO></THONGTINHOSO></GIAMDINHHS>`
  );
}

module.exports = { buildGiamDinhHsXml };

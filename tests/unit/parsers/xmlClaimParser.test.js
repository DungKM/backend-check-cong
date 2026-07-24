const { parseClaimXmlBuffer } = require('../../../parsers/xml/xmlClaimParser');
const { buildGiamDinhHsXml } = require('../../helpers/xmlFixtures');

describe('parseClaimXmlBuffer', () => {
  test('parses drug (XML2) and service (XML3) lines, joining case header via MA_LK', async () => {
    const xml = buildGiamDinhHsXml([
      {
        maLK: 'LK001', maBN: 'BN001', hoTen: 'Nguyen Van A', maKhoa: 'K01',
        thuoc: [{
          maThuoc: 'T001', tenThuoc: 'Paracetamol', donViTinh: 'Viên', hamLuong: '500mg',
          soDangKy: 'VD-12345-19', ttThau: 'TT01', donGia: 1000, soLuong: 2,
          thanhTienBH: 2000, ngayYL: '202406020800',
        }],
        dichVu: [{
          maDichVu: '17.31', tenDichVu: 'Khám nội khoa', donGia: 50000, soLuong: 1,
          thanhTienBH: 50000, ngayYL: '202406020800',
        }],
      },
    ]);

    const { rows, warnings } = await parseClaimXmlBuffer(Buffer.from(xml, 'utf8'), 'hoso.xml');

    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);

    const drugRow = rows.find((r) => r.xmlType === 'XML2');
    expect(drugRow).toMatchObject({
      maLK: 'LK001', maBN: 'BN001', hoTen: 'Nguyen Van A', maKhoa: 'K01',
      loaiChiPhi: 'THUOC', maChiPhi: 'T001', tenChiPhi: 'Paracetamol',
      donViTinh: 'Viên', hamLuong: '500mg', soDangKy: 'VD-12345-19',
      soLuong: 2, donGia: 1000, deNghi: 2000,
    });
    expect(drugRow.ngayYLenh.toISOString()).toBe('2024-06-02T08:00:00.000Z');

    const serviceRow = rows.find((r) => r.xmlType === 'XML3');
    expect(serviceRow).toMatchObject({
      maLK: 'LK001', maBN: 'BN001',
      loaiChiPhi: 'DICH_VU', maChiPhi: '17.31', tenChiPhi: 'Khám nội khoa',
      donGia: 50000, deNghi: 50000,
    });
  });

  test('skips vật tư y tế (VTYT) lines silently — no master catalog covers them yet', async () => {
    // A CHI_TIET_DVKT line carrying MA_VAT_TU instead of MA_DICH_VU, as real
    // CHITIEU_CHITIET_DVKT_VTYT files do for medical-supply (not DVKT) rows.
    const xml1 = Buffer.from(
      `<?xml version='1.0' encoding='UTF-8'?><TONG_HOP><MA_LK>LK002</MA_LK><MA_BN>BN002</MA_BN><HO_TEN>Tran Thi B</HO_TEN><MA_CSKCB>CSKCB01</MA_CSKCB></TONG_HOP>`,
      'utf8'
    ).toString('base64');
    const xml3 = Buffer.from(
      `<?xml version='1.0' encoding='UTF-8'?><CHITIEU_CHITIET_DVKT_VTYT><DSACH_CHI_TIET_DVKT><CHI_TIET_DVKT><MA_LK>LK002</MA_LK><MA_VAT_TU>VT-001</MA_VAT_TU><TEN_VAT_TU>Băng gạc</TEN_VAT_TU><MA_KHOA>K01</MA_KHOA></CHI_TIET_DVKT></DSACH_CHI_TIET_DVKT></CHITIEU_CHITIET_DVKT_VTYT>`,
      'utf8'
    ).toString('base64');
    const xml =
      `<?xml version='1.0' encoding='UTF-8'?><GIAMDINHHS><THONGTINDONVI><MACSKCB>CSKCB01</MACSKCB></THONGTINDONVI>` +
      `<THONGTINHOSO><NGAYLAP>20240601</NGAYLAP><SOLUONGHOSO>1</SOLUONGHOSO><DANHSACHHOSO>` +
      `<HOSO><FILEHOSO><LOAIHOSO>XML1</LOAIHOSO><NOIDUNGFILE>${xml1}</NOIDUNGFILE></FILEHOSO>` +
      `<FILEHOSO><LOAIHOSO>XML3</LOAIHOSO><NOIDUNGFILE>${xml3}</NOIDUNGFILE></FILEHOSO></HOSO>` +
      `</DANHSACHHOSO></THONGTINHOSO></GIAMDINHHS>`;

    const { rows, warnings } = await parseClaimXmlBuffer(Buffer.from(xml, 'utf8'), 'hoso.xml');
    expect(rows).toHaveLength(0);
    expect(warnings).toEqual([]);
  });

  test('reports a warning for a truly malformed cost line missing both codes', async () => {
    const xml = buildGiamDinhHsXml([
      {
        maLK: 'LK003', maBN: 'BN003', hoTen: 'Le Van C', maKhoa: 'K02',
        dichVu: [{ maDichVu: '', tenDichVu: '', donGia: 1000, soLuong: 1, thanhTienBH: 1000, ngayYL: '202406020800' }],
      },
    ]);

    const { rows, warnings } = await parseClaimXmlBuffer(Buffer.from(xml, 'utf8'), 'hoso.xml');
    expect(rows).toHaveLength(0);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('thiếu mã chi phí');
  });

  test('unzips a .zip bundle of XML files', async () => {
    const AdmZip = require('adm-zip');
    const xml = buildGiamDinhHsXml([
      {
        maLK: 'LK004', maBN: 'BN004', hoTen: 'Pham Thi D', maKhoa: 'K01',
        thuoc: [{
          maThuoc: 'T002', tenThuoc: 'Amoxicillin', donViTinh: 'Viên', hamLuong: '250mg',
          soDangKy: 'VD-99999-20', ttThau: 'TT02', donGia: 2000, soLuong: 1,
          thanhTienBH: 2000, ngayYL: '202406020800',
        }],
      },
    ]);
    const zip = new AdmZip();
    zip.addFile('hoso.xml', Buffer.from(xml, 'utf8'));
    const zipBuffer = zip.toBuffer();

    const { rows } = await parseClaimXmlBuffer(zipBuffer, 'hoso-bundle.zip');
    expect(rows).toHaveLength(1);
    expect(rows[0].maChiPhi).toBe('T002');
  });
});

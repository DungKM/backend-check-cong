const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const request = require('supertest');
const ExcelJS = require('exceljs');

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

const { createApp } = require('../../app');
const User = require('../../models/User');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();

  const passwordHash = await bcrypt.hash('123456', 10);
  await User.create({ username: 'admin', passwordHash, role: 'admin' });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// Import now responds immediately with { importId, status: 'processing' } while the
// actual parse+bulkWrite runs in the background (see catalogService.startImport) — tests
// poll the same endpoint a real client would use to know when it's actually done.
async function waitForImport(type, importId, token) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const res = await request(app)
      .get(`/api/catalogs/${type}/imports/${importId}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.body.status !== 'processing') return res.body;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Import ${importId} did not finish in time`);
}

async function buildDrugCatalogWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('DanhMucThuoc');
  sheet.addRow([
    'MA_THUOC', 'TEN_THUOC', 'DON_VI_TINH', 'HAM_LUONG', 'SO_DANG_KY',
    'DON_GIA_BH', 'TT_THAU', 'TU_NGAY', 'DEN_NGAY', 'MA_CSKCB',
  ]);
  sheet.addRow(['T001', 'Paracetamol', 'Viên', '500mg', 'VD-12345-19', 1000, 'TT01', '2024-01-01', '2024-12-31', 'CSKCB01']);
  return workbook.xlsx.writeBuffer();
}

async function buildServiceCatalogWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('DanhMucDVKT');
  sheet.addRow(['MA_TUONG_DUONG', 'TEN_DVKT_PHEDUYET', 'DON_GIA', 'TUNGAY', 'DENNGAY']);
  sheet.addRow(['S001', 'Khám nội khoa', 50000, '2024-01-01', '2024-12-31']);
  return workbook.xlsx.writeBuffer();
}

const { buildGiamDinhHsXml } = require('../helpers/xmlFixtures');

function buildClaimXmlBuffer() {
  const xml = buildGiamDinhHsXml([
    {
      maLK: 'BN001-LK', maBN: 'BN001', hoTen: 'Nguyen Van A', maKhoa: 'K01',
      thuoc: [{
        maThuoc: 'T001', tenThuoc: 'Paracetamol', donViTinh: 'Viên', hamLuong: '500mg',
        soDangKy: 'VD-12345-19', ttThau: 'TT01', donGia: 1000, soLuong: 100,
        thanhTienBH: 100000, ngayYL: '202406020800',
      }],
    },
    {
      maLK: 'BN002-LK', maBN: 'BN002', hoTen: 'Tran Thi B', maKhoa: 'K01',
      thuoc: [{
        // Hàm lượng mismatch vs catalog (500mg) -> should reconcile as LECH_DU_LIEU
        maThuoc: 'T001', tenThuoc: 'Paracetamol', donViTinh: 'Viên', hamLuong: '250mg',
        soDangKy: 'VD-12345-19', ttThau: 'TT01', donGia: 1000, soLuong: 50,
        thanhTienBH: 50000, ngayYL: '202406030800',
      }],
    },
    {
      maLK: 'BN003-LK', maBN: 'BN003', hoTen: 'Le Van C', maKhoa: 'K02',
      thuoc: [{
        // Code doesn't exist in any catalog -> KHONG_TIM_THAY
        maThuoc: 'T999', tenThuoc: 'Thuốc không rõ', donViTinh: '', hamLuong: '',
        soDangKy: '', ttThau: '', donGia: 30000, soLuong: 1,
        thanhTienBH: 30000, ngayYL: '202406040800',
      }],
    },
  ]);
  return Buffer.from(xml, 'utf8');
}

describe('End-to-end reconciliation flow', () => {
  let token;
  let batchId;

  test('login with seeded demo account returns a JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
  });

  test('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('unauthenticated request to a protected route is rejected', async () => {
    const res = await request(app).get('/api/batches');
    expect(res.status).toBe(401);
  });

  test('/api/auth/me returns the current user with a valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('admin');
  });

  test('imports drug and service master catalogs (persistent, not batch-scoped)', async () => {
    const drugBuffer = await buildDrugCatalogWorkbook();
    const drugRes = await request(app)
      .post('/api/catalogs/drug/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', drugBuffer, 'danh-muc-thuoc.xlsx');
    expect(drugRes.status).toBe(202);
    expect(drugRes.body.status).toBe('processing');
    const drugDone = await waitForImport('drug', drugRes.body.importId, token);
    expect(drugDone.status).toBe('success');
    expect(drugDone.rowsInserted).toBe(1);

    const serviceBuffer = await buildServiceCatalogWorkbook();
    const serviceRes = await request(app)
      .post('/api/catalogs/service/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', serviceBuffer, 'danh-muc-dvkt.xlsx');
    expect(serviceRes.status).toBe(202);
    const serviceDone = await waitForImport('service', serviceRes.body.importId, token);
    expect(serviceDone.status).toBe('success');
    expect(serviceDone.rowsInserted).toBe(1);
  });

  test('re-importing the same drug catalog file always inserts new rows (no dedup)', async () => {
    const drugBuffer = await buildDrugCatalogWorkbook();
    const reimportRes = await request(app)
      .post('/api/catalogs/drug/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', drugBuffer, 'danh-muc-thuoc.xlsx');
    expect(reimportRes.status).toBe(202);
    const reimportDone = await waitForImport('drug', reimportRes.body.importId, token);
    expect(reimportDone.status).toBe('success');
    expect(reimportDone.rowsInserted).toBe(1);
    expect(reimportDone.rowsUpdated).toBe(0);

    const listRes = await request(app)
      .get('/api/catalogs/drug?q=T001')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(2);

    const historyRes = await request(app)
      .get('/api/catalogs/drug/imports')
      .set('Authorization', `Bearer ${token}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.length).toBe(2);
  });

  test('downloads an import template with header row + example row', async () => {
    const res = await request(app)
      .get('/api/catalogs/drug/template')
      .set('Authorization', `Bearer ${token}`)
      .buffer()
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('manually creates, edits, and deletes a single catalog row (no file needed)', async () => {
    const createRes = await request(app)
      .post('/api/catalogs/service')
      .set('Authorization', `Bearer ${token}`)
      .send({ maTuongDuong: 'S999', tenDvktPheDuyet: 'Khám da liễu', donGia: 30000, tuNgay: '2024-01-01' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.maTuongDuong).toBe('S999');
    const itemId = createRes.body._id;

    const updateRes = await request(app)
      .patch(`/api/catalogs/service/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maTuongDuong: 'S999', tenDvktPheDuyet: 'Khám da liễu (đã sửa)', donGia: 35000, tuNgay: '2024-01-01' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tenDvktPheDuyet).toBe('Khám da liễu (đã sửa)');

    const missingFieldRes = await request(app)
      .post('/api/catalogs/service')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenDvktPheDuyet: 'Thiếu mã' });
    expect(missingFieldRes.status).toBe(400);

    const deleteRes = await request(app)
      .delete(`/api/catalogs/service/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/catalogs/service?q=S999')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.total).toBe(0);
  });

  test('uploads a BHYT claim XML (GIAMDINHHS bundle) and creates a batch', async () => {
    const xmlBuffer = buildClaimXmlBuffer();
    const res = await request(app)
      .post('/api/upload/claim-xml')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', xmlBuffer, 'hoso-giam-dinh.xml');
    expect(res.status).toBe(200);
    expect(res.body.rowCount).toBe(3);
    batchId = res.body.batchId;
    expect(batchId).toBeTruthy();
  });

  test('runs reconciliation against the persistent catalogs and produces the expected conclusions', async () => {
    const analyzeRes = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId });
    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.rowCount).toBe(3);

    const resultsRes = await request(app)
      .get(`/api/analyze/${batchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(resultsRes.status).toBe(200);
    const { results } = resultsRes.body;
    expect(results).toHaveLength(3);

    const byMaBN = Object.fromEntries(results.map((r) => [r.errorRow.maBN, r]));
    expect(byMaBN.BN001.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(byMaBN.BN002.ketLuan).toBe('LECH_DU_LIEU');
    expect(byMaBN.BN002.chiTietLech[0].truong).toBe('Hàm lượng');
    expect(byMaBN.BN003.ketLuan).toBe('KHONG_TIM_THAY');
  });

  test('summary aggregates totals by conclusion and khoa', async () => {
    const res = await request(app)
      .get(`/api/analyze/${batchId}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tongSoDong).toBe(3);
    expect(res.body.soDongCanhBao).toBe(2); // BN002 (lệch) + BN003 (không tìm thấy)
    expect(res.body.theoKetLuan.length).toBeGreaterThan(0);
    expect(res.body.theoKhoa.length).toBeGreaterThan(0);
  });

  test('filters results by ketLuan', async () => {
    const res = await request(app)
      .get(`/api/analyze/${batchId}?ketLuan=LECH_DU_LIEU`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].errorRow.maBN).toBe('BN002');
  });

  test('exports an Excel report', async () => {
    const res = await request(app)
      .get(`/api/analyze/${batchId}/export`)
      .set('Authorization', `Bearer ${token}`)
      .buffer()
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

});

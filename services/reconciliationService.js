const Batch = require('../models/Batch');
const DrugCatalogMaster = require('../models/DrugCatalogMaster');
const ServiceCatalogMaster = require('../models/ServiceCatalogMaster');
const ErrorCodeCatalog = require('../models/ErrorCodeCatalog');
const DoctorCatalogMaster = require('../models/DoctorCatalogMaster');
const ServiceGroupCatalog = require('../models/ServiceGroupCatalog');
const VatTuCatalogMaster = require('../models/VatTuCatalogMaster');
const BenefitRateCatalog = require('../models/BenefitRateCatalog');
const claimMemoryStore = require('./claimMemoryStore');
const { checkTheBhxhForBatch } = require('./theBhxhBatchCheck');
const { reconcileBatch } = require('../reconciliation/reconcileBatch');
const {
  buildErrorCodeIndex,
  predictErrorCode,
  predictBacSiErrorCode,
  predictNgaySinhErrorCode,
  predictHoTenErrorCode,
  predictGioiTinhErrorCode,
  predictNgayGiuongErrorCode,
  predictKhamTrungLapErrorCode,
  predictNhomDvktErrorCode,
  predictMucHuongErrorCode,
  predictMucHuongDungTuyenErrorCode,
} = require('../reconciliation/predictErrorCode');
const { buildDoctorSet } = require('../reconciliation/checkBacSi');
const { buildServiceGroupMap } = require('../reconciliation/checkNhomDvkt');
const { buildBenefitRateMap } = require('../reconciliation/checkMucHuong');
const { KET_LUAN } = require('../config/constants');

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

async function getBatchOrThrow(batchId) {
  const batch = await Batch.findOne({ batchId });
  if (!batch) throw new NotFoundError(`Không tìm thấy đợt đối chiếu: ${batchId}`);
  return batch;
}

function buildCatalogIndex(drugRows, serviceRows, doctorRows, serviceGroupRows, vatTuRows, benefitRateRows) {
  const drugByCode = new Map();
  for (const row of drugRows) {
    if (!drugByCode.has(row.maThuoc)) drugByCode.set(row.maThuoc, []);
    drugByCode.get(row.maThuoc).push(row);
  }
  const serviceByCode = new Map();
  for (const row of serviceRows) {
    if (!serviceByCode.has(row.maTuongDuong)) serviceByCode.set(row.maTuongDuong, []);
    serviceByCode.get(row.maTuongDuong).push(row);
  }
  const vatTuByCode = new Map();
  for (const row of vatTuRows) {
    if (!vatTuByCode.has(row.maVatTu)) vatTuByCode.set(row.maVatTu, []);
    vatTuByCode.get(row.maVatTu).push(row);
  }
  const doctorSet = buildDoctorSet(doctorRows);
  const serviceGroupByMa = buildServiceGroupMap(serviceGroupRows);
  const benefitRateByMa = buildBenefitRateMap(benefitRateRows);
  return { drugByCode, serviceByCode, vatTuByCode, doctorSet, serviceGroupByMa, benefitRateByMa };
}

function buildDuDoanMaLoi(result, errorCodeIndex, ngayYLenh) {
  const warnings = predictErrorCode(result, errorCodeIndex, ngayYLenh);
  const byMaLoi = new Map(warnings.map((w) => [w.maLoi, w]));

  if (result.bacSiMismatch) {
    for (const w of predictBacSiErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.ngaySinhMismatch) {
    for (const w of predictNgaySinhErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.hoTenMismatch) {
    for (const w of predictHoTenErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.gioiTinhMismatch) {
    for (const w of predictGioiTinhErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.ngayGiuongMismatch) {
    for (const w of predictNgayGiuongErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.khamTrungLapMismatch) {
    for (const w of predictKhamTrungLapErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.nhomDvktMismatch) {
    for (const w of predictNhomDvktErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.mucHuongMismatch) {
    for (const w of predictMucHuongErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }
  if (result.mucHuongDungTuyenMismatch) {
    for (const w of predictMucHuongDungTuyenErrorCode(errorCodeIndex, ngayYLenh)) {
      byMaLoi.set(w.maLoi, w);
    }
  }

  return [...byMaLoi.values()];
}

async function runAnalysis(batchId) {
  const batch = await getBatchOrThrow(batchId);

  batch.status = 'analyzing';
  await batch.save();

  try {
    // Nội dung hồ sơ (PII) chỉ sống trong bộ nhớ tiến trình — xem claimMemoryStore.js.
    const claimRows = claimMemoryStore.getClaimItems(batchId);
    const codes = [...new Set(claimRows.map((row) => row.maChiPhi).filter(Boolean))];

    const [drugRows, serviceRows, errorCodeRows, doctorRows, serviceGroupRows, vatTuRows, benefitRateRows] =
      await Promise.all([
        DrugCatalogMaster.find({ maThuoc: { $in: codes } }).lean(),
        ServiceCatalogMaster.find({ maTuongDuong: { $in: codes } }).lean(),
        ErrorCodeCatalog.find({ active: true }).lean(),
        DoctorCatalogMaster.find({}).lean(),
        ServiceGroupCatalog.find({ ma: { $in: codes } }).lean(),
        VatTuCatalogMaster.find({ maVatTu: { $in: codes } }).lean(),
        // Bảng mức hưởng theo mã đối tượng nhỏ (vài trăm dòng), không lọc theo mã chi phí
        // như các danh mục trên — nạp toàn bộ, giống DoctorCatalogMaster.
        BenefitRateCatalog.find({}).lean(),
      ]);

    const catalogIndex = buildCatalogIndex(
      drugRows,
      serviceRows,
      doctorRows,
      serviceGroupRows,
      vatTuRows,
      benefitRateRows
    );
    const errorCodeIndex = buildErrorCodeIndex(errorCodeRows);
    const results = reconcileBatch(claimRows, catalogIndex);

    // Đối chiếu họ tên/ngày sinh/giới tính với CSDL thẻ BHYT thật của BHXH
    // (ML011/ML019/ML020) — 1 lần gọi/mã thẻ duy nhất trong batch (dedupe), không
    // chặn cả batch nếu cổng BHXH lỗi hoặc chưa cấu hình tài khoản (xem
    // theBhxhBatchCheck.js).
    const theBhxhMismatches = await checkTheBhxhForBatch(claimRows);

    claimMemoryStore.setAnalysisResults(
      batchId,
      results.map(({ errorRow, result }) => {
        const theMismatch = errorRow.maThe ? theBhxhMismatches.get(errorRow.maThe) : null;
        const ghiChu = [...result.ghiChu];
        if (theMismatch?.ngaySinhMismatch) {
          ghiChu.push(`Cổng BHXH báo sai ngày sinh so với CSDL thẻ BHYT: "${theMismatch.message}"`);
        }
        if (theMismatch?.hoTenMismatch) {
          ghiChu.push(`Cổng BHXH báo sai họ tên so với CSDL thẻ BHYT: "${theMismatch.message}"`);
        }
        if (theMismatch?.gioiTinhMismatch) {
          ghiChu.push(`Cổng BHXH báo sai giới tính so với CSDL thẻ BHYT: "${theMismatch.message}"`);
        }

        const resultWithBhxh = {
          ...result,
          ngaySinhMismatch: Boolean(theMismatch?.ngaySinhMismatch),
          hoTenMismatch: Boolean(theMismatch?.hoTenMismatch),
          gioiTinhMismatch: Boolean(theMismatch?.gioiTinhMismatch),
        };

        return {
          ketLuan: result.ketLuan,
          chiTietLech: result.chiTietLech,
          rejectReasonCategory: result.rejectReasonCategory,
          duDoanMaLoi: buildDuDoanMaLoi(resultWithBhxh, errorCodeIndex, errorRow.ngayYLenh),
          ghiChu,
          errorRow,
        };
      })
    );

    batch.status = 'analyzed';
    batch.analyzedAt = new Date();
    await batch.save();

    return { batchId, rowCount: results.length };
  } catch (err) {
    batch.status = 'failed';
    await batch.save();
    throw err;
  }
}

async function getResults(batchId, filters = {}) {
  await getBatchOrThrow(batchId);

  const results = claimMemoryStore
    .getAnalysisResults(batchId)
    .filter((r) => !filters.ketLuan || r.ketLuan === filters.ketLuan)
    .filter((r) => !filters.maKhoa || r.errorRow?.maKhoa === filters.maKhoa)
    .filter((r) => !filters.loaiGiamTru || r.errorRow?.loaiGiamTru === filters.loaiGiamTru);

  return results.map((r) => ({
    _id: r._id,
    ketLuan: r.ketLuan,
    chiTietLech: r.chiTietLech,
    rejectReasonCategory: r.rejectReasonCategory,
    duDoanMaLoi: r.duDoanMaLoi,
    ghiChu: r.ghiChu,
    errorRow: r.errorRow,
  }));
}

function monthKeyOf(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function getSummary(batchId) {
  await getBatchOrThrow(batchId);

  const results = claimMemoryStore.getAnalysisResults(batchId);

  const byKetLuan = new Map();
  const byKhoa = new Map();
  const byMonth = new Map();
  let soDongCanhBao = 0;

  for (const r of results) {
    byKetLuan.set(r.ketLuan, (byKetLuan.get(r.ketLuan) || 0) + 1);

    const isCanhBao = r.ketLuan !== KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC;
    if (isCanhBao) soDongCanhBao += 1;
    const tien = isCanhBao ? Number(r.errorRow?.deNghi) || 0 : 0;

    const khoaKey = r.errorRow?.maKhoa || '(không rõ)';
    const khoa = byKhoa.get(khoaKey) || { count: 0, tongTienCanhBao: 0 };
    khoa.count += 1;
    khoa.tongTienCanhBao += tien;
    byKhoa.set(khoaKey, khoa);

    const thangKey = monthKeyOf(r.errorRow?.ngayYLenh) || '(không rõ)';
    const thang = byMonth.get(thangKey) || { count: 0, tongTienCanhBao: 0 };
    thang.count += 1;
    thang.tongTienCanhBao += tien;
    byMonth.set(thangKey, thang);
  }

  return {
    batchId,
    tongSoDong: results.length,
    soDongCanhBao,
    theoKetLuan: [...byKetLuan.entries()].map(([ketLuan, count]) => ({ ketLuan, count })),
    theoKhoa: [...byKhoa.entries()]
      .map(([maKhoa, v]) => ({ maKhoa, count: v.count, tongTienCanhBao: v.tongTienCanhBao }))
      .sort((a, b) => b.tongTienCanhBao - a.tongTienCanhBao),
    theoThang: [...byMonth.entries()]
      .map(([thang, v]) => ({ thang, count: v.count, tongTienCanhBao: v.tongTienCanhBao }))
      .sort((a, b) => (a.thang > b.thang ? 1 : a.thang < b.thang ? -1 : 0)),
  };
}

module.exports = { runAnalysis, getResults, getSummary, getBatchOrThrow, NotFoundError };

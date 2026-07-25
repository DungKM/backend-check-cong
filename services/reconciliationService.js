const Batch = require('../models/Batch');
const DrugCatalogMaster = require('../models/DrugCatalogMaster');
const ServiceCatalogMaster = require('../models/ServiceCatalogMaster');
const ErrorCodeCatalog = require('../models/ErrorCodeCatalog');
const DoctorCatalogMaster = require('../models/DoctorCatalogMaster');
const ServiceGroupCatalog = require('../models/ServiceGroupCatalog');
const ClaimItem = require('../models/ClaimItem');
const AnalysisResult = require('../models/AnalysisResult');
const { reconcileBatch } = require('../reconciliation/reconcileBatch');
const {
  buildErrorCodeIndex,
  predictErrorCode,
  predictBacSiErrorCode,
  predictNgaySinhErrorCode,
  predictNgayGiuongErrorCode,
  predictKhamTrungLapErrorCode,
  predictNhomDvktErrorCode,
} = require('../reconciliation/predictErrorCode');
const { buildDoctorSet } = require('../reconciliation/checkBacSi');
const { buildServiceGroupMap } = require('../reconciliation/checkNhomDvkt');
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

function buildCatalogIndex(drugRows, serviceRows, doctorRows, serviceGroupRows) {
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
  const doctorSet = buildDoctorSet(doctorRows);
  const serviceGroupByMa = buildServiceGroupMap(serviceGroupRows);
  return { drugByCode, serviceByCode, doctorSet, serviceGroupByMa };
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

  return [...byMaLoi.values()];
}

async function runAnalysis(batchId) {
  const batch = await getBatchOrThrow(batchId);

  batch.status = 'analyzing';
  await batch.save();

  try {
    const claimRows = await ClaimItem.find({ batchId }).lean();
    const codes = [...new Set(claimRows.map((row) => row.maChiPhi).filter(Boolean))];

    const [drugRows, serviceRows, errorCodeRows, doctorRows, serviceGroupRows] = await Promise.all([
      DrugCatalogMaster.find({ maThuoc: { $in: codes } }).lean(),
      ServiceCatalogMaster.find({ maTuongDuong: { $in: codes } }).lean(),
      ErrorCodeCatalog.find({ active: true }).lean(),
      DoctorCatalogMaster.find({}).lean(),
      ServiceGroupCatalog.find({ ma: { $in: codes } }).lean(),
    ]);

    const catalogIndex = buildCatalogIndex(drugRows, serviceRows, doctorRows, serviceGroupRows);
    const errorCodeIndex = buildErrorCodeIndex(errorCodeRows);
    const results = reconcileBatch(claimRows, catalogIndex);

    await AnalysisResult.deleteMany({ batchId });

    if (results.length > 0) {
      await AnalysisResult.insertMany(
        results.map(({ errorRow, result }) => ({
          batchId,
          errorRowId: errorRow._id,
          ketLuan: result.ketLuan,
          chiTietLech: result.chiTietLech,
          rejectReasonCategory: result.rejectReasonCategory,
          duDoanMaLoi: buildDuDoanMaLoi(result, errorCodeIndex, errorRow.ngayYLenh),
          ghiChu: result.ghiChu,
        }))
      );
    }

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

  const match = { batchId };
  if (filters.ketLuan) match.ketLuan = filters.ketLuan;

  const results = await AnalysisResult.find(match).populate('errorRowId').lean();

  return results
    .filter((r) => r.errorRowId)
    .filter((r) => !filters.maKhoa || r.errorRowId.maKhoa === filters.maKhoa)
    .filter((r) => !filters.loaiGiamTru || r.errorRowId.loaiGiamTru === filters.loaiGiamTru)
    .map((r) => ({
      _id: r._id,
      ketLuan: r.ketLuan,
      chiTietLech: r.chiTietLech,
      rejectReasonCategory: r.rejectReasonCategory,
      duDoanMaLoi: r.duDoanMaLoi,
      ghiChu: r.ghiChu,
      errorRow: r.errorRowId,
    }));
}

async function getSummary(batchId) {
  await getBatchOrThrow(batchId);

  const [byKetLuan, byKhoa, byMonth, totals] = await Promise.all([
    AnalysisResult.aggregate([
      { $match: { batchId } },
      { $group: { _id: '$ketLuan', count: { $sum: 1 } } },
    ]),
    AnalysisResult.aggregate([
      { $match: { batchId } },
      {
        $lookup: {
          from: 'claimitems',
          localField: 'errorRowId',
          foreignField: '_id',
          as: 'errorRow',
        },
      },
      { $unwind: '$errorRow' },
      {
        $group: {
          _id: '$errorRow.maKhoa',
          count: { $sum: 1 },
          tongTienCanhBao: {
            $sum: {
              $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, { $ifNull: ['$errorRow.deNghi', 0] }],
            },
          },
        },
      },
      { $sort: { tongTienCanhBao: -1 } },
    ]),
    AnalysisResult.aggregate([
      { $match: { batchId } },
      {
        $lookup: {
          from: 'claimitems',
          localField: 'errorRowId',
          foreignField: '_id',
          as: 'errorRow',
        },
      },
      { $unwind: '$errorRow' },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$errorRow.ngayYLenh' },
          },
          count: { $sum: 1 },
          tongTienCanhBao: {
            $sum: {
              $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, { $ifNull: ['$errorRow.deNghi', 0] }],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AnalysisResult.aggregate([
      { $match: { batchId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          soDongCanhBao: { $sum: { $cond: [{ $eq: ['$ketLuan', KET_LUAN.KHONG_LIEN_QUAN_DANH_MUC] }, 0, 1] } },
        },
      },
    ]),
  ]);

  return {
    batchId,
    tongSoDong: totals[0]?.count || 0,
    soDongCanhBao: totals[0]?.soDongCanhBao || 0,
    theoKetLuan: byKetLuan.map((r) => ({ ketLuan: r._id, count: r.count })),
    theoKhoa: byKhoa.map((r) => ({ maKhoa: r._id || '(không rõ)', count: r.count, tongTienCanhBao: r.tongTienCanhBao })),
    theoThang: byMonth.map((r) => ({ thang: r._id || '(không rõ)', count: r.count, tongTienCanhBao: r.tongTienCanhBao })),
  };
}

module.exports = { runAnalysis, getResults, getSummary, getBatchOrThrow, NotFoundError };

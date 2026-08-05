const { reconcileBatch } = require('../../../reconciliation/reconcileBatch');

function d(str) {
  return new Date(str);
}

describe('reconcileBatch', () => {
  test('batch of N mixed rows produces N ordered results', () => {
    const catalogIndex = { drugByCode: new Map(), serviceByCode: new Map() };
    const rows = [
      { maChiPhi: 'A', loaiChiPhi: 'Thuốc', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
      { maChiPhi: 'B', loaiChiPhi: 'Thuốc', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
      { maChiPhi: 'C', loaiChiPhi: 'Thuốc', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
    ];
    const results = reconcileBatch(rows, catalogIndex);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.errorRow.maChiPhi)).toEqual(['A', 'B', 'C']);
  });

  test('one row throwing inside the engine does not stop the rest of the batch', () => {
    const drugByCode = new Map();
    // getValidCatalogRow will be called with a row whose tuNgay is not a Date to force a throw
    drugByCode.set('BAD', [{ maThuoc: 'BAD', tuNgay: 'not-a-date', denNgay: null }]);
    const catalogIndex = { drugByCode, serviceByCode: new Map() };
    const rows = [
      { maChiPhi: 'BAD', loaiChiPhi: 'Thuốc', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
      { maChiPhi: 'OK', loaiChiPhi: 'Thuốc', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
    ];
    const results = reconcileBatch(rows, catalogIndex);
    expect(results).toHaveLength(2);
    expect(results[1].error).toBeNull();
  });

  test('ngày giường billing vượt công thức mặc định flags only the giường-line rows of that hồ sơ', () => {
    const catalogIndex = { drugByCode: new Map(), serviceByCode: new Map() };
    const rows = [
      {
        maLK: 'LK001',
        maChiPhi: 'GIUONG1',
        maGiuong: 'T021',
        soLuong: 5, // công thức mặc định chỉ cho phép 2 ngày (03/01 - 01/01)
        ngayVaoNoiTru: d('2024-01-01T09:00:00Z'),
        ngayRa: d('2024-01-03T11:00:00Z'),
        loaiChiPhi: 'Giường bệnh',
        ngayYLenh: d('2024-01-01'),
        lyDoTuChoi: '',
      },
      {
        maLK: 'LK001',
        maChiPhi: 'THUOC1',
        ngayVaoNoiTru: d('2024-01-01T09:00:00Z'),
        ngayRa: d('2024-01-03T11:00:00Z'),
        loaiChiPhi: 'Thuốc',
        ngayYLenh: d('2024-01-01'),
        lyDoTuChoi: '',
      },
    ];
    const results = reconcileBatch(rows, catalogIndex);
    expect(results[0].result.ngayGiuongMismatch).toBe(true);
    expect(results[0].result.ghiChu.some((g) => g.includes('5') && g.includes('2'))).toBe(true);
    expect(results[1].result.ngayGiuongMismatch).toBe(false);
  });

  test('cùng mã dịch vụ khám bệnh dùng 2 lần flags only those rows, not unrelated rows in the same hồ sơ', () => {
    const catalogIndex = { drugByCode: new Map(), serviceByCode: new Map() };
    const rows = [
      { maLK: 'LK001', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp', loaiChiPhi: 'Khám bệnh', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
      { maLK: 'LK001', maChiPhi: '10.19', tenChiPhi: 'Khám Ngoại tổng hợp', loaiChiPhi: 'Khám bệnh', ngayYLenh: d('2024-01-02'), lyDoTuChoi: '' },
      { maLK: 'LK001', maChiPhi: 'THUOC1', loaiChiPhi: 'Thuốc', ngayYLenh: d('2024-01-01'), lyDoTuChoi: '' },
    ];
    const results = reconcileBatch(rows, catalogIndex);
    expect(results[0].result.khamTrungLapMismatch).toBe(true);
    expect(results[1].result.khamTrungLapMismatch).toBe(true);
    expect(results[2].result.khamTrungLapMismatch).toBe(false);
  });

  test('ML018: đúng tuyến, tổng chi phí 2 dòng cùng MA_LK >=15% LCS, mức hưởng sai -> flags both rows', () => {
    const { buildBenefitRateMap } = require('../../../reconciliation/checkMucHuong');
    const catalogIndex = {
      drugByCode: new Map(),
      serviceByCode: new Map(),
      benefitRateByMa: buildBenefitRateMap([
        { ma: 'TC', nhom: '2', chiTraDungTuyen: 80, chiTraTraiTuyen: 48 },
      ]),
    };
    const rows = [
      {
        maLK: 'LK001',
        maChiPhi: 'THUOC1',
        loaiChiPhi: 'Thuốc',
        maThe: 'TC3010124582880',
        loaiKCB: '2',
        maDkbd: '01007',
        maCSKCB: '01007',
        ngayVao: d('2024-08-01'),
        ngayYLenh: d('2024-08-01'),
        deNghi: 250000,
        mucHuong: 100,
        lyDoTuChoi: '',
      },
      {
        maLK: 'LK001',
        maChiPhi: 'DVKT1',
        loaiChiPhi: 'Dịch vụ',
        maThe: 'TC3010124582880',
        loaiKCB: '2',
        maDkbd: '01007',
        maCSKCB: '01007',
        ngayVao: d('2024-08-01'),
        ngayYLenh: d('2024-08-01'),
        deNghi: 200000, // tổng 2 dòng = 450.000, >= 15% * 2.340.000 = 351.000
        mucHuong: 100,
        lyDoTuChoi: '',
      },
    ];
    const results = reconcileBatch(rows, catalogIndex);
    expect(results[0].result.mucHuongDungTuyenMismatch).toBe(true);
    expect(results[1].result.mucHuongDungTuyenMismatch).toBe(true);
    expect(results[0].result.ghiChu.some((g) => g.includes('15%'))).toBe(true);
  });
});

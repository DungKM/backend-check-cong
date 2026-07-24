const { reconcileRow } = require('../../../reconciliation/reconcileRow');

function d(str) {
  return new Date(str);
}

function buildCatalogIndex({ drugs = [], services = [] } = {}) {
  const drugByCode = new Map();
  for (const drug of drugs) {
    if (!drugByCode.has(drug.maThuoc)) drugByCode.set(drug.maThuoc, []);
    drugByCode.get(drug.maThuoc).push(drug);
  }
  const serviceByCode = new Map();
  for (const service of services) {
    if (!serviceByCode.has(service.maTuongDuong)) serviceByCode.set(service.maTuongDuong, []);
    serviceByCode.get(service.maTuongDuong).push(service);
  }
  return { drugByCode, serviceByCode };
}

const baseDrug = {
  maThuoc: 'T001',
  tenThuoc: 'Paracetamol',
  donViTinh: 'Viên',
  hamLuong: '500mg',
  soDangKy: 'VD-12345-19',
  tuNgay: d('2024-01-01'),
  denNgay: d('2024-12-31'),
};

const baseErrorRow = {
  maChiPhi: 'T001',
  loaiChiPhi: 'Thuốc trong danh mục BHYT',
  donViTinh: 'Viên',
  hamLuong: '500mg',
  soDangKy: 'VD-12345-19',
  ngayYLenh: d('2024-06-01'),
  lyDoTuChoi: '',
};

describe('reconcileRow', () => {
  test('code not found in either catalog -> KHONG_TIM_THAY', () => {
    const catalogIndex = buildCatalogIndex();
    const result = reconcileRow(baseErrorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_TIM_THAY');
  });

  test('code found, valid date range, all fields match -> KHONG_LIEN_QUAN_DANH_MUC', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const result = reconcileRow(baseErrorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.chiTietLech).toEqual([]);
  });

  test('code found, valid date range, hàm lượng mismatch -> LECH_DU_LIEU with correct diff', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, hamLuong: '250mg' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('LECH_DU_LIEU');
    expect(result.chiTietLech).toEqual([
      { truong: 'Hàm lượng', giaTriXML: '250mg', giaTriDanhMuc: '500mg' },
    ]);
  });

  test('ngayYLenh outside all candidates validity windows -> KHONG_TIM_THAY (expired)', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, ngayYLenh: d('2025-06-01') };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_TIM_THAY');
    expect(result.ghiChu.some((g) => g.includes('hiệu lực'))).toBe(true);
  });

  test('ambiguous catalog match still computes a conclusion and flags the ambiguity', () => {
    const drugA = { ...baseDrug, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') };
    const drugB = { ...baseDrug, tuNgay: d('2024-06-01'), denNgay: d('2024-12-31'), hamLuong: '250mg' };
    const catalogIndex = buildCatalogIndex({ drugs: [drugA, drugB] });
    const errorRow = { ...baseErrorRow, ngayYLenh: d('2024-07-01') };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ghiChu.some((g) => g.includes('cùng hiệu lực'))).toBe(true);
    // most recent tuNgay (drugB, hamLuong 250mg) is chosen -> mismatch vs errorRow's 500mg
    expect(result.ketLuan).toBe('LECH_DU_LIEU');
  });

  test('unclassifiable loaiChiPhi falls back gracefully to whichever catalog has the code', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, loaiChiPhi: 'Không rõ loại' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.ghiChu.some((g) => g.includes('Không xác định được loại chi phí'))).toBe(true);
  });

  test('service row with empty lyDoTuChoi still returns a valid ketLuan', () => {
    const service = {
      maTuongDuong: 'S001',
      tenDvktPheDuyet: 'Khám nội khoa',
      donGia: 50000,
      tuNgay: d('2024-01-01'),
      denNgay: null,
    };
    const catalogIndex = buildCatalogIndex({ services: [service] });
    const errorRow = {
      maChiPhi: 'S001',
      loaiChiPhi: 'Khám bệnh',
      tenChiPhi: 'Khám nội khoa',
      ngayYLenh: d('2024-06-01'),
      lyDoTuChoi: '',
    };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.rejectReasonCategory).toBe('KHONG_XAC_DINH');
  });

  test('mã bác sĩ not in doctorSet -> ghi chú flagged independently of chi phí ketLuan', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    catalogIndex.doctorSet = new Set(['0026767/byt-cchn']);
    const errorRow = { ...baseErrorRow, maBacSi: '9999999/BYT-CCHN' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.ghiChu.some((g) => g.includes('9999999/BYT-CCHN'))).toBe(true);
    expect(result.bacSiMismatch).toBe(true);
  });

  test('mã bác sĩ found in doctorSet -> no extra ghi chú', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    catalogIndex.doctorSet = new Set(['0026767/byt-cchn']);
    const errorRow = { ...baseErrorRow, maBacSi: '0026767/BYT-CCHN' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ghiChu).toEqual([]);
    expect(result.bacSiMismatch).toBe(false);
  });

  test('năm sinh lệch số CCCD -> ghi chú flagged independently of chi phí ketLuan', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, soCCCD: '001054010978', ngaySinh: new Date(Date.UTC(1975, 2, 28)) };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.ghiChu.some((g) => g.includes('1975') && g.includes('1954'))).toBe(true);
    expect(result.ngaySinhMismatch).toBe(true);
  });

  test('năm sinh khớp số CCCD -> no extra ghi chú', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, soCCCD: '001054010978', ngaySinh: new Date(Date.UTC(1954, 2, 28)) };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ghiChu).toEqual([]);
    expect(result.ngaySinhMismatch).toBe(false);
  });
});

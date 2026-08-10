const { reconcileRow } = require('../../../reconciliation/reconcileRow');

function d(str) {
  return new Date(str);
}

function buildCatalogIndex({ drugs = [], services = [], vatTus = [] } = {}) {
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
  const vatTuByCode = new Map();
  for (const vatTu of vatTus) {
    if (!vatTuByCode.has(vatTu.maVatTu)) vatTuByCode.set(vatTu.maVatTu, []);
    vatTuByCode.get(vatTu.maVatTu).push(vatTu);
  }
  return { drugByCode, serviceByCode, vatTuByCode };
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

  test('nhiều dòng cùng mã thuốc khác Số đăng ký -> chọn đúng dòng khớp Số đăng ký trên hồ sơ, không báo lệch giả', () => {
    // Cùng mã thuốc "T001" nhưng 2 đợt thầu khác nhau -> 2 số đăng ký khác nhau, cả
    // hai đều còn hiệu lực tại ngayYLenh. Nếu chỉ lọc theo ngày (bỏ qua Số đăng ký),
    // logic tie-break cũ sẽ chọn dòng tuNgay mới nhất (drugB, VD-99999-20) và báo lệch
    // Số đăng ký giả dù hồ sơ thực ra khớp đúng drugA.
    const drugA = { ...baseDrug, soDangKy: 'VD-12345-19', tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') };
    const drugB = { ...baseDrug, soDangKy: 'VD-99999-20', tuNgay: d('2024-06-01'), denNgay: d('2024-12-31') };
    const catalogIndex = buildCatalogIndex({ drugs: [drugA, drugB] });
    const errorRow = { ...baseErrorRow, soDangKy: 'VD-12345-19', ngayYLenh: d('2024-07-01') };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.chiTietLech).toEqual([]);
    expect(result.ghiChu.some((g) => g.includes('Số đăng ký'))).toBe(true);
  });

  test('cùng mã thuốc + cùng Số đăng ký nhưng khác TT_THAU (đợt thầu khác giá) -> chọn đúng dòng theo TT_THAU trên hồ sơ', () => {
    // Giống tình huống thực tế: 1 số đăng ký có thể trúng thầu nhiều đợt (TT_THAU
    // khác nhau), mỗi đợt giá khác nhau. Không lọc theo TT_THAU sẽ chọn nhầm đợt
    // thầu có tuNgay mới nhất (drugB, đơn giá 987) và báo lệch Đơn giá giả dù hồ sơ
    // khai đúng đơn giá của đợt thầu TT01 (drugA).
    const drugA = { ...baseDrug, ttThau: 'TT01', donGiaBH: 1050, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') };
    const drugB = { ...baseDrug, ttThau: 'TT02', donGiaBH: 987, tuNgay: d('2024-06-01'), denNgay: d('2024-12-31') };
    const catalogIndex = buildCatalogIndex({ drugs: [drugA, drugB] });
    const errorRow = { ...baseErrorRow, ttThau: 'TT01', donGia: 1050, ngayYLenh: d('2024-07-01') };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.chiTietLech).toEqual([]);
    expect(result.ghiChu.some((g) => g.includes('TT_THAU'))).toBe(true);
  });

  test('TT_THAU trên hồ sơ không khớp dòng nào cùng mã thuốc -> ghi chú cảnh báo + vẫn báo lệch', () => {
    const drugA = { ...baseDrug, ttThau: 'TT01', donGiaBH: 1050 };
    const drugB = { ...baseDrug, ttThau: 'TT02', donGiaBH: 987 };
    const catalogIndex = buildCatalogIndex({ drugs: [drugA, drugB] });
    const errorRow = { ...baseErrorRow, ttThau: 'TT99', donGia: 1050 };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ghiChu.some((g) => g.includes('TT_THAU') && g.includes('không khớp'))).toBe(true);
  });

  test('Số đăng ký trên hồ sơ không khớp dòng nào cùng mã thuốc -> ghi chú cảnh báo + vẫn báo lệch Số đăng ký', () => {
    const drugA = { ...baseDrug, soDangKy: 'VD-12345-19' };
    const drugB = { ...baseDrug, soDangKy: 'VD-99999-20' };
    const catalogIndex = buildCatalogIndex({ drugs: [drugA, drugB] });
    const errorRow = { ...baseErrorRow, soDangKy: 'VD-00000-99' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('LECH_DU_LIEU');
    expect(result.chiTietLech.some((c) => c.truong === 'Số đăng ký')).toBe(true);
    expect(result.ghiChu.some((g) => g.includes('không khớp'))).toBe(true);
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

  test('mã nhóm DVKT khai báo sai so với danh mục -> ghi chú flagged independently of chi phí ketLuan', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    catalogIndex.serviceGroupByMa = new Map([['T001', '8']]);
    const errorRow = { ...baseErrorRow, maNhom: '3' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.ghiChu.some((g) => g.includes('T001'))).toBe(true);
    expect(result.nhomDvktMismatch).toBe(true);
  });

  test('mã nhóm DVKT khai báo khớp danh mục -> no extra ghi chú', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    catalogIndex.serviceGroupByMa = new Map([['T001', '8']]);
    const errorRow = { ...baseErrorRow, maNhom: '8' };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ghiChu).toEqual([]);
    expect(result.nhomDvktMismatch).toBe(false);
  });

  test('trái tuyến nhưng tỷ lệ thanh toán vẫn 100% -> ghi chú flagged independently of chi phí ketLuan', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, maDkbd: '36907', maCSKCB: '01007', giayChuyenTuyen: '', tyLeTtBh: 100 };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
    expect(result.ghiChu.some((g) => g.includes('trái tuyến'))).toBe(true);
    expect(result.mucHuongMismatch).toBe(true);
  });

  test('đúng tuyến (mã DKBD khớp mã CSKCB) -> no extra ghi chú', () => {
    const catalogIndex = buildCatalogIndex({ drugs: [baseDrug] });
    const errorRow = { ...baseErrorRow, maDkbd: '01007', maCSKCB: '01007', tyLeTtBh: 100 };
    const result = reconcileRow(errorRow, catalogIndex);
    expect(result.ghiChu).toEqual([]);
    expect(result.mucHuongMismatch).toBe(false);
  });

  describe('vật tư y tế (VAT_TU)', () => {
    const baseVatTu = { maVatTu: 'VT001', tenVatTu: 'Kim luồn tĩnh mạch', donGiaBH: 15000, updatedAt: d('2024-06-01') };
    const baseVatTuRow = {
      maChiPhi: 'VT001',
      loaiChiPhi: 'VAT_TU',
      tenChiPhi: 'Kim luồn tĩnh mạch',
      donGia: 15000,
      lyDoTuChoi: '',
    };

    test('mã vật tư không có trong danh mục -> KHONG_TIM_THAY, loai VAT_TU', () => {
      const catalogIndex = buildCatalogIndex();
      const result = reconcileRow(baseVatTuRow, catalogIndex);
      expect(result.ketLuan).toBe('KHONG_TIM_THAY');
      expect(result.loai).toBe('VAT_TU');
    });

    test('mã vật tư có trong danh mục, mọi trường khớp -> KHONG_LIEN_QUAN_DANH_MUC (không lọc theo ngày y lệnh)', () => {
      const catalogIndex = buildCatalogIndex({ vatTus: [baseVatTu] });
      // Deliberately no ngayYLenh — VatTuCatalogMaster has no tuNgay, so date
      // filtering must not apply and must not produce a "thiếu Ngày y lệnh" ghi chú.
      const result = reconcileRow(baseVatTuRow, catalogIndex);
      expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
      expect(result.chiTietLech).toEqual([]);
      expect(result.ghiChu).toEqual([]);
    });

    test('tên vật tư lệch -> LECH_DU_LIEU với chiTietLech đúng', () => {
      const catalogIndex = buildCatalogIndex({ vatTus: [baseVatTu] });
      const errorRow = { ...baseVatTuRow, tenChiPhi: 'Kim luồn tĩnh mạch 22G' };
      const result = reconcileRow(errorRow, catalogIndex);
      expect(result.ketLuan).toBe('LECH_DU_LIEU');
      expect(result.chiTietLech).toEqual([
        { truong: 'Tên vật tư', giaTriXML: 'Kim luồn tĩnh mạch 22G', giaTriDanhMuc: 'Kim luồn tĩnh mạch' },
      ]);
    });

    test('nhiều dòng vật tư cùng mã -> chọn dòng cập nhật gần nhất và gắn cờ ambiguous trong ghi chú', () => {
      const older = { ...baseVatTu, donGiaBH: 20000, updatedAt: d('2023-01-01') };
      const newer = { ...baseVatTu, donGiaBH: 15000, updatedAt: d('2024-06-01') };
      const catalogIndex = buildCatalogIndex({ vatTus: [older, newer] });
      const result = reconcileRow(baseVatTuRow, catalogIndex);
      expect(result.ketLuan).toBe('KHONG_LIEN_QUAN_DANH_MUC');
      expect(result.ghiChu.some((g) => g.includes('cùng mã'))).toBe(true);
    });
  });
});

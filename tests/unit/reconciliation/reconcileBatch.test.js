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
});

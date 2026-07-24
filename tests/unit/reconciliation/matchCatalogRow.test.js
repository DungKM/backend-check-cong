const { findValidCatalogRow } = require('../../../reconciliation/matchCatalogRow');

function d(str) {
  return new Date(str);
}

describe('findValidCatalogRow', () => {
  test('single candidate, ngayYLenh within range -> matched, not ambiguous', () => {
    const candidates = [{ id: 1, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') }];
    const result = findValidCatalogRow(candidates, d('2024-06-15'));
    expect(result).toEqual({ row: candidates[0], ambiguous: false, matchedCount: 1 });
  });

  test('single candidate, ngayYLenh before tuNgay -> no match', () => {
    const candidates = [{ id: 1, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') }];
    const result = findValidCatalogRow(candidates, d('2023-12-31'));
    expect(result).toEqual({ row: null, ambiguous: false, matchedCount: 0 });
  });

  test('single candidate, ngayYLenh after denNgay -> no match', () => {
    const candidates = [{ id: 1, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') }];
    const result = findValidCatalogRow(candidates, d('2025-01-01'));
    expect(result).toEqual({ row: null, ambiguous: false, matchedCount: 0 });
  });

  test('ngayYLenh exactly equal to tuNgay is inclusive', () => {
    const candidates = [{ id: 1, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') }];
    const result = findValidCatalogRow(candidates, d('2024-01-01'));
    expect(result.row).toBe(candidates[0]);
  });

  test('ngayYLenh exactly equal to denNgay is inclusive', () => {
    const candidates = [{ id: 1, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') }];
    const result = findValidCatalogRow(candidates, d('2024-12-31'));
    expect(result.row).toBe(candidates[0]);
  });

  test('multiple non-overlapping candidates, ngayYLenh falls in exactly one -> matched, not ambiguous', () => {
    const candidates = [
      { id: 1, tuNgay: d('2023-01-01'), denNgay: d('2023-12-31') },
      { id: 2, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') },
    ];
    const result = findValidCatalogRow(candidates, d('2024-06-15'));
    expect(result).toEqual({ row: candidates[1], ambiguous: false, matchedCount: 1 });
  });

  test('multiple overlapping candidates both valid -> ambiguous, deterministic pick (latest tuNgay)', () => {
    const older = { id: 1, tuNgay: d('2024-01-01'), denNgay: d('2024-12-31') };
    const newer = { id: 2, tuNgay: d('2024-06-01'), denNgay: d('2024-12-31') };
    const result = findValidCatalogRow([older, newer], d('2024-07-01'));
    expect(result.ambiguous).toBe(true);
    expect(result.matchedCount).toBe(2);
    expect(result.row).toBe(newer);
  });

  test('empty candidates array -> no match', () => {
    const result = findValidCatalogRow([], d('2024-01-01'));
    expect(result).toEqual({ row: null, ambiguous: false, matchedCount: 0 });
  });

  test('null denNgay (open-ended validity) treated as still valid', () => {
    const candidates = [{ id: 1, tuNgay: d('2024-01-01'), denNgay: null }];
    const result = findValidCatalogRow(candidates, d('2030-01-01'));
    expect(result.row).toBe(candidates[0]);
  });
});

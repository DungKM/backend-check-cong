const { hasCredentials, interpretCheckTheResponse } = require('../../../services/bhxhEgwService');

describe('hasCredentials', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('có đủ username/password -> true', () => {
    process.env.BHXH_EGW_USERNAME = 'user';
    process.env.BHXH_EGW_PASSWORD = 'pass';
    expect(hasCredentials()).toBe(true);
  });

  test('thiếu password -> false', () => {
    process.env.BHXH_EGW_USERNAME = 'user';
    delete process.env.BHXH_EGW_PASSWORD;
    expect(hasCredentials()).toBe(false);
  });

  test('thiếu cả 2 -> false', () => {
    delete process.env.BHXH_EGW_USERNAME;
    delete process.env.BHXH_EGW_PASSWORD;
    expect(hasCredentials()).toBe(false);
  });
});

describe('interpretCheckTheResponse (TẠM THỜI — best-effort, chờ response mẫu thật)', () => {
  test('message chứa "ngày sinh" -> ngaySinhMismatch', () => {
    const result = interpretCheckTheResponse({ message: 'Sai ngày sinh so với dữ liệu thẻ' });
    expect(result.ngaySinhMismatch).toBe(true);
    expect(result.hoTenMismatch).toBe(false);
  });

  test('message chứa "họ tên" -> hoTenMismatch', () => {
    const result = interpretCheckTheResponse({ message: 'Sai họ tên so với dữ liệu thẻ' });
    expect(result.hoTenMismatch).toBe(true);
    expect(result.ngaySinhMismatch).toBe(false);
  });

  test('không có message (khớp CSDL) -> không flag gì', () => {
    const result = interpretCheckTheResponse({});
    expect(result).toEqual({ ngaySinhMismatch: false, hoTenMismatch: false, message: '' });
  });

  test('đọc message từ field "error" khi không có "message"', () => {
    const result = interpretCheckTheResponse({ error: 'Sai ngày sinh' });
    expect(result.ngaySinhMismatch).toBe(true);
  });
});

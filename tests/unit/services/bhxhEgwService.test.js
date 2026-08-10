const { hasCredentials, interpretCheckTheResponse } = require('../../../services/bhxhEgwService');

describe('hasCredentials', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function setAllCredentials() {
    process.env.BHXH_EGW_USERNAME = 'user';
    process.env.BHXH_EGW_PASSWORD = 'pass';
    process.env.BHXH_EGW_HOTENCB = 'Nguyen Van Hung';
    process.env.BHXH_EGW_CCCDCB = '001087019089';
  }

  test('có đủ username/password/hotenCb/cccdCb -> true', () => {
    setAllCredentials();
    expect(hasCredentials()).toBe(true);
  });

  test('thiếu password -> false', () => {
    setAllCredentials();
    delete process.env.BHXH_EGW_PASSWORD;
    expect(hasCredentials()).toBe(false);
  });

  test('thiếu cccdCb (người tra cứu) -> false', () => {
    setAllCredentials();
    delete process.env.BHXH_EGW_CCCDCB;
    expect(hasCredentials()).toBe(false);
  });

  test('thiếu tất cả -> false', () => {
    delete process.env.BHXH_EGW_USERNAME;
    delete process.env.BHXH_EGW_PASSWORD;
    delete process.env.BHXH_EGW_HOTENCB;
    delete process.env.BHXH_EGW_CCCDCB;
    expect(hasCredentials()).toBe(false);
  });
});

describe('interpretCheckTheResponse (mã maKetQua "070"/"061" đã xác nhận qua response mẫu thật)', () => {
  test('response mẫu thật maKetQua "070" (sai ngày sinh, field ghiChu) -> ngaySinhMismatch', () => {
    const result = interpretCheckTheResponse({
      maKetQua: '070',
      ghiChu:
        'Ngày sinh không đúng. Trong trường hợp người tham gia có thắc mắc đề nghị CSYT liên hệ với giám định viên chuyên quản...',
      maThe: null,
    });
    expect(result.ngaySinhMismatch).toBe(true);
    expect(result.hoTenMismatch).toBe(false);
    expect(result.message).toContain('Ngày sinh không đúng');
  });

  test('response mẫu thật maKetQua "061" (sai họ tên, field ghiChu) -> hoTenMismatch', () => {
    const result = interpretCheckTheResponse({
      maKetQua: '061',
      ghiChu: 'Thẻ sai họ tên(đúng kí tự đầu),họ tên đúng : Lê Văn Ánh',
      maThe: 'SV4010126245354',
      hoTen: 'Lê Văn Ánh',
    });
    expect(result.hoTenMismatch).toBe(true);
    expect(result.ngaySinhMismatch).toBe(false);
    expect(result.message).toContain('Thẻ sai họ tên');
  });

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
    expect(result).toEqual({
      ngaySinhMismatch: false,
      hoTenMismatch: false,
      gioiTinhMismatch: false,
      message: '',
    });
  });

  test('đọc message từ field "error" khi không có "message"', () => {
    const result = interpretCheckTheResponse({ error: 'Sai ngày sinh' });
    expect(result.ngaySinhMismatch).toBe(true);
  });
});

describe('interpretCheckTheResponse — giới tính (ML020, so response.gioiTinh với GIOI_TINH khai trên XML)', () => {
  test('response.gioiTinh khác GIOI_TINH XML ("1" = Nam) -> gioiTinhMismatch', () => {
    const result = interpretCheckTheResponse({ gioiTinh: 'Nữ' }, '1');
    expect(result.gioiTinhMismatch).toBe(true);
  });

  test('response.gioiTinh khớp GIOI_TINH XML ("2" = Nữ) -> không flag', () => {
    const result = interpretCheckTheResponse({ gioiTinh: 'Nữ' }, '2');
    expect(result.gioiTinhMismatch).toBe(false);
  });

  test('thiếu response.gioiTinh hoặc expectedGioiTinh -> không flag (không đủ dữ liệu để so)', () => {
    expect(interpretCheckTheResponse({}, '1').gioiTinhMismatch).toBe(false);
    expect(interpretCheckTheResponse({ gioiTinh: 'Nam' }, undefined).gioiTinhMismatch).toBe(false);
  });
});

describe('checkThe — tự lấy lại token khi gặp lỗi (401/403 hoặc lỗi mạng)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.BHXH_EGW_USERNAME = 'user';
    process.env.BHXH_EGW_PASSWORD = 'pass';
    process.env.BHXH_EGW_HOTENCB = 'Nguyen Van Hung';
    process.env.BHXH_EGW_CCCDCB = '001087019089';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function tokenResponse(idToken = 'id1', accessToken = 'tok1') {
    return { ok: true, status: 200, json: async () => ({ APIKey: { id_token: idToken, access_token: accessToken } }) };
  }

  function checkResponse(body) {
    return { ok: true, status: 200, json: async () => body };
  }

  test('lỗi mạng (fetch failed/ECONNRESET) khi gọi check -> lấy token mới và thử lại đúng 1 lần, thành công', async () => {
    const { checkThe } = require('../../../services/bhxhEgwService');

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse()) // takeToken lần đầu (chưa có cachedToken)
      .mockRejectedValueOnce(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } }))
      .mockResolvedValueOnce(tokenResponse('id2', 'tok2')) // lấy lại token sau lỗi mạng
      .mockResolvedValueOnce(checkResponse({ gioiTinh: 'Nam' })); // thử lại thành công

    const result = await checkThe({ maThe: 'SV1', ngaySinh: '01/01/2000', hoTen: 'A' });
    expect(result).toEqual({ gioiTinh: 'Nam' });
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  test('lỗi mạng lặp lại liên tục (3 lần) -> ném lỗi ra ngoài, không lặp vô hạn', async () => {
    const { checkThe } = require('../../../services/bhxhEgwService');

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockRejectedValueOnce(new Error('fetch failed')) // lần thử 1
      .mockResolvedValueOnce(tokenResponse('id2', 'tok2'))
      .mockRejectedValueOnce(new Error('fetch failed')) // lần thử 2
      .mockResolvedValueOnce(tokenResponse('id3', 'tok3'))
      .mockRejectedValueOnce(new Error('fetch failed')); // lần thử 3 -> hết lượt, ném lỗi

    await expect(checkThe({ maThe: 'SV1', ngaySinh: '01/01/2000', hoTen: 'A' })).rejects.toThrow('fetch failed');
    expect(global.fetch).toHaveBeenCalledTimes(6);
  }, 10000);

  test('lỗi xác thực 401 -> lấy token mới và thử lại đúng 1 lần, thành công', async () => {
    const { checkThe } = require('../../../services/bhxhEgwService');

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce(tokenResponse('id2', 'tok2'))
      .mockResolvedValueOnce(checkResponse({ gioiTinh: 'Nữ' }));

    const result = await checkThe({ maThe: 'SV1', ngaySinh: '01/01/2000', hoTen: 'A' });
    expect(result).toEqual({ gioiTinh: 'Nữ' });
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});

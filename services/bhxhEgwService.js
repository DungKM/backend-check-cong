const { normalizeText } = require('../utils/normalizeText');
const { logger } = require('../utils/logger');

// Client cho cổng "egw.baohiemxahoi.gov.vn" — dùng để đối chiếu họ tên/ngày sinh
// trên hồ sơ với CSDL quản lý thẻ BHYT thật của BHXHVN (thay cho suy đoán qua CCCD,
// đã bỏ vì sai bản chất). Tài khoản/mật khẩu, họ tên/CCCD người tra cứu (cán bộ), VÀ
// URL của cổng (BHXH_EGW_TOKEN_URL/BHXH_EGW_CHECK_URL) đều LUÔN đọc từ biến môi
// trường (BHXH_EGW_*), không hard-code trong source — tránh lộ đường dẫn thật của
// cổng nhà nước ra git/code, và cho phép đổi sang URL sandbox/khác mà không sửa code.
// Không log ra console/response lỗi.

// Cache token trong bộ nhớ tiến trình (mất khi restart server). Response có
// "expires_in" (timestamp hết hạn) nhưng chiến lược ở đây vẫn đơn giản: dùng lại
// token cũ tới khi 1 lần gọi check thất bại — do lỗi xác thực (401/403, lấy token mới
// và thử lại đúng 1 lần) HOẶC do lỗi mạng khi gọi (fetch failed/ECONNRESET — đã xác
// nhận thực tế cổng BHXH có thể reset kết nối vài lần liên tiếp, không hẳn do token
// hết hạn, nên thử tối đa 3 lần kèm chờ tăng dần, xem checkThe()) — không cần theo
// dõi expires_in riêng.
let cachedToken = null; // { idToken, token, username }

// hotenCb/cccdCb (họ tên/CCCD người thực hiện tra cứu) là thông tin CỐ ĐỊNH gắn với
// tài khoản cổng của bệnh viện — xác nhận qua ví dụ body thật, KHÔNG lấy theo từng
// bệnh nhân (khác với maThe/ngaySinh/hoTen, luôn lấy từ hồ sơ XML của bệnh nhân đang
// được tra cứu).
function requireCredentials() {
  const username = process.env.BHXH_EGW_USERNAME;
  const password = process.env.BHXH_EGW_PASSWORD;
  const hotenCb = process.env.BHXH_EGW_HOTENCB;
  const cccdCb = process.env.BHXH_EGW_CCCDCB;
  const tokenUrl = process.env.BHXH_EGW_TOKEN_URL;
  const checkUrl = process.env.BHXH_EGW_CHECK_URL;
  if (!username || !password || !hotenCb || !cccdCb || !tokenUrl || !checkUrl) {
    const err = new Error(
      'Chưa cấu hình đủ BHXH_EGW_USERNAME/BHXH_EGW_PASSWORD/BHXH_EGW_HOTENCB/BHXH_EGW_CCCDCB/BHXH_EGW_TOKEN_URL/BHXH_EGW_CHECK_URL trên server'
    );
    err.status = 500;
    throw err;
  }
  return { username, password, hotenCb, cccdCb, tokenUrl, checkUrl };
}

// Cho phép caller (theBhxhBatchCheck.js) kiểm tra trước khi vào vòng lặp gọi API,
// tránh log lỗi lặp lại cho mỗi mã thẻ khi server đơn giản là chưa cấu hình tài khoản.
function hasCredentials() {
  return Boolean(
    process.env.BHXH_EGW_USERNAME &&
      process.env.BHXH_EGW_PASSWORD &&
      process.env.BHXH_EGW_HOTENCB &&
      process.env.BHXH_EGW_CCCDCB &&
      process.env.BHXH_EGW_TOKEN_URL &&
      process.env.BHXH_EGW_CHECK_URL
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeToken() {
  const { username, password, tokenUrl } = requireCredentials();

  const response = await fetch(tokenUrl, {
    method: 'POST',
    // "Connection: close" ép Node đóng socket sau response thay vì giữ lại trong
    // connection pool để tái dùng — cổng BHXH có vẻ tự đóng các socket keep-alive
    // phía server sau một khoảng ngắn, và khi Node cố tái dùng 1 socket đã bị phía
    // server đóng thì fetch ném "fetch failed"/ECONNRESET thay vì tự mở socket mới
    // (đã thấy xảy ra ngay cả sau khi lấy token mới). Ép mỗi request 1 socket mới
    // tránh hẳn tình huống này, đổi lại chậm hơn 1 chút (thêm 1 lần TLS handshake).
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Lỗi khi lấy token cổng BHXH (HTTP ${response.status})`);
    err.status = response.status;
    throw err;
  }

  // Response thật lồng trong "APIKey": { access_token, id_token, token_type, ... }.
  // Tham số "token" mà API check yêu cầu chính là access_token (cùng định dạng
  // hash:username:timestamp thấy trong ví dụ tài liệu và response thật).
  cachedToken = { idToken: data.APIKey?.id_token, token: data.APIKey?.access_token, username };
  return cachedToken;
}

async function callCheckThe(body) {
  const { password, checkUrl } = requireCredentials();
  const params = new URLSearchParams({
    id_token: cachedToken.idToken,
    username: cachedToken.username,
    password,
    token: cachedToken.token,
  });

  // Tài liệu ghi "Method: GET" nhưng ví dụ curl dùng --data mà không có -X/-G — mặc
  // định của curl trong trường hợp đó là POST, nên ví dụ "GET" thực chất đang chạy
  // POST. Dùng POST cho khớp với ví dụ đã xác nhận hoạt động; nếu server thực sự
  // yêu cầu đúng verb GET (ít gặp với body JSON) thì đổi lại ở đây.
  return fetch(`${checkUrl}?${params.toString()}`, {
    method: 'POST',
    // Xem giải thích "Connection: close" ở takeToken().
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify(body),
  });
}

/**
 * Tra cứu/xác thực thẻ BHYT qua cổng BHXH (KQNhanLichSuKCB2024). Tự lấy token nếu
 * chưa có, tự lấy lại đúng 1 lần nếu gặp lỗi xác thực.
 *
 * maThe/ngaySinh/hoTen lấy từ hồ sơ XML (ClaimItem) của bệnh nhân đang tra cứu —
 * caller (theBhxhBatchCheck.js) tự truyền theo từng hồ sơ. hotenCb/cccdCb (người
 * tra cứu) lấy từ biến môi trường, cố định cho mọi lần gọi.
 *
 * Trả về nguyên JSON từ BHXH — dùng interpretCheckTheResponse() bên dưới để suy ra
 * sai ngày sinh/sai họ tên.
 */
async function checkThe({ maThe, ngaySinh, hoTen }) {
  if (!maThe || !ngaySinh || !hoTen) {
    const err = new Error('Thiếu maThe/ngaySinh/hoTen để gọi cổng BHXH');
    err.status = 400;
    throw err;
  }

  const { hotenCb, cccdCb } = requireCredentials();
  const body = { maThe, ngaySinh, hoTen, hotenCb, cccdCb };

  // Lỗi mạng (fetch failed/ECONNRESET) không nhất thiết do token hết hạn — đã xác
  // nhận thực tế cổng BHXH có thể reset kết nối vài lần liên tiếp (tải cao/nghẽn tạm
  // thời phía server), không tự khỏi ngay lập tức. Bọc CẢ bước lấy token (kể cả lần
  // lấy đầu tiên khi cachedToken còn null sau khi restart server — trước đây bước
  // này nằm ngoài vòng lặp nên lỗi mạng ở đúng request lấy token đầu tiên bay thẳng
  // ra ngoài, không được retry) lẫn bước gọi check trong cùng 1 vòng thử tối đa 3
  // lần, chờ tăng dần (300ms/600ms) giữa các lần để cổng BHXH có thời gian hồi phục
  // thay vì dội lại ngay tức thì.
  const MAX_NETWORK_RETRIES = 2;
  let response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      if (!cachedToken) await takeToken();
      response = await callCheckThe(body);
      break;
    } catch (err) {
      // Chỉ log warn cho các lần thử còn retry — lần cuối cùng thất bại (hết lượt) để
      // nguyên lỗi bay lên cho caller (theBhxhBatchCheck.js) log 1 lần duy nhất kèm mã
      // thẻ, tránh log trùng lặp 2 lần cho cùng 1 lỗi cuối cùng.
      if (attempt >= MAX_NETWORK_RETRIES) throw err;
      const causeInfo = err.cause ? ` | cause: ${err.cause.code || err.cause.message || err.cause}` : '';
      const delayMs = 300 * (attempt + 1);
      logger.warn(
        `Lỗi mạng gọi cổng BHXH (mã thẻ ${maThe}), lần ${attempt + 1}/${MAX_NETWORK_RETRIES + 1}: ${err.message}${causeInfo} — thử lại sau ${delayMs}ms`
      );
      await sleep(delayMs);
      cachedToken = null;
    }
  }

  if (response.status === 401 || response.status === 403) {
    await takeToken();
    response = await callCheckThe(body);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Lỗi khi kiểm tra thẻ BHYT qua cổng BHXH (HTTP ${response.status})`);
    err.status = response.status;
    throw err;
  }

  return data;
}

// Response thật của KQNhanLichSuKCB2024 dùng "ghiChu" cho message mô tả lỗi và
// "maKetQua" cho mã kết quả (VD "070" = sai ngày sinh, "061" = sai họ tên, xác nhận
// từ response mẫu thật ngày 2026-08-08). Vẫn giữ các field message/error/mo_ta phổ
// biến khác làm fallback phòng trường hợp BHXH trả về qua nhánh lỗi khác cấu trúc
// field khác.
function extractMessage(raw) {
  return raw?.ghiChu || raw?.message || raw?.Message || raw?.error || raw?.Error || raw?.msg || raw?.mo_ta || '';
}

// Mã kết quả (maKetQua) đã xác nhận qua response mẫu thật — ML011 (sai ngày sinh) và
// ML019 (sai họ tên, ghiChu ví dụ "Thẻ sai họ tên(đúng kí tự đầu),họ tên đúng : ...").
const MA_KET_QUA_NGAY_SINH_SAI = '070';
const MA_KET_QUA_HO_TEN_SAI = '061';

// GIOI_TINH trên XML4210 (XML1/TONG_HOP) là mã số: "1" = Nam, "2" = Nữ — khác định
// dạng chữ "Nam"/"Nữ" mà cổng BHXH trả về trong "gioiTinh" của response. Request check
// thẻ KHÔNG nhận giới tính làm input để BHXH tự validate (không như ngày sinh/họ tên),
// nên sai giới tính (ML020) chỉ phát hiện được bằng cách tự so response.gioiTinh với
// giá trị này khi response có trả về gioiTinh (thẻ tồn tại, bất kể maKetQua gì).
const GIOI_TINH_MA_TO_TEXT = { 1: 'Nam', 2: 'Nữ' };

/**
 * Diễn giải response thô của checkThe() thành sai ngày sinh/sai họ tên/sai giới tính
 * (ML011/ML019/ML020). Ưu tiên mã maKetQua đã xác nhận qua response mẫu thật
 * ("070"/"061"); dò từ khóa "ngày sinh"/"họ tên" trong message (ghiChu) làm fallback
 * nếu BHXH trả mã khác cho cùng loại lỗi này.
 *
 * expectedGioiTinh: giá trị GIOI_TINH (mã số "1"/"2") khai trên hồ sơ XML của bệnh
 * nhân đang tra cứu — so với response.gioiTinh (dạng chữ) để suy ra gioiTinhMismatch;
 * bỏ qua (false) nếu thiếu 1 trong 2 phía.
 *
 * Không có message (hoặc rỗng) và maKetQua không khớp mã lỗi nào đã biết -> coi như
 * khớp CSDL BHXH, không flag gì.
 */
function interpretCheckTheResponse(raw, expectedGioiTinh) {
  const message = extractMessage(raw);
  const normalized = normalizeText(message);

  const ngaySinhMismatch =
    raw?.maKetQua === MA_KET_QUA_NGAY_SINH_SAI || normalized.includes('ngay sinh');
  const hoTenMismatch =
    raw?.maKetQua === MA_KET_QUA_HO_TEN_SAI ||
    normalized.includes('ho ten') ||
    normalized.includes('ten benh nhan');

  const expectedGioiTinhText = GIOI_TINH_MA_TO_TEXT[expectedGioiTinh];
  const gioiTinhMismatch = Boolean(
    raw?.gioiTinh &&
      expectedGioiTinhText &&
      normalizeText(raw.gioiTinh) !== normalizeText(expectedGioiTinhText)
  );

  return { ngaySinhMismatch, hoTenMismatch, gioiTinhMismatch, message };
}

module.exports = { checkThe, hasCredentials, interpretCheckTheResponse };

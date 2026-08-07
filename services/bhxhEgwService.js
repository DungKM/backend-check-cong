const { normalizeText } = require('../utils/normalizeText');

// Client cho cổng "egw.baohiemxahoi.gov.vn" — dùng để đối chiếu họ tên/ngày sinh
// trên hồ sơ với CSDL quản lý thẻ BHYT thật của BHXHVN (thay cho suy đoán qua CCCD,
// đã bỏ vì sai bản chất). Tài khoản/mật khẩu là thông tin đăng nhập thật của bệnh
// viện với cổng nhà nước — LUÔN đọc từ biến môi trường (BHXH_EGW_*), không hard-code,
// không log ra console/response lỗi.
const TOKEN_URL = 'https://egw.baohiemxahoi.gov.vn/api/token/take';
const CHECK_URL = 'https://egw.baohiemxahoi.gov.vn/api/egw/KQNhanLichSuKCB2024';

// Cache token trong bộ nhớ tiến trình (mất khi restart server). Tài liệu API không
// nêu thời hạn token, nên chiến lược ở đây là: dùng lại token cũ tới khi 1 lần gọi
// check trả về lỗi xác thực (401/403), lúc đó lấy token mới và thử lại đúng 1 lần —
// tránh phải đoán TTL.
let cachedToken = null; // { idToken, token, username }

function requireCredentials() {
  const username = process.env.BHXH_EGW_USERNAME;
  const password = process.env.BHXH_EGW_PASSWORD;
  if (!username || !password) {
    const err = new Error('Chưa cấu hình BHXH_EGW_USERNAME/BHXH_EGW_PASSWORD trên server');
    err.status = 500;
    throw err;
  }
  return { username, password };
}

// Cho phép caller (theBhxhBatchCheck.js) kiểm tra trước khi vào vòng lặp gọi API,
// tránh log lỗi lặp lại cho mỗi mã thẻ khi server đơn giản là chưa cấu hình tài khoản.
function hasCredentials() {
  return Boolean(process.env.BHXH_EGW_USERNAME && process.env.BHXH_EGW_PASSWORD);
}

async function takeToken() {
  const { username, password } = requireCredentials();

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Lỗi khi lấy token cổng BHXH (HTTP ${response.status})`);
    err.status = response.status;
    throw err;
  }

  // TODO: chưa có response mẫu thật của /api/token/take — tên field id_token/token
  // đang giả định đúng theo tên tham số mà API check yêu cầu. Xác nhận lại khi có
  // response thật, sửa 2 dòng dưới nếu tên field khác.
  cachedToken = { idToken: data.id_token, token: data.token, username };
  return cachedToken;
}

async function callCheckThe(body) {
  const { password } = requireCredentials();
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
  return fetch(`${CHECK_URL}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Tra cứu/xác thực thẻ BHYT qua cổng BHXH (KQNhanLichSuKCB2024). Tự lấy token nếu
 * chưa có, tự lấy lại đúng 1 lần nếu gặp lỗi xác thực.
 *
 * hotenCb/cccdCb lấy từ chính hoTen/soCCCD của bệnh nhân trên hồ sơ XML (ClaimItem),
 * KHÔNG cố định trong env — caller (route wiring ML011/ML019) phải tự truyền
 * errorRow.hoTen/errorRow.soCCCD vào đây theo từng hồ sơ. Chỉ BHXH_EGW_USERNAME/
 * BHXH_EGW_PASSWORD (tài khoản đăng nhập cổng) là cố định.
 *
 * Trả về nguyên JSON từ BHXH — dùng interpretCheckTheResponse() bên dưới để suy ra
 * sai ngày sinh/sai họ tên.
 */
async function checkThe({ maThe, ngaySinh, hoTen, hotenCb, cccdCb }) {
  if (!maThe || !ngaySinh || !hoTen || !hotenCb || !cccdCb) {
    const err = new Error('Thiếu maThe/ngaySinh/hoTen/hotenCb/cccdCb để gọi cổng BHXH');
    err.status = 400;
    throw err;
  }

  const body = { maThe, ngaySinh, hoTen, hotenCb, cccdCb };

  if (!cachedToken) await takeToken();

  let response = await callCheckThe(body);
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

// Các field message/error hay gặp ở API nhà nước kiểu này khi có sai lệch — chưa có
// response mẫu thật để xác nhận field chính xác BHXH dùng, nên thử lần lượt các tên
// phổ biến. Cần cập nhật lại danh sách này (và cách tách ngaySinhMismatch/hoTenMismatch
// bên dưới) ngay khi có response mẫu thật.
function extractMessage(raw) {
  return raw?.message || raw?.Message || raw?.error || raw?.Error || raw?.msg || raw?.mo_ta || '';
}

/**
 * Diễn giải response thô của checkThe() thành sai ngày sinh/sai họ tên. TẠM THỜI
 * (best-effort): dựa trên giả định "nó sẽ báo response ngay" — có message tiếng Việt
 * mô tả sai lệch — dò từ khóa "ngày sinh"/"họ tên" trong message đó. Không có message
 * (hoặc rỗng) coi như khớp CSDL BHXH, không flag gì. CẦN xác nhận lại với response
 * mẫu thật (khớp/sai ngày sinh/sai họ tên) — có thể BHXH dùng field/cấu trúc khác hẳn.
 */
function interpretCheckTheResponse(raw) {
  const message = extractMessage(raw);
  if (!message) return { ngaySinhMismatch: false, hoTenMismatch: false, message: '' };

  const normalized = normalizeText(message);

  return {
    ngaySinhMismatch: normalized.includes('ngay sinh'),
    hoTenMismatch: normalized.includes('ho ten') || normalized.includes('ten benh nhan'),
    message,
  };
}

module.exports = { checkThe, hasCredentials, interpretCheckTheResponse };

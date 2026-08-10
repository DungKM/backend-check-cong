jest.mock('../../../services/bhxhEgwService');

const bhxhEgwService = require('../../../services/bhxhEgwService');
const { checkTheBhxhForBatch } = require('../../../services/theBhxhBatchCheck');

function row(overrides) {
  return {
    maThe: 'TC3010124582880',
    hoTen: 'Nguyen Van A',
    soCCCD: '001054010978',
    ngaySinh: new Date('1954-03-28'),
    gioiTinh: '1',
    ...overrides,
  };
}

describe('checkTheBhxhForBatch', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('không cấu hình BHXH_EGW_USERNAME/PASSWORD -> bỏ qua hoàn toàn, không gọi API', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(false);

    const result = await checkTheBhxhForBatch([row()]);

    expect(result.size).toBe(0);
    expect(bhxhEgwService.checkThe).not.toHaveBeenCalled();
  });

  test('dedupe theo mã thẻ — 2 dòng cùng mã thẻ chỉ gọi API 1 lần', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);
    bhxhEgwService.checkThe.mockResolvedValue({});
    bhxhEgwService.interpretCheckTheResponse.mockReturnValue({
      ngaySinhMismatch: false,
      hoTenMismatch: false,
      message: '',
    });

    await checkTheBhxhForBatch([row(), row({ maChiPhi: 'khac' })]);

    expect(bhxhEgwService.checkThe).toHaveBeenCalledTimes(1);
  });

  test('BHXH báo sai ngày sinh -> ghi vào map theo mã thẻ', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);
    bhxhEgwService.checkThe.mockResolvedValue({ message: 'Sai ngày sinh' });
    bhxhEgwService.interpretCheckTheResponse.mockReturnValue({
      ngaySinhMismatch: true,
      hoTenMismatch: false,
      message: 'Sai ngày sinh',
    });

    const result = await checkTheBhxhForBatch([row()]);

    expect(result.get('TC3010124582880')).toEqual({
      ngaySinhMismatch: true,
      hoTenMismatch: false,
      message: 'Sai ngày sinh',
    });
  });

  test('BHXH báo sai giới tính -> ghi vào map theo mã thẻ, truyền gioiTinh của XML để so sánh', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);
    bhxhEgwService.checkThe.mockResolvedValue({ gioiTinh: 'Nữ' });
    bhxhEgwService.interpretCheckTheResponse.mockReturnValue({
      ngaySinhMismatch: false,
      hoTenMismatch: false,
      gioiTinhMismatch: true,
      message: '',
    });

    const result = await checkTheBhxhForBatch([row({ gioiTinh: '1' })]);

    expect(bhxhEgwService.interpretCheckTheResponse).toHaveBeenCalledWith({ gioiTinh: 'Nữ' }, '1');
    expect(result.get('TC3010124582880').gioiTinhMismatch).toBe(true);
  });

  test('khớp CSDL (không mismatch) -> không có entry trong map', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);
    bhxhEgwService.checkThe.mockResolvedValue({});
    bhxhEgwService.interpretCheckTheResponse.mockReturnValue({
      ngaySinhMismatch: false,
      hoTenMismatch: false,
      message: '',
    });

    const result = await checkTheBhxhForBatch([row()]);

    expect(result.size).toBe(0);
  });

  test('gọi API cho 1 mã thẻ bị lỗi -> không throw, không có entry, các mã thẻ khác vẫn được xử lý', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);
    bhxhEgwService.checkThe.mockImplementation(async ({ maThe }) => {
      if (maThe === 'LOI001') throw new Error('Cổng BHXH tạm thời không phản hồi');
      return {};
    });
    bhxhEgwService.interpretCheckTheResponse.mockReturnValue({
      ngaySinhMismatch: false,
      hoTenMismatch: false,
      message: '',
    });

    const rows = [row({ maThe: 'LOI001' }), row({ maThe: 'OK002' })];

    await expect(checkTheBhxhForBatch(rows)).resolves.toBeInstanceOf(Map);
    expect(bhxhEgwService.checkThe).toHaveBeenCalledTimes(2);
  });

  test('thiếu ngaySinh/hoTen -> bỏ qua mã thẻ đó, không gọi API', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);

    await checkTheBhxhForBatch([row({ hoTen: '' })]);

    expect(bhxhEgwService.checkThe).not.toHaveBeenCalled();
  });

  test('thiếu soCCCD của bệnh nhân KHÔNG chặn gọi API (cccdCb lấy từ env, không phải từ bệnh nhân)', async () => {
    bhxhEgwService.hasCredentials.mockReturnValue(true);
    bhxhEgwService.checkThe.mockResolvedValue({});
    bhxhEgwService.interpretCheckTheResponse.mockReturnValue({
      ngaySinhMismatch: false,
      hoTenMismatch: false,
      message: '',
    });

    await checkTheBhxhForBatch([row({ soCCCD: '' })]);

    expect(bhxhEgwService.checkThe).toHaveBeenCalledWith({
      maThe: 'TC3010124582880',
      ngaySinh: '28/03/1954',
      hoTen: 'Nguyen Van A',
    });
  });
});

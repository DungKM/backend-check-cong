const { buildDoctorSet, checkBacSi } = require('../../../reconciliation/checkBacSi');

describe('buildDoctorSet + checkBacSi', () => {
  const doctorRows = [{ maCCHN: '0026767/BYT-CCHN' }, { maCCHN: '0015662/BYT-CCHN' }];

  test('no doctor catalog loaded -> no check performed', () => {
    expect(checkBacSi({ maBacSi: '0026767/BYT-CCHN' }, new Set())).toBeNull();
    expect(checkBacSi({ maBacSi: '0026767/BYT-CCHN' }, undefined)).toBeNull();
  });

  test('row has no mã bác sĩ -> nothing to check', () => {
    const doctorSet = buildDoctorSet(doctorRows);
    expect(checkBacSi({ maBacSi: '' }, doctorSet)).toBeNull();
    expect(checkBacSi({}, doctorSet)).toBeNull();
  });

  test('mã bác sĩ matches an approved MACCHN -> no flag', () => {
    const doctorSet = buildDoctorSet(doctorRows);
    expect(checkBacSi({ maBacSi: '0026767/BYT-CCHN' }, doctorSet)).toBeNull();
  });

  test('match is case/whitespace-insensitive', () => {
    const doctorSet = buildDoctorSet(doctorRows);
    expect(checkBacSi({ maBacSi: ' 0026767/byt-cchn ' }, doctorSet)).toBeNull();
  });

  test('mã bác sĩ not in approved catalog -> flagged with a ghi chú message', () => {
    const doctorSet = buildDoctorSet(doctorRows);
    const note = checkBacSi({ maBacSi: '9999999/BYT-CCHN' }, doctorSet);
    expect(note).toEqual(expect.stringContaining('9999999/BYT-CCHN'));
  });
});

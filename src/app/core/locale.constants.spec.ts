import { getLocaleRegistrationCode } from './locale.constants';

describe('getLocaleRegistrationCode', () => {
  it('uses the configured locale code rather than the import-map key', () => {
    expect(getLocaleRegistrationCode('zh_cn')).toBe('zh-cn');
    expect(getLocaleRegistrationCode('pt_br')).toBe('pt-br');
  });
});

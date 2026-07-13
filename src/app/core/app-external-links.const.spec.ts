import { APP_REPOSITORY_URL, QQ_GROUP_URL } from './app-external-links.const';

describe('app external links', () => {
  it('uses the custom GitHub repository and QQ group', () => {
    expect(APP_REPOSITORY_URL).toBe(
      'https://github.com/LarryHeng/super-productivity-desktop-plan',
    );
    expect(QQ_GROUP_URL).toBe(
      'mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1063574147&card_type=group&source=qrcode',
    );
  });
});

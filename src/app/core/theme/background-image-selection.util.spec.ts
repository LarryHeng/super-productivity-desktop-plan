import { selectBackgroundImageSource } from './background-image-selection.util';

describe('selectBackgroundImageSource', () => {
  it('prefers the global software background over the active context background', () => {
    expect(
      selectBackgroundImageSource({
        globalBackgroundImage: 'image:global',
        contextBackgroundImageDark: 'image:dark-context',
        contextBackgroundImageLight: 'image:light-context',
        isDarkMode: false,
      }),
    ).toBe('image:global');
  });

  it('falls back to the active context background when no global background is set', () => {
    expect(
      selectBackgroundImageSource({
        globalBackgroundImage: null,
        contextBackgroundImageDark: 'image:dark-context',
        contextBackgroundImageLight: 'image:light-context',
        isDarkMode: true,
      }),
    ).toBe('image:dark-context');
  });

  it('treats an empty global background as unset', () => {
    expect(
      selectBackgroundImageSource({
        globalBackgroundImage: '   ',
        contextBackgroundImageDark: 'image:dark-context',
        contextBackgroundImageLight: 'image:light-context',
        isDarkMode: false,
      }),
    ).toBe('image:light-context');
  });
});

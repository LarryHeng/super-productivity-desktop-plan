import {
  getBackgroundImageBlur,
  getBackgroundImagePosition,
  getBackgroundOverlayOpacity,
  getResolvedBackgroundOverlayOpacity,
  shouldRenderOnboardingPresets,
} from './app.component';

describe('AppComponent theme helpers', () => {
  describe('getBackgroundOverlayOpacity()', () => {
    it('should use the default overlay opacity when the active context is missing', () => {
      expect(getBackgroundOverlayOpacity(null)).toBe(0.2);
      expect(getBackgroundOverlayOpacity(undefined)).toBe(0.2);
    });

    it('should use the default overlay opacity when a persisted context has a null theme', () => {
      expect(getBackgroundOverlayOpacity({ theme: null })).toBe(0.2);
    });

    it('should resolve configured overlay opacity to a CSS alpha value', () => {
      expect(
        getBackgroundOverlayOpacity({ theme: { backgroundOverlayOpacity: 65 } }),
      ).toBe(0.65);
    });
  });

  describe('getBackgroundImageBlur()', () => {
    it('should use zero blur when the active context is missing', () => {
      expect(getBackgroundImageBlur(null)).toBe(0);
      expect(getBackgroundImageBlur(undefined)).toBe(0);
    });

    it('should use zero blur when a persisted context has a null theme', () => {
      expect(getBackgroundImageBlur({ theme: null })).toBe(0);
    });

    it('should normalize configured blur values', () => {
      expect(getBackgroundImageBlur({ theme: { backgroundImageBlur: 12 } })).toBe(12);
      expect(getBackgroundImageBlur({ theme: { backgroundImageBlur: -5 } })).toBe(0);
    });
  });

  describe('getResolvedBackgroundOverlayOpacity()', () => {
    it('uses the global background opacity when a global background is set', () => {
      expect(
        getResolvedBackgroundOverlayOpacity(
          { theme: { backgroundOverlayOpacity: 65 } },
          'image:global',
          35,
        ),
      ).toBe(0.35);
    });

    it('falls back to the active context opacity when global background is empty', () => {
      expect(
        getResolvedBackgroundOverlayOpacity(
          { theme: { backgroundOverlayOpacity: 65 } },
          '',
          35,
        ),
      ).toBe(0.65);
    });
  });

  describe('getBackgroundImagePosition()', () => {
    it('uses the configured global focal point when the global image is active', () => {
      expect(getBackgroundImagePosition('image:global', 18.4, 83.6)).toBe('18.4% 83.6%');
    });

    it('clamps invalid coordinates and centers context backgrounds', () => {
      expect(getBackgroundImagePosition('image:global', -20, 140)).toBe('0% 100%');
      expect(getBackgroundImagePosition(null, 10, 90)).toBe('50% 50%');
    });
  });

  describe('shouldRenderOnboardingPresets()', () => {
    it('waits until the startup splash is hidden', () => {
      expect(shouldRenderOnboardingPresets(true, true)).toBe(false);
      expect(shouldRenderOnboardingPresets(false, true)).toBe(true);
    });
  });
});

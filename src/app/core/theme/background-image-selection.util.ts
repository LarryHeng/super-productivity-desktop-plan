export interface BackgroundImageSourceInput {
  globalBackgroundImage?: string | null;
  contextBackgroundImageDark?: string | null;
  contextBackgroundImageLight?: string | null;
  isDarkMode: boolean;
}

const normalizeImage = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const selectBackgroundImageSource = ({
  globalBackgroundImage,
  contextBackgroundImageDark,
  contextBackgroundImageLight,
  isDarkMode,
}: BackgroundImageSourceInput): string | null =>
  normalizeImage(globalBackgroundImage) ??
  normalizeImage(isDarkMode ? contextBackgroundImageDark : contextBackgroundImageLight);

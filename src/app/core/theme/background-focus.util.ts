export const normalizeBackgroundFocus = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.round(Math.max(0, Math.min(100, parsed)) * 10) / 10;
};

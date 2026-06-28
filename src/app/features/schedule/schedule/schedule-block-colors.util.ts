export const DEFAULT_PLANNED_BLOCK_COLOR = '#4f86f7';
export const DEFAULT_ACTUAL_BLOCK_COLOR = '#2ca58d';

export const normalizeScheduleBlockColors = (
  planned: string | undefined,
  actual: string | undefined,
): Readonly<{ planned: string; actual: string }> => {
  const normalizedPlanned = normalizeColor(planned, DEFAULT_PLANNED_BLOCK_COLOR);
  const normalizedActual = normalizeColor(actual, DEFAULT_ACTUAL_BLOCK_COLOR);
  if (normalizedPlanned === normalizedActual) {
    throw new Error('Planned and actual block colors must be different');
  }
  return {
    planned: normalizedPlanned,
    actual: normalizedActual,
  };
};

const normalizeColor = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
};

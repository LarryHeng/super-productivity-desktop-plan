export const DEFAULT_PLANNED_BLOCK_COLOR = '#4f86f7';
export const DEFAULT_ACTUAL_BLOCK_COLOR = '#2ca58d';
export const DEFAULT_COMPLETED_PLANNED_BLOCK_COLOR = '#e08b3e';

export const normalizeScheduleBlockColors = (
  planned: string | undefined,
  actual: string | undefined,
  completedPlanned: string | undefined,
): Readonly<{ planned: string; actual: string; completedPlanned: string }> => {
  const normalizedPlanned = normalizeColor(planned, DEFAULT_PLANNED_BLOCK_COLOR);
  const normalizedActual = normalizeColor(actual, DEFAULT_ACTUAL_BLOCK_COLOR);
  const normalizedCompletedPlanned = normalizeColor(
    completedPlanned,
    DEFAULT_COMPLETED_PLANNED_BLOCK_COLOR,
  );
  if (
    new Set([normalizedPlanned, normalizedActual, normalizedCompletedPlanned]).size !== 3
  ) {
    throw new Error('Schedule block colors must be different');
  }
  return {
    planned: normalizedPlanned,
    actual: normalizedActual,
    completedPlanned: normalizedCompletedPlanned,
  };
};

const normalizeColor = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
};

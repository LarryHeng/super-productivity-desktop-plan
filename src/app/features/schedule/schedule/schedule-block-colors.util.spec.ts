import {
  DEFAULT_ACTUAL_BLOCK_COLOR,
  DEFAULT_COMPLETED_PLANNED_BLOCK_COLOR,
  DEFAULT_PLANNED_BLOCK_COLOR,
  normalizeScheduleBlockColors,
} from './schedule-block-colors.util';

describe('normalizeScheduleBlockColors', () => {
  it('uses distinct defaults for missing values', () => {
    expect(normalizeScheduleBlockColors(undefined, undefined, undefined)).toEqual({
      planned: DEFAULT_PLANNED_BLOCK_COLOR,
      actual: DEFAULT_ACTUAL_BLOCK_COLOR,
      completedPlanned: DEFAULT_COMPLETED_PLANNED_BLOCK_COLOR,
    });
  });

  it('rejects any matching block colors', () => {
    expect(() =>
      normalizeScheduleBlockColors('#123456', '#123456', '#654321'),
    ).toThrowError(/different/i);
    expect(() =>
      normalizeScheduleBlockColors('#123456', '#654321', '#123456'),
    ).toThrowError(/different/i);
  });

  it('normalizes valid hex colors', () => {
    expect(normalizeScheduleBlockColors('#ABCDEF', '#123456', '#FEDCBA')).toEqual({
      planned: '#abcdef',
      actual: '#123456',
      completedPlanned: '#fedcba',
    });
  });
});

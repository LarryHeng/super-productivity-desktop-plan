import {
  DEFAULT_ACTUAL_BLOCK_COLOR,
  DEFAULT_PLANNED_BLOCK_COLOR,
  normalizeScheduleBlockColors,
} from './schedule-block-colors.util';

describe('normalizeScheduleBlockColors', () => {
  it('uses distinct defaults for missing values', () => {
    expect(normalizeScheduleBlockColors(undefined, undefined)).toEqual({
      planned: DEFAULT_PLANNED_BLOCK_COLOR,
      actual: DEFAULT_ACTUAL_BLOCK_COLOR,
    });
  });

  it('rejects matching planned and actual colors', () => {
    expect(() => normalizeScheduleBlockColors('#123456', '#123456')).toThrowError(
      /different/i,
    );
  });

  it('normalizes valid hex colors', () => {
    expect(normalizeScheduleBlockColors('#ABCDEF', '#123456')).toEqual({
      planned: '#abcdef',
      actual: '#123456',
    });
  });
});

import { SCHEDULE_FORM_CFG } from './schedule-form.const';

describe('SCHEDULE_FORM_CFG', () => {
  it('limits the actual-block merge gap setting to thirty minutes', () => {
    const field = SCHEDULE_FORM_CFG.items?.find(
      (item) => String(item.key) === 'actualTimeMergeGapMinutes',
    );

    expect(field?.type).toBe('slider');
    expect(field?.templateOptions?.min).toBe(0);
    expect(field?.templateOptions?.max).toBe(30);
    expect(field?.templateOptions?.step).toBe(1);
  });
});

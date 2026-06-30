import { expect, test } from '../../fixtures/test.fixture';
import { waitForAngularStability } from '../../utils/waits';

test.describe('Desktop plan smoke', () => {
  test('creates a task with the required estimate', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('desktop-plan-smoke');

    await expect(
      page.locator('task').filter({ hasText: `${testPrefix}-desktop-plan-smoke` }),
    ).toHaveCount(1);
  });

  test('shows week return-to-today controls and all timeline block colors', async ({
    page,
  }) => {
    await page.goto('/#/planner');
    await waitForAngularStability(page);
    await expect(page.getByTestId('planner-week-return-today')).toBeVisible();

    await page.goto('/#/schedule');
    await waitForAngularStability(page);
    await expect(page.getByTestId('schedule-week-return-today')).toBeVisible();

    await page.getByRole('button', { name: 'Timeline block colors' }).click();
    await expect(
      page.getByRole('textbox', { name: 'Planned time', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Actual time', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Backfilled time', exact: true }),
    ).toBeVisible();
  });
});

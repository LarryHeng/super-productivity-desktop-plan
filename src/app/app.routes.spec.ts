import { APP_ROUTES } from './app.routes';

describe('APP_ROUTES', () => {
  it('does not register a donate page', () => {
    expect(APP_ROUTES.some((route) => route.path === 'donate')).toBe(false);
  });
});

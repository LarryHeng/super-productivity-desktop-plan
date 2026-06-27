import { TestBed } from '@angular/core/testing';
import { TaskWidgetSettingsService } from './task-widget-settings.service';

const STORAGE_KEY = 'sp_task_widget_settings';

describe('TaskWidgetSettingsService', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('returns default settings when localStorage is empty', () => {
    const service = TestBed.inject(TaskWidgetSettingsService);

    expect(service.settings()).toEqual({
      isEnabled: false,
      isAlwaysShow: true,
      opacity: 95,
      contentOpacity: 100,
      backgroundImage: null,
      backgroundImageOpacity: 45,
    });
  });

  it('loads existing settings from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isEnabled: true, opacity: 70 }));

    const service = TestBed.inject(TaskWidgetSettingsService);

    expect(service.settings()).toEqual({
      isEnabled: true,
      isAlwaysShow: true,
      opacity: 70,
      contentOpacity: 100,
      backgroundImage: null,
      backgroundImageOpacity: 45,
    });
  });

  it('merges partial updates and persists them', () => {
    const service = TestBed.inject(TaskWidgetSettingsService);

    service.update({ isEnabled: true, opacity: 50 });

    expect(service.settings()).toEqual({
      isEnabled: true,
      isAlwaysShow: true,
      opacity: 50,
      contentOpacity: 100,
      backgroundImage: null,
      backgroundImageOpacity: 45,
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      isEnabled: true,
      isAlwaysShow: true,
      opacity: 50,
      contentOpacity: 100,
      backgroundImage: null,
      backgroundImageOpacity: 45,
    });
  });

  it('falls back to defaults if stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');

    const service = TestBed.inject(TaskWidgetSettingsService);

    expect(service.settings()).toEqual({
      isEnabled: false,
      isAlwaysShow: true,
      opacity: 95,
      contentOpacity: 100,
      backgroundImage: null,
      backgroundImageOpacity: 45,
    });
  });
});

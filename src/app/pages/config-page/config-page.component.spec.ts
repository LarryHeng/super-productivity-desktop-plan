import { TestBed } from '@angular/core/testing';
import { ConfigPageComponent } from './config-page.component';
import { SyncConfigService } from '../../imex/sync/sync-config.service';
import { SnackService } from '../../core/snack/snack.service';
import { SyncProviderManager } from '../../op-log/sync-providers/provider-manager.service';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { ActivatedRoute } from '@angular/router';
import { PluginBridgeService } from '../../plugins/plugin-bridge.service';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { SyncWrapperService } from '../../imex/sync/sync-wrapper.service';
import { ShareService } from '../../core/share/share.service';
import { UserProfileService } from '../../features/user-profile/user-profile.service';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { LocalBackupService } from '../../imex/local-backup/local-backup.service';
import { IS_ANDROID_WEB_VIEW_TOKEN } from '../../util/is-android-web-view';
import { T } from '../../t.const';
import { IS_ELECTRON_TOKEN } from '../../app.constants';

describe('ConfigPageComponent', () => {
  let component: ConfigPageComponent;
  let mockSyncWrapperService: jasmine.SpyObj<SyncWrapperService>;
  let mockMatDialog: jasmine.SpyObj<MatDialog>;
  let mockProviderManager: jasmine.SpyObj<SyncProviderManager>;
  let mockLocalBackupService: jasmine.SpyObj<LocalBackupService>;
  let mockSnackService: jasmine.SpyObj<SnackService>;
  let mockElectronApi: {
    getBackupPathInfo: jasmine.Spy;
    pickBackupLinkTarget: jasmine.Spy;
  };
  let originalEaDescriptor: PropertyDescriptor | undefined;

  const setup = async (
    isAndroidWebView: boolean = false,
    lastBackupTime: number | null = null,
    isElectron: boolean = false,
  ): Promise<void> => {
    const mockSyncConfigService = jasmine.createSpyObj(
      'SyncConfigService',
      ['updateSettingsFromForm'],
      { syncSettingsForm$: of({}) },
    );
    mockSyncConfigService.updateSettingsFromForm.and.returnValue(Promise.resolve());

    mockSyncWrapperService = jasmine.createSpyObj('SyncWrapperService', ['sync']);
    mockMatDialog = jasmine.createSpyObj('MatDialog', ['open']);
    mockProviderManager = jasmine.createSpyObj(
      'SyncProviderManager',
      ['getProviderById'],
      {
        currentProviderPrivateCfg$: of(null),
      },
    );
    mockProviderManager.getProviderById.and.returnValue(Promise.resolve(undefined));
    mockLocalBackupService = jasmine.createSpyObj('LocalBackupService', [
      'restoreLatestMobileBackupFromSettings',
      'getLastBackupTime',
    ]);
    mockLocalBackupService.restoreLatestMobileBackupFromSettings.and.resolveTo();
    mockLocalBackupService.getLastBackupTime.and.returnValue(lastBackupTime);
    mockSnackService = jasmine.createSpyObj('SnackService', ['open']);
    mockElectronApi = {
      getBackupPathInfo: jasmine.createSpy('getBackupPathInfo').and.resolveTo({
        backupDir: 'C:\\Users\\Larry\\AppData\\Roaming\\superProductivity\\backups',
        effectiveDir: 'F:\\Documents\\superProductivity\\backups',
        linkTarget: 'F:\\Documents\\superProductivity\\backups',
      }),
      pickBackupLinkTarget: jasmine.createSpy('pickBackupLinkTarget').and.resolveTo({
        backupDir: 'C:\\Users\\Larry\\AppData\\Roaming\\superProductivity\\backups',
        effectiveDir: 'F:\\Documents\\superProductivity\\backups',
        linkTarget: 'F:\\Documents\\superProductivity\\backups',
      }),
    };
    Object.defineProperty(window, 'ea', {
      configurable: true,
      writable: true,
      value: mockElectronApi,
    });

    const mockTranslateService = jasmine.createSpyObj('TranslateService', ['instant']);
    // Mirror real ngx-translate: return the key (with params ignored) so the
    // "Last backup" line is a deterministic, non-empty string.
    mockTranslateService.instant.and.callFake((key: string) => key);

    await TestBed.configureTestingModule({
      providers: [
        { provide: SyncConfigService, useValue: mockSyncConfigService },
        { provide: IS_ANDROID_WEB_VIEW_TOKEN, useValue: isAndroidWebView },
        { provide: IS_ELECTRON_TOKEN, useValue: isElectron },
        {
          provide: SnackService,
          useValue: mockSnackService,
        },
        { provide: SyncProviderManager, useValue: mockProviderManager },
        {
          provide: GlobalConfigService,
          useValue: jasmine.createSpyObj('GlobalConfigService', ['updateSection'], {
            cfg$: of({}),
            sync$: of({}),
          }),
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: PluginBridgeService, useValue: { shortcuts: signal([]) } },
        { provide: SyncWrapperService, useValue: mockSyncWrapperService },
        { provide: ShareService, useValue: {} },
        { provide: UserProfileService, useValue: {} },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: LocalBackupService, useValue: mockLocalBackupService },
        {
          provide: TranslateService,
          useValue: mockTranslateService,
        },
      ],
    })
      .overrideComponent(ConfigPageComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    component = TestBed.createComponent(ConfigPageComponent).componentInstance;
  };

  beforeEach(async () => {
    originalEaDescriptor = Object.getOwnPropertyDescriptor(window, 'ea');
    await setup();
  });

  afterEach(() => {
    if (originalEaDescriptor) {
      Object.defineProperty(window, 'ea', originalEaDescriptor);
    } else {
      delete (window as Partial<Window>).ea;
    }
  });

  it('should expose an empty syncStatus by default', () => {
    expect(component.syncStatus().providerId).toBeNull();
    expect(component.syncStatus().needsAuth).toBe(false);
  });

  it('triggerSync() should call SyncWrapperService.sync()', () => {
    component.triggerSync();
    expect(mockSyncWrapperService.sync).toHaveBeenCalled();
  });

  it('openSyncCfgDialog() should open DialogSyncCfgComponent', async () => {
    await component.openSyncCfgDialog();
    expect(mockMatDialog.open).toHaveBeenCalled();
  });

  it('should expose Android automatic backup restore action', async () => {
    TestBed.resetTestingModule();
    await setup(true);

    const automaticBackupsSection = component.globalImexFormCfg.find(
      (section) => section.key === 'localBackup',
    );
    const action = automaticBackupsSection?.actions?.[0];

    expect(action?.label).toBe(T.GCF.AUTO_BACKUPS.RESTORE_LATEST);

    await action?.onClick();

    expect(
      mockLocalBackupService.restoreLatestMobileBackupFromSettings,
    ).toHaveBeenCalled();
  });

  it('should expose Electron automatic backup link target action', async () => {
    TestBed.resetTestingModule();
    await setup(false, null, true);
    await Promise.resolve();

    const automaticBackupsSection = component.globalImexFormCfg.find(
      (section) => section.key === 'localBackup',
    );
    const action = automaticBackupsSection?.actions?.find(
      (sectionAction) => sectionAction.label === 'GCF.AUTO_BACKUPS.CHOOSE_LINK_TARGET',
    );

    expect(mockElectronApi.getBackupPathInfo).toHaveBeenCalled();
    expect(action).toBeTruthy();

    await action?.onClick();

    expect(mockElectronApi.pickBackupLinkTarget).toHaveBeenCalled();
    expect(mockSnackService.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'SUCCESS',
        translateParams: {
          path: 'F:\\Documents\\superProductivity\\backups',
        },
      }),
    );
  });

  it('shows one physical backup folder instead of presenting the junction as a second backup', async () => {
    TestBed.resetTestingModule();
    await setup(false, null, true);
    await Promise.resolve();

    const section = component.globalImexFormCfg.find((s) => s.key === 'localBackup');
    const renderedText = JSON.stringify(section?.items ?? []);

    expect(renderedText).toContain('F:\\\\Documents\\\\superProductivity\\\\backups');
    expect(renderedText).not.toContain(
      'C:\\\\Users\\\\Larry\\\\AppData\\\\Roaming\\\\superProductivity\\\\backups',
    );
  });

  const findLastBackupLine = (): unknown => {
    const section = component.globalImexFormCfg.find((s) => s.key === 'localBackup');
    const items = (section?.items ?? []) as Array<{
      type?: string;
      templateOptions?: { text?: string };
    }>;
    return items.find(
      (i) =>
        i.type === 'tpl' &&
        i.templateOptions?.text === T.GCF.AUTO_BACKUPS.LAST_BACKUP_INFO,
    );
  };

  it('shows the "Last backup" line when a backup timestamp exists (#7901)', async () => {
    TestBed.resetTestingModule();
    await setup(true, 1_718_000_000_000);

    expect(mockLocalBackupService.getLastBackupTime).toHaveBeenCalled();
    expect(findLastBackupLine()).toBeTruthy();
  });

  it('omits the "Last backup" line when no backup has run yet', async () => {
    TestBed.resetTestingModule();
    await setup(true, null);

    expect(findLastBackupLine()).toBeUndefined();
  });
});

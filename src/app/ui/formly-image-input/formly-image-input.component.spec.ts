import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { UnsplashService } from '../../core/unsplash/unsplash.service';
import { SnackService } from '../../core/snack/snack.service';
import { T } from '../../t.const';
import { FormlyImageInputComponent } from './formly-image-input.component';

describe('FormlyImageInputComponent', () => {
  let fixture: ComponentFixture<FormlyImageInputComponent>;
  let component: FormlyImageInputComponent;
  let formControl: FormControl<string | null>;
  let snackService: jasmine.SpyObj<SnackService>;

  beforeEach(async () => {
    snackService = jasmine.createSpyObj<SnackService>('SnackService', ['open']);
    const matDialogMock = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    const unsplashServiceMock = jasmine.createSpyObj<UnsplashService>('UnsplashService', [
      'isAvailable',
    ]);
    unsplashServiceMock.isAvailable.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [
        FormlyImageInputComponent,
        FormlyModule.forRoot(),
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: SnackService, useValue: snackService },
        { provide: MatDialog, useValue: matDialogMock },
        { provide: UnsplashService, useValue: unsplashServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormlyImageInputComponent);
    component = fixture.componentInstance;
    formControl = new FormControl<string | null>(null);
    Object.defineProperty(component, 'formControl', {
      get: () => formControl,
      configurable: true,
    });
    component.field = { props: {}, templateOptions: {} } as any;
    fixture.detectChanges();
  });

  const createEvent = (file?: File): Event => {
    return {
      target: {
        files: file ? [file] : [],
        value: 'some-value',
      },
    } as unknown as Event;
  };

  it('sets data url for successful file reads', () => {
    const fileReaderMock: Partial<FileReader> = {
      result: 'data:image/png;base64,ok',
      readAsDataURL: jasmine.createSpy('readAsDataURL').and.callFake(function (
        this: FileReader,
      ) {
        this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
      }),
      onload: null,
      onerror: null,
    };
    spyOn(window as any, 'FileReader').and.returnValue(fileReaderMock as FileReader);
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();

    const file = new File(['ok'], 'ok.png', { type: 'image/png' });
    component.onFileSelected(createEvent(file));

    expect(setValueSpy).toHaveBeenCalledWith('data:image/png;base64,ok');
    expect(snackService.open).not.toHaveBeenCalled();
  });

  it('handles cancel path without reading file', () => {
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();
    const event = createEvent(undefined);

    component.onFileSelected(event);

    expect((event.target as HTMLInputElement).value).toBe('');
    expect(setValueSpy).not.toHaveBeenCalled();
    expect(snackService.open).not.toHaveBeenCalled();
  });

  it('clears the selected image', () => {
    formControl.setValue(`image:${'e'.repeat(32)}`);
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();

    component.clearImage();

    expect(setValueSpy).toHaveBeenCalledWith(null);
  });

  it('uses explicit theme and global modes for task widget backgrounds', () => {
    component.field = {
      props: { taskWidgetBackgroundModes: true },
      templateOptions: { taskWidgetBackgroundModes: true },
    } as any;
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();

    component.restoreTaskWidgetTheme();
    component.useGlobalTaskWidgetBackground();

    expect(setValueSpy.calls.allArgs()).toEqual([['task-widget:theme'], [null]]);
  });

  it('stores a clicked background focal point in sibling form controls', () => {
    const form = new FormGroup({
      backgroundImage: formControl,
      backgroundPositionX: new FormControl(50),
      backgroundPositionY: new FormControl(50),
    });
    Object.defineProperty(component, 'form', {
      get: () => form,
      configurable: true,
    });
    component.field = {
      props: {
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
      templateOptions: {
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
    } as any;

    component.setBackgroundFocus({
      clientX: 150,
      clientY: 125,
      currentTarget: {
        getBoundingClientRect: () => ({
          left: 100,
          top: 50,
          width: 200,
          height: 100,
        }),
      },
    } as unknown as PointerEvent);

    expect(form.controls.backgroundPositionX.value).toBe(25);
    expect(form.controls.backgroundPositionY.value).toBe(75);
    expect(component.backgroundFocusX()).toBe(25);
    expect(component.backgroundFocusY()).toBe(75);
  });

  it('updates both focal coordinates with one form emission', () => {
    const form = new FormGroup({
      backgroundImage: formControl,
      backgroundPositionX: new FormControl(50),
      backgroundPositionY: new FormControl(50),
    });
    Object.defineProperty(component, 'form', {
      get: () => form,
      configurable: true,
    });
    component.field = {
      props: {
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
      templateOptions: {
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
    } as any;
    let formEmissions = 0;
    form.valueChanges.subscribe(() => formEmissions++);

    component.setBackgroundFocus({
      clientX: 150,
      clientY: 125,
      currentTarget: {
        getBoundingClientRect: () => ({
          left: 100,
          top: 50,
          width: 200,
          height: 100,
        }),
      },
    } as unknown as PointerEvent);

    expect(formEmissions).toBe(1);
  });

  it('keeps the settings scroll position while saving a focal point', fakeAsync(() => {
    const form = new FormGroup({
      backgroundImage: formControl,
      backgroundPositionX: new FormControl(50),
      backgroundPositionY: new FormControl(50),
    });
    Object.defineProperty(component, 'form', {
      get: () => form,
      configurable: true,
    });
    component.field = {
      props: {
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
      templateOptions: {
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
    } as any;

    const scrollHost = document.createElement('div');
    scrollHost.style.overflowY = 'auto';
    Object.defineProperty(scrollHost, 'clientHeight', { value: 200 });
    Object.defineProperty(scrollHost, 'scrollHeight', { value: 1000 });
    let scrollTop = 240;
    Object.defineProperty(scrollHost, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    const focusTarget = document.createElement('button');
    scrollHost.appendChild(focusTarget);
    document.body.appendChild(scrollHost);
    spyOn(focusTarget, 'getBoundingClientRect').and.returnValue({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    } as DOMRect);

    component.setBackgroundFocus({
      clientX: 150,
      clientY: 125,
      currentTarget: focusTarget,
    } as unknown as PointerEvent);
    scrollHost.scrollTop = 120;
    tick(40);

    expect(scrollHost.scrollTop).toBe(240);
    scrollHost.remove();
  }));

  it('exposes the managed image path in task widget mode', async () => {
    component.field = {
      props: { taskWidgetBackgroundModes: true },
      templateOptions: { taskWidgetBackgroundModes: true },
    } as any;
    (component as any).IS_ELECTRON = true;
    (window as any).ea = {
      imageCacheGetDisplayPath: jasmine
        .createSpy('imageCacheGetDisplayPath')
        .and.resolveTo(
          `F:\\Documents\\superProductivity\\bg-images\\${'a'.repeat(32)}.jpg`,
        ),
    };

    expect(component.isTaskWidgetBackgroundMode).toBeTrue();
    formControl.setValue(`image:${'a'.repeat(32)}`);
    await fixture.whenStable();
    expect(component.taskWidgetBackgroundReference()).toBe(
      `F:\\Documents\\superProductivity\\bg-images\\${'a'.repeat(32)}.jpg`,
    );
  });

  it('rejects oversized files with snack', () => {
    const largeBytes = new Uint8Array(257 * 1024);
    const file = new File([largeBytes], 'large.png', { type: 'image/png' });
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();

    component.onFileSelected(createEvent(file));

    expect(setValueSpy).not.toHaveBeenCalled();
    expect(snackService.open).toHaveBeenCalledWith({
      msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_IMAGE_TOO_LARGE,
      type: 'ERROR',
      translateParams: { maxSizeKb: 256 },
    });
  });

  it('shows snack when file reading fails', () => {
    const fileReaderMock: Partial<FileReader> = {
      readAsDataURL: jasmine.createSpy('readAsDataURL').and.callFake(function (
        this: FileReader,
      ) {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
      }),
      onload: null,
      onerror: null,
    };
    spyOn(window as any, 'FileReader').and.returnValue(fileReaderMock as FileReader);
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();
    const file = new File(['bad'], 'bad.png', { type: 'image/png' });

    component.onFileSelected(createEvent(file));

    expect(setValueSpy).not.toHaveBeenCalled();
    expect(snackService.open).toHaveBeenCalledWith({
      msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_IMAGE_READ_ERROR,
      type: 'ERROR',
    });
  });

  it('triggers the atomic pick+import IPC and stores image:<id>', async () => {
    (component as any).IS_ELECTRON = true;

    const imagePickAndImport = jasmine
      .createSpy('imagePickAndImport')
      .and.resolveTo({ id: 'a'.repeat(32), mimeType: 'image/png' });

    (window as any).ea = { imagePickAndImport };

    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();

    await component.openFileExplorer();

    expect(imagePickAndImport).toHaveBeenCalledWith();
    expect(setValueSpy).toHaveBeenCalledWith(`image:${'a'.repeat(32)}`);
  });

  it('does not pass the previous image id before the form save is durable', async () => {
    (component as any).IS_ELECTRON = true;
    formControl.setValue(`image:${'b'.repeat(32)}`);

    const imagePickAndImport = jasmine
      .createSpy('imagePickAndImport')
      .and.resolveTo({ id: 'c'.repeat(32), mimeType: 'image/png' });
    (window as any).ea = { imagePickAndImport };

    await component.openFileExplorer();

    expect(imagePickAndImport).toHaveBeenCalledWith();
  });

  it('shows a snack on validation failure (Error return) but not on cancel (null)', async () => {
    (component as any).IS_ELECTRON = true;
    const setValueSpy = spyOn(formControl, 'setValue').and.callThrough();

    // Cancel: returns null, no snack, no setValue.
    (window as any).ea = {
      imagePickAndImport: jasmine.createSpy('imagePickAndImport').and.resolveTo(null),
    };
    await component.openFileExplorer();
    expect(setValueSpy).not.toHaveBeenCalled();
    expect(snackService.open).not.toHaveBeenCalled();

    // Failure: IPC returns an Error (parity with FS handlers' contract).
    (window as any).ea = {
      imagePickAndImport: jasmine
        .createSpy('imagePickAndImport')
        .and.resolveTo(new Error('Selected image could not be imported')),
    };
    await component.openFileExplorer();
    expect(setValueSpy).not.toHaveBeenCalled();
    expect(snackService.open).toHaveBeenCalledWith({
      msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_IMAGE_READ_ERROR,
      type: 'ERROR',
    });
  });

  it('blocks a second concurrent click while a pick is in flight', async () => {
    (component as any).IS_ELECTRON = true;
    let resolveFirst!: (v: { id: string; mimeType: string }) => void;
    const imagePickAndImport = jasmine.createSpy('imagePickAndImport').and.callFake(
      () =>
        new Promise<{ id: string; mimeType: string }>((r) => {
          resolveFirst = r;
        }),
    );
    (window as any).ea = { imagePickAndImport };

    const firstClick = component.openFileExplorer();
    // Second click while the first is awaiting must be a no-op so the form
    // does not queue multiple imports and orphan all but the last selected one.
    await component.openFileExplorer();
    expect(imagePickAndImport).toHaveBeenCalledTimes(1);
    expect(component.isPickerBusy()).toBe(true);

    resolveFirst({ id: 'd'.repeat(32), mimeType: 'image/png' });
    await firstClick;
    expect(component.isPickerBusy()).toBe(false);
  });
});

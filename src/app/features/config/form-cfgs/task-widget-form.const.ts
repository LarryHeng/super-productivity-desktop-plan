import {
  ConfigFormSection,
  LimitedFormlyFieldConfig,
  TaskWidgetConfig,
} from '../global-config.model';
import { T } from '../../../t.const';

export const TASK_WIDGET_FORM_CFG: ConfigFormSection<TaskWidgetConfig> = {
  title: T.GCF.TASK_WIDGET.TITLE,
  key: 'taskWidget',
  isElectronOnly: true,
  items: [
    {
      key: 'isEnabled',
      type: 'checkbox',
      templateOptions: {
        label: T.GCF.TASK_WIDGET.IS_ENABLED,
      },
    },
    {
      key: 'isAlwaysShow',
      type: 'checkbox',
      templateOptions: {
        label: T.GCF.TASK_WIDGET.IS_ALWAYS_SHOW,
      },
    },
    {
      key: 'opacity',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 100,
        label: T.GCF.TASK_WIDGET.OPACITY,
      },
    },
    {
      key: 'contentOpacity',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 100,
        label: T.GCF.TASK_WIDGET.CONTENT_OPACITY,
      },
    },
    {
      key: 'backgroundImage',
      type: 'image-input',
      templateOptions: {
        label: T.F.PROJECT.FORM_THEME.L_BACKGROUND_IMAGE_LIGHT,
        taskWidgetBackgroundModes: true,
        managedImageLibraryControls: true,
        backgroundFocusXKey: 'backgroundPositionX',
        backgroundFocusYKey: 'backgroundPositionY',
      },
    },
    {
      key: 'backgroundPositionX',
      type: 'input',
      className: 'background-focus-storage-field',
      defaultValue: 50,
      templateOptions: {
        type: 'number',
      },
    },
    {
      key: 'backgroundPositionY',
      type: 'input',
      className: 'background-focus-storage-field',
      defaultValue: 50,
      templateOptions: {
        type: 'number',
      },
    },
  ] as LimitedFormlyFieldConfig<TaskWidgetConfig>[],
};

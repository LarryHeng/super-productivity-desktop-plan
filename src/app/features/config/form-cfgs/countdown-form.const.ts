import {
  ConfigFormSection,
  LimitedFormlyFieldConfig,
  MiscConfig,
} from '../global-config.model';
import { T } from '../../../t.const';

export const COUNTDOWN_FORM_CFG: ConfigFormSection<MiscConfig> = {
  title: T.GCF.COUNTDOWN.TITLE,
  key: 'misc',
  help: T.GCF.COUNTDOWN.HELP,
  items: [
    {
      key: 'countdownTargetName',
      type: 'input',
      templateOptions: {
        label: T.GCF.MISC.COUNTDOWN_TARGET_NAME,
        placeholder: '例如: 春节、项目截止',
      },
    },
    {
      key: 'countdownTargetDate',
      type: 'input',
      templateOptions: {
        type: 'date',
        label: T.GCF.MISC.COUNTDOWN_TARGET_DATE,
        description: '点击右侧日历图标选择日期，以北京时间 (UTC+8) 结算。',
      },
    },
    // --- 软件本体样式 ---
    {
      key: 'countdownNameColor',
      type: 'input',
      templateOptions: {
        type: 'color',
        label: T.GCF.MISC.COUNTDOWN_NAME_COLOR,
      },
    },
    {
      key: 'countdownNameFontSize',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 36,
        label: T.GCF.MISC.COUNTDOWN_NAME_FONT_SIZE,
      },
    },
    {
      key: 'countdownDaysColor',
      type: 'input',
      templateOptions: {
        type: 'color',
        label: T.GCF.MISC.COUNTDOWN_DAYS_COLOR,
      },
    },
    {
      key: 'countdownDaysFontSize',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 36,
        label: T.GCF.MISC.COUNTDOWN_DAYS_FONT_SIZE,
      },
    },
    {
      key: 'countdownIsBold',
      type: 'checkbox',
      templateOptions: {
        label: T.GCF.MISC.COUNTDOWN_IS_BOLD,
      },
    },
    {
      key: 'countdownCommonColor',
      type: 'input',
      templateOptions: {
        type: 'color',
        label: T.GCF.MISC.COUNTDOWN_COMMON_COLOR,
      },
    },
    {
      key: 'countdownCommonFontSize',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 24,
        label: T.GCF.MISC.COUNTDOWN_COMMON_FONT_SIZE,
      },
    },
    // --- 小组件样式（独立控制） ---
    {
      key: 'countdownShowInWidget',
      type: 'checkbox',
      templateOptions: {
        label: T.GCF.MISC.COUNTDOWN_SHOW_IN_WIDGET,
      },
    },
    {
      key: 'widgetCountdownNameColor',
      type: 'input',
      templateOptions: {
        type: 'color',
        label: T.GCF.MISC.WIDGET_COUNTDOWN_NAME_COLOR,
      },
    },
    {
      key: 'widgetCountdownNameFontSize',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 36,
        label: T.GCF.MISC.WIDGET_COUNTDOWN_NAME_FONT_SIZE,
      },
    },
    {
      key: 'widgetCountdownDaysColor',
      type: 'input',
      templateOptions: {
        type: 'color',
        label: T.GCF.MISC.WIDGET_COUNTDOWN_DAYS_COLOR,
      },
    },
    {
      key: 'widgetCountdownDaysFontSize',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 36,
        label: T.GCF.MISC.WIDGET_COUNTDOWN_DAYS_FONT_SIZE,
      },
    },
    {
      key: 'widgetCountdownIsBold',
      type: 'checkbox',
      templateOptions: {
        label: T.GCF.MISC.WIDGET_COUNTDOWN_IS_BOLD,
      },
    },
    {
      key: 'widgetCountdownCommonColor',
      type: 'input',
      templateOptions: {
        type: 'color',
        label: T.GCF.MISC.WIDGET_COUNTDOWN_COMMON_COLOR,
      },
    },
    {
      key: 'widgetCountdownCommonFontSize',
      type: 'slider',
      templateOptions: {
        type: 'number',
        min: 10,
        max: 24,
        label: T.GCF.MISC.WIDGET_COUNTDOWN_COMMON_FONT_SIZE,
      },
    },
  ] as LimitedFormlyFieldConfig<MiscConfig>[],
};

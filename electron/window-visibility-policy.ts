export type MainWindowMinimizeAction = 'MINIMIZE';

export const getMainWindowMinimizeAction = (_settings: {
  isMinimizeToTray: boolean;
}): MainWindowMinimizeAction => 'MINIMIZE';

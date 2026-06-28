export enum SimpleStoreKey {
  IS_USE_CUSTOM_WINDOW_TITLE_BAR = 'isUseCustomWindowTitleBar',
  ALLOWED_COMMANDS = 'allowedCommands',
  // Main-owned sync folder path (issue #8228); the renderer no longer holds it.
  SYNC_FOLDER_PATH = 'syncFolderPath',
  // Optional external target for the default local backup directory junction/symlink.
  BACKUP_LINK_TARGET = 'backupLinkTarget',
  // Optional user-selected directory for managed background image copies.
  IMAGE_CACHE_DIR = 'imageCacheDir',
  // Legacy key kept for backwards compatibility when reading persisted settings
  LEGACY_IS_USE_OBSIDIAN_STYLE_HEADER = 'isUseObsidianStyleHeader',
}

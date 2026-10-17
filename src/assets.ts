export const sounds = {
  startup: '/sounds/startup.mp3',
  logon: '/sounds/logon.mp3',
  logoff: '/sounds/logoff.mp3',
  shutdown: '/sounds/shutdown.mp3',
  ding: '/sounds/ding.mp3',
  exclamation: '/sounds/exclamation.mp3',
  critical: '/sounds/critical.mp3',
  notify: '/sounds/notify.mp3',
  balloon: '/sounds/balloon.mp3',
  navigation: '/sounds/navigation.mp3',
  menu: '/sounds/menu.mp3',
  minimize: '/sounds/minimize.mp3',
  restore: '/sounds/restore.mp3',
  recycle: '/sounds/recycle.mp3',
} as const

export type SoundName = keyof typeof sounds

export const images = {
  bootActivity: '/images/boot/activity.webp',
  logonBackground: '/images/logon/background.webp',
  wallpaper: '/images/wallpaper/harmony.webp',
  startOrb: '/images/start/orb.webp',
  userTile: '/images/user/flower.webp',
  sampleChrysanthemum: '/images/samples/Chrysanthemum.jpg',
  sampleDesert: '/images/samples/Desert.jpg',
  sampleHydrangeas: '/images/samples/Hydrangeas.jpg',
  sampleJellyfish: '/images/samples/Jellyfish.jpg',
  sampleKoala: '/images/samples/Koala.jpg',
  sampleLighthouse: '/images/samples/Lighthouse.jpg',
  samplePenguins: '/images/samples/Penguins.jpg',
  sampleTulips: '/images/samples/Tulips.jpg',
} as const

export const icons = {
  computer: '/icons/computer.webp',
  recycleEmpty: '/icons/recycle-empty.webp',
  recycleFull: '/icons/recycle-full.webp',
  documents: '/icons/documents.webp',
  folder: '/icons/explorer/folder.webp',
  folderOpen: '/icons/explorer/folder-open.webp',
  favorites: '/icons/explorer/favorites.webp',
  desktop: '/icons/explorer/desktop.webp',
  downloads: '/icons/explorer/downloads.webp',
  recentPlaces: '/icons/explorer/recent-places.webp',
  libraries: '/icons/explorer/libraries.webp',
  libraryDocuments: '/icons/explorer/library-documents.webp',
  libraryMusic: '/icons/explorer/library-music.webp',
  libraryPictures: '/icons/explorer/library-pictures.webp',
  libraryVideos: '/icons/explorer/library-videos.webp',
  homegroup: '/icons/explorer/homegroup.webp',
  network: '/icons/explorer/network.webp',
  userFolder: '/icons/explorer/user-folder.webp',
  driveLocal: '/icons/explorer/drive-local.webp',
  driveDvd: '/icons/explorer/drive-dvd.webp',
  textFile: '/icons/explorer/text-file.webp',
  imageFile: '/icons/explorer/image-file.webp',
  audioFile: '/icons/explorer/audio-file.webp',
  videoFile: '/icons/explorer/video-file.webp',
  shortcutOverlay: '/icons/explorer/shortcut-overlay.webp',
  notepad: '/icons/apps/notepad.webp',
  photoViewer: '/icons/apps/photo-viewer.webp',
  mediaPlayer: '/icons/apps/media-player.webp',
  internetExplorer: '/icons/apps/internet-explorer.webp',
  explorer: '/icons/apps/explorer.webp',
  error: '/icons/explorer/error.webp',
  refresh: '/icons/explorer/refresh.webp',
  search: '/icons/explorer/search.webp',
  chevronRight: '/icons/explorer/chevron-right.webp',
  check: '/icons/explorer/check.webp',
  views: '/icons/explorer/views.webp',
  previewPane: '/icons/explorer/preview-pane.webp',
  help: '/icons/explorer/help.webp',
} as const

export const cursors = {
  arrow: '/cursors/arrow.cur',
  link: '/cursors/link.cur',
  busy: '/cursors/busy.cur',
} as const

export const sprites = {
  explorerNavigation: '/images/explorer/navigation.webp',
  explorerViews: '/images/explorer/views.webp',
  photoControls: '/images/apps/photo-controls.webp',
  mediaControls: '/images/apps/media-controls.webp',
} as const

export const fonts = { lucidaConsole: '/fonts/lucida-console.woff2' } as const

export const media = {
  kalimba: '/media/samples/Kalimba.mp3',
  maid: '/media/samples/Maid with the Flaxen Hair.mp3',
  sleepAway: '/media/samples/Sleep Away.mp3',
  albumKalimba: '/media/samples/album-kalimba.webp',
  albumMaid: '/media/samples/album-maid.webp',
  albumSleepAway: '/media/samples/album-sleep-away.webp',
} as const

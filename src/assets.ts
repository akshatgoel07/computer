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
} as const

export const icons = {
  computer: '/icons/computer.webp',
  recycleEmpty: '/icons/recycle-empty.webp',
  recycleFull: '/icons/recycle-full.webp',
  documents: '/icons/documents.webp',
  roadRash: '/icons/roadrash.webp',
} as const

export const cursors = {
  arrow: '/cursors/arrow.cur',
  link: '/cursors/link.cur',
  busy: '/cursors/busy.cur',
} as const

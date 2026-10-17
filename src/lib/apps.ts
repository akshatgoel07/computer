import { lazy } from 'react'
import { icons } from '@/assets'
import { nodeId, type Location } from '@/fs/types'
const Explorer = lazy(() => import('@/apps/explorer'))
const Placeholder = lazy(() => import('@/shell/Explorer'))
export const apps = {
  explorer: { title: 'Windows Explorer', icon: icons.explorer, component: Explorer },
  internetExplorer: { title: 'Internet Explorer', icon: icons.internetExplorer, component: Placeholder },
  mediaPlayer: { title: 'Windows Media Player', icon: icons.mediaPlayer, component: Placeholder },
  computer: { title: 'Computer', icon: icons.computer, component: Explorer },
  recycle: { title: 'Recycle Bin', icon: icons.recycleEmpty, component: Explorer },
  user: { title: 'Akshat', icon: icons.userFolder, component: Explorer },
  documents: { title: 'Documents', icon: icons.documents, component: Explorer },
  pictures: { title: 'Pictures', icon: icons.libraryPictures, component: Explorer },
  music: { title: 'Music', icon: icons.libraryMusic, component: Explorer },
  games: { title: 'Games', icon: icons.folder, component: Placeholder },
  control: { title: 'Control Panel', icon: icons.computer, component: Placeholder },
  devices: { title: 'Devices and Printers', icon: icons.computer, component: Placeholder },
  defaults: { title: 'Default Programs', icon: icons.computer, component: Placeholder },
  help: { title: 'Help and Support', icon: icons.help, component: Placeholder },
}
export type AppId = keyof typeof apps
export const appIds = Object.keys(apps).filter((id): id is AppId => id in apps)
export const pinned: AppId[] = ['internetExplorer', 'mediaPlayer']
export const taskbarPinned: AppId[] = ['internetExplorer', 'explorer', 'mediaPlayer']
export const desktopApps: AppId[] = ['computer', 'recycle']
export const destinations: AppId[] = ['user', 'documents', 'pictures', 'music', 'games', 'computer', 'control', 'devices', 'defaults', 'help']
export const appLocations: Partial<Record<AppId, Location>> = {
  explorer: { kind: 'shell', name: 'libraries' }, computer: { kind: 'shell', name: 'computer' }, recycle: { kind: 'shell', name: 'bin' }, user: { kind: 'folder', id: nodeId('akshat') }, documents: { kind: 'library', library: 'documents' }, pictures: { kind: 'library', library: 'pictures' }, music: { kind: 'library', library: 'music' },
}

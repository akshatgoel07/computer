import { lazy } from 'react'
import { icons } from '@/assets'

const Explorer = lazy(() => import('@/shell/Explorer'))
const availableIcons: Readonly<Partial<Record<string, string>>> = icons

export const apps = {
  internetExplorer: { title: 'Internet Explorer', icon: availableIcons.internetExplorer ?? icons.computer, component: Explorer },
  mediaPlayer: { title: 'Windows Media Player', icon: availableIcons.mediaPlayer ?? icons.computer, component: Explorer },
  computer: { title: 'Computer', icon: icons.computer, component: Explorer },
  recycle: { title: 'Recycle Bin', icon: icons.recycleEmpty, component: Explorer },
  user: { title: 'Akshat', icon: icons.documents, component: Explorer },
  documents: { title: 'Documents', icon: icons.documents, component: Explorer },
  pictures: { title: 'Pictures', icon: icons.documents, component: Explorer },
  music: { title: 'Music', icon: icons.documents, component: Explorer },
  games: { title: 'Games', icon: icons.documents, component: Explorer },
  control: { title: 'Control Panel', icon: icons.computer, component: Explorer },
  devices: { title: 'Devices and Printers', icon: icons.computer, component: Explorer },
  defaults: { title: 'Default Programs', icon: icons.computer, component: Explorer },
  help: { title: 'Help and Support', icon: icons.computer, component: Explorer },
}

export type AppId = keyof typeof apps
export const appIds = Object.keys(apps).filter((id): id is AppId => id in apps)
export const pinned: AppId[] = ['internetExplorer', 'mediaPlayer']
export const taskbarPinned: AppId[] = ['internetExplorer', 'computer', 'mediaPlayer']
export const desktopApps: AppId[] = ['computer', 'recycle']
export const destinations: AppId[] = ['user', 'documents', 'pictures', 'music', 'games', 'computer', 'control', 'devices', 'defaults', 'help']

import { nodeId, type Snapshot, type Template } from '@/fs/types'
export const rootId = nodeId('c')
export const userId = nodeId('akshat')
export const desktopId = nodeId('akshat-desktop')
export const libraries = ['documents', 'music', 'pictures', 'videos'] as const
export function seed(): Snapshot {
  const state: Snapshot = { version: 1, nodes: {}, bin: {} }
  const folder = (id: string, parent: string | null, name: string, protect = true, template: Template = 'general') => {
    const key = nodeId(id)
    state.nodes[key] = { id: key, parentId: parent ? nodeId(parent) : null, name, kind: 'folder', template, icon: 'folder', createdAt: 0, modifiedAt: 0, protected: protect, hidden: false }
    return key
  }
  folder('c', null, 'C:')
  folder('perflogs', 'c', 'PerfLogs')
  folder('program', 'c', 'Program Files')
  folder('common', 'program', 'Common Files')
  folder('ie', 'program', 'Internet Explorer')
  folder('wmp', 'program', 'Windows Media Player')
  folder('program-x86', 'c', 'Program Files (x86)')
  folder('common-x86', 'program-x86', 'Common Files')
  folder('users', 'c', 'Users')
  folder('akshat', 'users', 'Akshat')
  folder('public', 'users', 'Public')
  for (const name of ['Contacts', 'Desktop', 'Documents', 'Downloads', 'Favorites', 'Links', 'Music', 'Pictures', 'Saved Games', 'Searches', 'Videos']) {
    const lower = name.toLowerCase()
    const template = libraries.find(item => item === lower) ?? 'general'
    const id = folder(`akshat-${lower}`, 'akshat', name, true, template)
    const special = { desktop: 'desktop', downloads: 'downloads', documents: 'documents' } as const
    if (lower in special) state.nodes[id].icon = special[lower as keyof typeof special]
  }
  for (const name of ['Documents', 'Downloads', 'Music', 'Pictures', 'Videos']) {
    const lower = name.toLowerCase()
    folder(`public-${lower}`, 'public', name, true, libraries.find(item => item === lower) ?? 'general')
  }
  folder('sample-pictures', 'public-pictures', 'Sample Pictures', false, 'pictures')
  folder('sample-music', 'public-music', 'Sample Music', false, 'music')
  folder('sample-videos', 'public-videos', 'Sample Videos', false, 'videos')
  const pictures = ['Chrysanthemum', 'Desert', 'Hydrangeas', 'Jellyfish', 'Koala', 'Lighthouse', 'Penguins', 'Tulips'] as const
  for (const name of pictures) {
    const id = nodeId(`picture-${name.toLowerCase()}`)
    const key = `sample${name}` as 'sampleChrysanthemum'
    state.nodes[id] = { id, parentId: nodeId('sample-pictures'), name: `${name}.jpg`, kind: 'file', bytes: 0, payload: { kind: 'image', key }, icon: 'imageFile', createdAt: 0, modifiedAt: 0, protected: false, hidden: false }
  }
  for (const [name, key] of [['Kalimba', 'kalimba'], ['Maid with the Flaxen Hair', 'maid'], ['Sleep Away', 'sleepAway']] as const) {
    const id = nodeId(`audio-${key}`)
    state.nodes[id] = { id, parentId: nodeId('sample-music'), name: `${name}.mp3`, kind: 'file', bytes: 0, payload: { kind: 'audio', key }, icon: 'audioFile', createdAt: 0, modifiedAt: 0, protected: false, hidden: false }
  }
  folder('windows', 'c', 'Windows')
  folder('system32', 'windows', 'System32')
  folder('web', 'windows', 'Web')
  folder('wallpaper', 'web', 'Wallpaper')
  state.nodes[rootId].icon = 'driveLocal'
  state.nodes[userId].icon = 'userFolder'
  return state
}

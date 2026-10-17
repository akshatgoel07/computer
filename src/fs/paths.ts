import { desktopId, libraries, rootId, userId } from '@/fs/seed'
import { nodeId, type FsNode, type Item, type IconKey, type Location, type NodeId, type Snapshot } from '@/fs/types'
export const sameLocation = (a: Location, b: Location) => JSON.stringify(a) === JSON.stringify(b)
export const validName = (name: string) => name.length > 0 && name.length <= 255 && !/[<>:"/\\|?*\u0000-\u001f]/.test(name) && !/[ .]$/.test(name) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
export const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
export function ancestors(state: Snapshot, id: NodeId): FsNode[] {
  const result: FsNode[] = []
  const seen = new Set<NodeId>()
  let current = state.nodes[id]
  while (current && !seen.has(current.id)) {
    result.unshift(current)
    seen.add(current.id)
    if (!current.parentId) break
    current = state.nodes[current.parentId]
  }
  return result
}
export const inBin = (state: Snapshot, id: NodeId) => ancestors(state, id).some(node => Boolean(state.bin[node.id]))
export const pathFor = (state: Snapshot, id: NodeId) => ancestors(state, id).map(node => node.name).join('\\') + (id === rootId ? '\\' : '')
export const children = (state: Snapshot, id: NodeId) => Object.values(state.nodes).filter(node => node.parentId === id && !node.hidden && !inBin(state, node.id))
export const displayName = (node: FsNode) => node.kind === 'file' ? node.name.replace(/\.[^.]+$/, '') : node.name
export const typeName = (node: FsNode) => node.kind === 'folder' ? 'File folder' : ({ text: 'Text Document', image: 'JPEG image', audio: 'MP3 Format Sound', video: 'Video clip', shortcut: 'Shortcut' })[node.payload.kind]
export function locationName(state: Snapshot, location: Location): string {
  if (location.kind === 'folder') return state.nodes[location.id]?.name === 'C:' ? 'Local Disk (C:)' : state.nodes[location.id]?.name ?? 'Computer'
  if (location.kind === 'library') return location.library[0].toUpperCase() + location.library.slice(1)
  return { desktop: 'Desktop', libraries: 'Libraries', computer: 'Computer', bin: 'Recycle Bin', recent: 'Recent Places', homegroup: 'Homegroup', network: 'Network' }[location.name]
}
export const writableParent = (location: Location) => location.kind === 'folder' ? location.id : location.kind === 'library' ? nodeId(`akshat-${location.library}`) : location.name === 'desktop' ? desktopId : null
export function parentLocation(state: Snapshot, location: Location): Location | null {
  if (location.kind === 'library') return { kind: 'shell', name: 'libraries' }
  if (location.kind === 'shell') return null
  const parentId = state.nodes[location.id]?.parentId
  return parentId ? { kind: 'folder', id: parentId } : { kind: 'shell', name: 'computer' }
}
export function itemsAt(state: Snapshot, location: Location, recent: NodeId[] = []): Item[] {
  let nodes: FsNode[] = []
  if (location.kind === 'folder') nodes = children(state, location.id)
  else if (location.kind === 'library') nodes = [...children(state, nodeId(`akshat-${location.library}`)), ...children(state, nodeId(`public-${location.library}`))]
  else {
    if (location.name === 'libraries') return libraries.map(library => ({ id: `library-${library}`, name: library[0].toUpperCase() + library.slice(1), icon: `library${library[0].toUpperCase()}${library.slice(1)}` as 'libraryDocuments', location: { kind: 'library', library } }))
    if (location.name === 'computer') return [{ id: 'c', name: 'Local Disk (C:)', icon: 'driveLocal', node: state.nodes[rootId], location: { kind: 'folder', id: rootId } }, { id: 'dvd', name: 'DVD RW Drive (D:)', icon: 'driveDvd' }]
    if (location.name === 'desktop') nodes = children(state, desktopId)
    if (location.name === 'bin') nodes = Object.keys(state.bin).flatMap(id => state.nodes[nodeId(id)] ?? [])
    if (location.name === 'recent') nodes = recent.flatMap(id => state.nodes[id] && !inBin(state, id) ? [state.nodes[id]] : [])
  }
  return nodes.map(node => ({ id: node.id, name: displayName(node), icon: node.icon, node, location: node.kind === 'folder' ? { kind: 'folder', id: node.id } : node.payload.kind === 'shortcut' && node.payload.target.kind !== 'file' ? node.payload.target : undefined }))
}
export function resolvePath(state: Snapshot, input: string): Location | null {
  const text = input.trim().replace(/\\+$/, '').toLowerCase()
  for (const name of ['desktop', 'libraries', 'computer', 'bin', 'recent', 'homegroup', 'network'] as const) {
    const location: Location = { kind: 'shell', name }
    if (locationName(state, location).toLowerCase() === text) return location
  }
  if (text === 'akshat') return { kind: 'folder', id: userId }
  for (const library of libraries) if (text === library) return { kind: 'library', library }
  const node = Object.values(state.nodes).find(node => node.kind === 'folder' && !inBin(state, node.id) && pathFor(state, node.id).replace(/\\+$/, '').toLowerCase() === text)
  return node ? { kind: 'folder', id: node.id } : null
}

export const libraryIcons: Record<'documents' | 'music' | 'pictures' | 'videos', IconKey> = { documents: 'libraryDocuments', music: 'libraryMusic', pictures: 'libraryPictures', videos: 'libraryVideos' }
export function locationIcon(state: Snapshot, location: Location): IconKey {
  if (location.kind === 'library') return libraryIcons[location.library]
  if (location.kind === 'folder') return state.nodes[location.id]?.icon ?? 'folder'
  return { desktop: 'desktop', libraries: 'libraries', computer: 'computer', bin: Object.keys(state.bin).length ? 'recycleFull' as const : 'recycleEmpty' as const, recent: 'recentPlaces', homegroup: 'homegroup', network: 'network' }[location.name] as IconKey
}
export const viewOptions = [['Extra large icons', 'extraLarge'], ['Large icons', 'large'], ['Medium icons', 'medium'], ['Small icons', 'small'], ['List', 'list'], ['Details', 'details'], ['Tiles', 'tiles'], ['Content', 'content']] as const

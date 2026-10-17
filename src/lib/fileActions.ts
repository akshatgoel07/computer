import { inBin, itemsAt, natural } from '@/fs/paths'
import { desktopId } from '@/fs/seed'
import { type FsNode, type IconKey, type Item, type Location, type NodeId } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { useShellStore } from '@/stores/shellStore'
import { useWindows } from '@/stores/windows'
import { showError } from '@/shell/DeleteDialog'
export function setClipboard(kind: 'cut' | 'copy', ids: NodeId[]) {
  const state = useFilesStore.getState()
  if (!ids.length || ids.some(id => !state.nodes[id] || inBin(state, id) || kind === 'cut' && state.nodes[id].protected)) return
  useShellStore.getState().setClipboard({ kind, ids })
}
export function canPaste() {
  const clipboard = useShellStore.getState().clipboard
  const files = useFilesStore.getState()
  return Boolean(clipboard?.ids.length && clipboard.ids.every(id => files.nodes[id] && !inBin(files, id)))
}
export function paste(parent: NodeId, shortcut = false) {
  const clipboard = useShellStore.getState().clipboard
  if (!clipboard || !canPaste()) return
  const state = useFilesStore.getState()
  const result = state.commit(shortcut ? { kind: 'shortcuts', parent, targets: clipboard.ids.map(id => { const node = state.nodes[id]; return { name: node.name.replace(/\.[^.]+$/, ''), icon: node.icon, target: node.kind === 'folder' ? { kind: 'folder', id } : { kind: 'file', id } } }) } : { kind: clipboard.kind === 'cut' ? 'move' : 'copy', ids: clipboard.ids, parent })
  if (!result.ok) showError(result.error)
  else if (clipboard.kind === 'cut' && !shortcut) useShellStore.getState().setClipboard(null)
  return result
}
export function shortcutItems(items: Item[], parent: NodeId = desktopId) {
  const targets = items.flatMap<{ name: string; icon: IconKey; target: Location | { kind: 'file'; id: NodeId } }>(item => item.node ? [{ name: item.name, icon: item.icon, target: item.node.kind === 'folder' ? { kind: 'folder' as const, id: item.node.id } : { kind: 'file' as const, id: item.node.id } }] : item.location ? [{ name: item.name, icon: item.icon, target: item.location }] : [])
  const result = useFilesStore.getState().commit({ kind: 'shortcuts', parent, targets })
  if (!result.ok) showError(result.error)
  return result
}
export function openNode(id: NodeId, order?: NodeId[], play = false, slideShow = false) {
  const files = useFilesStore.getState()
  const node = files.nodes[id]
  if (!node || inBin(files, id)) { showError('missing'); return }
  if (node.kind === 'folder') { useWindows.getState().open('explorer', { kind: 'folder', id }); return }
  if (node.payload.kind === 'shortcut') {
    if (node.payload.target.kind === 'file') openNode(node.payload.target.id)
    else useWindows.getState().open('explorer', node.payload.target)
    return
  }
  const siblings = order ?? Object.values(files.nodes).filter(item => item.parentId === node.parentId).sort((a, b) => natural(a.name, b.name)).map(item => item.id)
  if (node.payload.kind === 'text') useWindows.getState().open('notepad', undefined, { kind: 'file', id })
  if (node.payload.kind === 'image') useWindows.getState().open('photos', undefined, { kind: 'photo', id, ids: siblings.filter(id => { const item = files.nodes[id]; return item?.kind === 'file' && item.payload.kind === 'image' && !inBin(files, id) }), slideShow })
  if (node.payload.kind === 'audio') useWindows.getState().open('mediaPlayer', undefined, { kind: 'audio', selected: id, ids: siblings.filter(id => { const item = files.nodes[id]; return item?.kind === 'file' && item.payload.kind === 'audio' && !inBin(files, id) }), play })
}
export function queueAt(location: Location, kind: 'audio' | 'image'): FsNode[] {
  return itemsAt(useFilesStore.getState(), location).flatMap(item => item.node?.kind === 'file' && item.node.payload.kind === kind ? [item.node] : [])
}

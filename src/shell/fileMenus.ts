import { type Item, type NodeId, type View } from '@/fs/types'
import { viewOptions } from '@/fs/paths'
import { canPaste, paste, setClipboard, shortcutItems } from '@/lib/fileActions'
import { desktopId } from '@/fs/seed'
import { useFilesStore } from '@/stores/filesStore'
import { requestDelete, restoreItems } from '@/shell/DeleteDialog'
import type { MenuEntry } from '@/shell/ContextMenu'
const separator = { separator: true } as const
const disabled = (labels: string[]): MenuEntry[] => labels.map(label => ({ label }))
const share = () => ({ label: 'Share with', children: disabled(['Nobody', 'Homegroup (Read)', 'Homegroup (Read/Write)', 'Specific people...']) })
const include = () => ({ label: 'Include in library', children: [...disabled(['Documents', 'Music', 'Pictures', 'Videos']), separator, { label: 'Create new library...' }] })
const sendTo = (items: Item[]) => ({ label: 'Send to', children: [{ label: 'Compressed (zipped) folder' }, { label: 'Desktop (create shortcut)', action: () => shortcutItems(items, desktopId) }, ...disabled(['Documents', 'Fax recipient', 'Mail recipient'])] })
export const sortMenu = (field: string, action: (field: string) => void): MenuEntry[] => ['Name', 'Size', 'Item type', 'Date modified'].map(label => ({ label, checked: field === label, action: () => action(label) }))
export const viewsMenu = (view: View, action: (view: View) => void): MenuEntry[] => viewOptions.map(([label, value]) => ({ label, checked: view === value, action: () => action(value) }))
export const newMenu = (folder: () => void, text: () => void): MenuEntry[] => [{ label: 'Folder', icon: 'folder', action: folder }, { label: 'Shortcut' }, separator, { label: 'Text Document', icon: 'textFile', action: text }]
export function blankMenu(options: { desktop: boolean; view: MenuEntry[]; sort: MenuEntry[]; refresh: () => void; parent: NodeId | null; folder: () => void; text: () => void }): MenuEntry[] {
  const { desktop, view, sort, refresh, parent, folder, text } = options
  return [{ label: 'View', children: view }, { label: 'Sort by', children: sort }, ...(!desktop ? [{ label: 'Group by', children: [...disabled(['Name', 'Date modified', 'Type', 'Size']), separator, { label: '(None)', checked: true }] }] : []), { label: 'Refresh', action: refresh }, separator, ...(!desktop ? [{ label: 'Customize this folder...' }, separator] : []), { label: 'Paste', action: parent && canPaste() ? () => paste(parent) : undefined }, { label: 'Paste shortcut', action: parent && canPaste() ? () => paste(parent, true) : undefined }, separator, ...(!desktop ? [share()] : []), { label: 'New', children: parent ? newMenu(folder, text) : undefined }, separator, ...disabled(desktop ? ['Screen resolution', 'Gadgets', 'Personalize'] : ['Properties'])]
}
export function itemMenu({ item, selected, parent, bin, open, openWindow, rename, remove }: { item: Item; selected: Item[]; parent: NodeId | null; bin: boolean; open: () => void; openWindow: () => void; rename: () => void; remove: () => void }): MenuEntry[] {
  const ids = selected.flatMap(entry => entry.node ? [entry.node.id] : [])
  const protectedItem = selected.some(entry => !entry.node || entry.node.protected)
  if (item.id === 'recycle') {
    const roots = Object.keys(useFilesStore.getState().bin) as NodeId[]
    return [{ label: 'Open', action: open }, { label: 'Empty Recycle Bin', action: roots.length ? () => requestDelete(roots, true, true) : undefined }, separator, { label: 'Create shortcut', action: () => shortcutItems([item]) }, { label: 'Rename' }, separator, { label: 'Properties' }]
  }
  if (item.id === 'computer') return [{ label: 'Open', action: open }, separator, { label: 'Manage' }, separator, ...disabled(['Map network drive...', 'Disconnect network drive...']), separator, { label: 'Create shortcut', action: () => shortcutItems([item], desktopId) }, ...disabled(['Delete', 'Rename']), separator, { label: 'Properties' }]
  if (bin) return [{ label: 'Restore', action: () => restoreItems(ids) }, separator, { label: 'Cut' }, { label: 'Delete', action: () => requestDelete(ids, true) }, separator, { label: 'Properties' }]
  const payload = item.node?.kind === 'file' ? item.node.payload : null
  const folder = item.node?.kind === 'folder'
  const drive = item.id === 'c'
  if (drive) return [{ label: 'Open', action: open }, { label: 'Open in new window', action: openWindow }, separator, share(), { label: 'Restore previous versions' }, separator, { label: 'Format...' }, separator, { label: 'Copy', action: ids.length ? () => setClipboard('copy', ids) : undefined }, separator, { label: 'Create shortcut', action: () => shortcutItems([item]) }, separator, { label: 'Properties' }]
  const prefix: MenuEntry[] = folder ? [{ label: 'Open', action: open }, { label: 'Open in new window', action: openWindow }, separator, include(), share(), { label: 'Restore previous versions' }, sendTo(selected), separator] : payload?.kind === 'shortcut' ? [{ label: 'Open', action: open }, { label: 'Open file location', action: item.node?.parentId ? openWindow : undefined }, separator] : payload?.kind === 'image' ? [{ label: 'Preview', action: open }, ...disabled(['Set as desktop background', 'Edit', 'Print']), separator, ...disabled(['Rotate clockwise', 'Rotate counterclockwise']), separator] : payload?.kind === 'audio' ? [{ label: 'Play', action: open }, { label: 'Add to Windows Media Player list' }, separator] : [{ label: 'Open', action: payload?.kind === 'video' ? undefined : open }, { label: 'Print' }, { label: 'Edit', action: payload?.kind === 'text' ? open : undefined }, separator]
  if (!folder && payload?.kind !== 'shortcut') prefix.push({ label: 'Open with', children: [{ label: payload?.kind === 'text' ? 'Notepad' : payload?.kind === 'image' ? 'Windows Photo Viewer' : 'Windows Media Player', action: payload?.kind === 'video' ? undefined : open }, { label: 'Choose default program...' }] }, share(), { label: 'Restore previous versions' }, sendTo(selected), separator)
  return [...prefix, { label: 'Cut', action: protectedItem ? undefined : () => setClipboard('cut', ids) }, { label: 'Copy', action: ids.length ? () => setClipboard('copy', ids) : undefined }, separator, ...(payload?.kind === 'shortcut' ? [] : [{ label: 'Create shortcut', action: parent ? () => shortcutItems(selected, parent) : undefined }]), { label: 'Delete', action: protectedItem ? undefined : remove }, { label: 'Rename', action: !protectedItem && selected.length === 1 ? rename : undefined }, separator, { label: 'Properties' }]
}

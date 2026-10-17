import { useLayoutEffect, useRef, useState } from 'react'
import { icons } from '@/assets'
import { viewOptions, writableParent } from '@/fs/paths'
import { nodeId, type View } from '@/fs/types'
import { canPaste, openNode, paste, queueAt, setClipboard } from '@/lib/fileActions'
import { useFilesStore } from '@/stores/filesStore'
import { useShellStore } from '@/stores/shellStore'
import { useExplorerStore, type ExplorerSession } from '@/stores/explorerStore'
import { useWindows } from '@/stores/windows'
import { requestDelete, restoreItems } from '@/shell/DeleteDialog'
import ContextMenu, { type MenuEntry } from '@/shell/ContextMenu'
export default function CommandBar({ windowId, session, createFolder, rename, remove, details, setDetails, navigation, setNavigation, preview, setPreview, menuBar, setMenuBar }: { windowId: string; session: ExplorerSession; createFolder: () => void; rename: () => void; remove: () => void; details: boolean; setDetails: (value: boolean) => void; navigation: boolean; setNavigation: (value: boolean) => void; menuBar: boolean; setMenuBar: (value: boolean) => void; preview: boolean; setPreview: (value: boolean) => void }) {
  const files = useFilesStore()
  useShellStore(state => state.clipboard)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[]; views?: boolean } | null>(null)
  const commands = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState<MenuEntry[]>([])
  useLayoutEffect(() => {
    const element = commands.current
    if (!element) return
    const update = () => {
      const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>(':scope > .command-button'))
      const total = buttons.reduce((sum, button) => sum + button.offsetWidth, 0)
      const limit = element.clientWidth - (total > element.clientWidth ? 18 : 0)
      let used = 0
      const hidden: MenuEntry[] = []
      for (const button of buttons) { used += button.offsetWidth; const hide = used > limit; button.style.visibility = hide ? 'hidden' : 'visible'; if (hide) hidden.push({ label: button.textContent ?? '', action: button.disabled ? undefined : () => button.click() }) }
      setOverflow(hidden)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element); update()
    return () => observer.disconnect()
  }, [JSON.stringify(session.location), JSON.stringify(session.selection), Object.keys(files.bin).length])
  const bin = session.location.kind === 'shell' && session.location.name === 'bin'
  const computer = session.location.kind === 'shell' && session.location.name === 'computer'
  const ids = Object.keys(files.bin).map(nodeId)
  const selected = session.selection.map(nodeId)
  const writable = selected.length > 0 && selected.every(id => files.nodes[id] && !files.nodes[id].protected)
  const parent = writableParent(session.location)
  const selectView = (view: View) => useExplorerStore.getState().patch(windowId, { view })
  const organize: MenuEntry[] = [{ label: 'Cut', action: writable && !bin ? () => setClipboard('cut', selected) : undefined }, { label: 'Copy', action: selected.length && !bin ? () => setClipboard('copy', selected) : undefined }, { label: 'Paste', action: parent && canPaste() ? () => paste(parent) : undefined }, { separator: true }, { label: 'Undo' }, { label: 'Redo' }, { separator: true }, { label: 'Select all', action: () => document.querySelector<HTMLElement>(`[data-window-id="${windowId}"] .file-list`)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })) }, { separator: true }, { label: 'Layout', children: [{ label: 'Menu bar', checked: menuBar, action: () => setMenuBar(!menuBar) }, { label: 'Details pane', checked: details, action: () => setDetails(!details) }, { label: 'Preview pane', checked: preview, action: () => setPreview(!preview) }, { label: 'Navigation pane', checked: navigation, action: () => setNavigation(!navigation) }] }, { label: 'Folder and search options' }, { separator: true }, { label: 'Delete', action: writable ? remove : undefined }, { label: 'Rename', action: writable && selected.length === 1 && !bin ? rename : undefined }, { separator: true }, { label: 'Properties' }, { separator: true }, { label: 'Close', action: () => useWindows.getState().close(windowId) }]
  const popup = (element: HTMLElement, entries: MenuEntry[], views = false) => { const rect = element.getBoundingClientRect(); setMenu({ x: rect.left, y: rect.bottom, entries, views }) }
  const button = (name: string, action?: () => void, disabled = false) => <button key={name} className="shell-button command-button" disabled={disabled || !action} onClick={action}>{name}</button>
  const audio = queueAt(session.location, 'audio')
  const pictures = queueAt(session.location, 'image')
  const type = session.location.kind === 'library' ? session.location.library : session.location.kind === 'folder' ? files.nodes[session.location.id] : null
  const template = typeof type === 'string' ? type : type?.kind === 'folder' ? type.template : 'general'
  const picture = selected.find(id => { const node = files.nodes[id]; return node?.kind === 'file' && node.payload.kind === 'image' })
  return <div className="command-bar"><button className="shell-button command-button" onClick={event => popup(event.currentTarget, organize)}>Organize ▾</button><div className="location-commands" ref={commands}>{bin ? <>{button('Empty the Recycle Bin', () => requestDelete(ids, true, true), !ids.length)}{button(session.selection.length === 0 ? 'Restore all items' : session.selection.length === 1 ? 'Restore this item' : 'Restore the selected items', () => restoreItems(session.selection.length ? selected : ids), !ids.length)}</> : computer ? ['System properties', 'Uninstall or change a program', 'Map network drive', 'Open Control Panel'].map(name => button(name)) : parent ? <>{template === 'pictures' || picture ? <>{button('Preview', picture ? () => openNode(picture) : undefined)}{button('Slide show', pictures.length ? () => openNode(pictures[0].id, pictures.map(node => node.id), false, true) : undefined)}</> : template === 'music' || template === 'videos' ? button('Play all', audio.length ? () => openNode(audio[0].id, audio.map(node => node.id), true) : undefined) : session.location.kind !== 'library' && button('Include in library')}{button('Share with')}{button('Burn')}{button('New folder', createFolder)}</> : button('New library')}{overflow.length > 0 && <button className="shell-button command-overflow" aria-label="More commands" onClick={event => popup(event.currentTarget, overflow)}>»</button>}</div><div className="command-right"><button className="shell-button" aria-label="Change your view" onClick={() => selectView(session.view === 'details' ? 'large' : session.view === 'large' ? 'tiles' : 'details')}><img src={icons.views} alt="" /></button><button className="shell-button" aria-label="View options" onClick={event => popup(event.currentTarget, viewOptions.map(([label, view]) => ({ label, checked: view === session.view, action: () => selectView(view) })), true)}>▾</button><button className="shell-button" aria-label="Show the preview pane" aria-pressed={preview} onClick={() => setPreview(!preview)}><img src={icons.previewPane} alt="" /></button><button className="shell-button" aria-label="Help" onClick={() => useWindows.getState().open('help')}><img src={icons.help} alt="" /></button></div>{menu && <ContextMenu {...menu} width={menu.views ? 180 : 224} slider={menu.views ? { value: viewOptions.findIndex(([, view]) => view === session.view), change: index => selectView(viewOptions[index][1]) } : undefined} close={() => setMenu(null)} />}</div>
}

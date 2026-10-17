import { useEffect, useRef, useState } from 'react'
import { nodeId, type NodeId } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { registerCloseGuard, useWindows } from '@/stores/windows'
import ContextMenu, { type MenuEntry } from '@/shell/ContextMenu'
import { showError } from '@/shell/DeleteDialog'
import FileDialog, { ModalShell } from '@/apps/explorer/FileDialog'
import './notepad.css'
const textClipboard = { value: '' }
export default function Notepad({ windowId }: { windowId: string }) {
  const record = useWindows(state => state.windows[windowId])
  const [fileId, setFileId] = useState<NodeId | null>(() => record?.launchContext.kind === 'file' ? record.launchContext.id : null)
  const files = useFilesStore()
  const node = fileId ? files.nodes[fileId] : null
  const [text, setText] = useState(() => node?.kind === 'file' && node.payload.kind === 'text' ? node.payload.text : '')
  const [saved, setSaved] = useState(text)
  const [wrap, setWrap] = useState(false)
  const [status, setStatus] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [dialog, setDialog] = useState<'open' | 'save' | null>(null)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const afterSave = useRef<(() => void) | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const canvas = useRef<HTMLTextAreaElement>(null)
  const name = node?.name ?? 'Untitled'
  const dirty = text !== saved
  const guard = useRef<() => boolean>(() => true)
  const ask = (action: () => void) => { if (dirty) setPending(() => action); else action() }
  guard.current = () => { if (!dirty) return true; setPending(() => () => useWindows.getState().close(windowId, true)); return false }
  useEffect(() => { canvas.current?.focus() }, [])
  useEffect(() => registerCloseGuard(windowId, () => guard.current()), [windowId])
  useEffect(() => { useWindows.getState().setContext(windowId, fileId ? { kind: 'file', id: fileId } : { kind: 'none' }) }, [windowId, fileId])
  useEffect(() => { useWindows.getState().setTitle(windowId, `${name} - Notepad`) }, [windowId, name])
  useEffect(() => { const content = node?.kind === 'file' && node.payload.kind === 'text' ? node.payload.text : null; if (content !== null && text === saved && content !== saved) { setText(content); setSaved(content) } }, [node?.kind === 'file' && node.payload.kind === 'text' ? node.payload.text : null])
  const save = (as = false, next?: () => void) => {
    if (!fileId || as) { afterSave.current = next ?? null; setDialog('save'); return }
    const result = files.commit({ kind: 'writeText', id: fileId, text })
    if (!result.ok) { showError(result.error); return }
    setSaved(text)
    next?.()
  }
  const edit = (kind: 'cut' | 'copy' | 'paste' | 'delete' | 'all' | 'undo') => {
    const field = canvas.current
    if (!field) return
    field.focus()
    if (kind === 'all') { field.select(); return }
    if (kind === 'undo') { document.execCommand('undo'); return }
    const start = field.selectionStart; const end = field.selectionEnd
    if (kind === 'copy' || kind === 'cut') textClipboard.value = text.slice(start, end)
    if (kind === 'cut' || kind === 'delete' || kind === 'paste') {
      const insert = kind === 'paste' ? textClipboard.value : ''
      if (!document.execCommand(kind === 'paste' ? 'insertText' : 'delete', false, insert)) field.setRangeText(insert, start, end, 'end')
      setText(field.value)
    }
  }
  const openMenu = (label: string, element: HTMLElement) => {
    const separator = { separator: true } as const
    const entries: Record<string, MenuEntry[]> = {
      File: [{ label: 'New', action: () => ask(() => { setFileId(null); setText(''); setSaved('') }) }, { label: 'Open...', action: () => ask(() => setDialog('open')) }, { label: 'Save', action: () => save() }, { label: 'Save As...', action: () => save(true) }, separator, { label: 'Page Setup...' }, { label: 'Print...' }, separator, { label: 'Exit', action: () => useWindows.getState().close(windowId) }],
      Edit: [{ label: 'Undo', action: () => edit('undo') }, separator, ...(['Cut', 'Copy', 'Paste', 'Delete'] as const).map(label => ({ label, action: () => edit(label.toLowerCase() as 'cut' | 'copy' | 'paste' | 'delete') })), separator, ...['Find...', 'Find Next', 'Replace...', 'Go To...'].map(label => ({ label })), separator, { label: 'Select All', action: () => edit('all') }, { label: 'Time/Date' }],
      Format: [{ label: 'Word Wrap', checked: wrap, action: () => setWrap(!wrap) }, { label: 'Font...' }], View: [{ label: 'Status Bar', checked: status, action: wrap ? undefined : () => setStatus(!status) }], Help: [{ label: 'View Help' }, separator, { label: 'About Notepad' }],
    }
    const rect = element.getBoundingClientRect()
    setMenu({ x: rect.left, y: rect.bottom, entries: entries[label] })
  }
  return <div className="notepad-app" onKeyDown={event => {
    if (dialog || pending) return
    if (event.ctrlKey && ['a', 'c', 'x', 'v', 'z'].includes(event.key.toLowerCase())) { event.preventDefault(); const action = { a: 'all', c: 'copy', x: 'cut', v: 'paste', z: 'undo' } as const; edit(action[event.key.toLowerCase() as keyof typeof action]); return }
    if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); save(event.shiftKey) }
    if (event.ctrlKey && event.key.toLowerCase() === 'o') { event.preventDefault(); ask(() => setDialog('open')) }
    if (event.ctrlKey && event.key.toLowerCase() === 'n') { event.preventDefault(); ask(() => { setFileId(null); setText(''); setSaved('') }) }
  }}><div className="notepad-menu">{['File', 'Edit', 'Format', 'View', 'Help'].map(label => <button className="shell-button" key={label} onClick={event => openMenu(label, event.currentTarget)}>{label}</button>)}</div><textarea ref={canvas} data-app-focus aria-label="Document text" spellCheck={false} wrap={wrap ? 'soft' : 'off'} value={text} onChange={event => setText(event.target.value)} onSelect={event => { const before = text.slice(0, event.currentTarget.selectionStart).split('\n'); setCursor({ line: before.length, column: before.at(-1)!.length + 1 }) }} />{status && !wrap && <div className="notepad-status">Ln {cursor.line}, Col {cursor.column}</div>}{menu && <ContextMenu {...menu} close={() => { setMenu(null); canvas.current?.focus() }} />}
    {dialog && <FileDialog mode={dialog} initial={node?.parentId ?? nodeId('akshat-documents')} filename={node?.name ?? 'Untitled.txt'} text={text} close={() => { setDialog(null); afterSave.current = null }} done={id => {
      const existing = Object.values(useWindows.getState().windows).find(record => record?.id !== windowId && record?.appId === 'notepad' && record.launchContext.kind === 'file' && record.launchContext.id === id)
      if (existing) { setDialog(null); useWindows.getState().restore(existing.id); useWindows.getState().close(windowId, true); return }
      if (dialog === 'open') { const source = files.nodes[id]; const content = source?.kind === 'file' && source.payload.kind === 'text' ? source.payload.text : ''; setText(content); setSaved(content) }
      else setSaved(text)
      setFileId(id); setDialog(null); const next = afterSave.current; afterSave.current = null; next?.()
    }} />}
    {pending && <ModalShell title="Notepad" close={() => setPending(null)}><div className="unsaved-question">Do you want to save changes to {name}?</div><div className="dialog-footer"><button onClick={() => { const next = pending; setPending(null); save(false, next) }}>Save</button><button onClick={() => { const next = pending; setPending(null); next() }}>Don't Save</button><button onClick={() => setPending(null)}>Cancel</button></div></ModalShell>}
  </div>
}

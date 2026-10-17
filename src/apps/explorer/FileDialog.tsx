import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { children, natural, parentLocation, pathFor, resolvePath } from '@/fs/paths'
import { desktopId } from '@/fs/seed'
import { nodeId, type NodeId } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { useShellStore } from '@/stores/shellStore'
import { showError, useFileDialog } from '@/shell/DeleteDialog'
import { play } from '@/lib/sound'
export function ModalShell({ title, children: content, close, width = 458 }: { title: string; children: ReactNode; close: () => void; width?: number }) {
  const panel = useRef<HTMLDivElement>(null)
  const onClose = useRef(close)
  onClose.current = close
  useEffect(() => {
    const prior = document.activeElement
    useShellStore.getState().changeModalCount(1)
    const first = panel.current?.querySelector<HTMLElement>('[data-modal-focus]') ?? panel.current?.querySelector<HTMLElement>('input, textarea, button:not([aria-label=Close])')
    first?.focus()
    const key = (event: KeyboardEvent) => {
      if (useFileDialog.getState().request) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose.current() }
      if (event.key === 'Tab') {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,[tabindex="0"]') ?? [])
        const index = buttons.indexOf(document.activeElement as HTMLElement)
        event.preventDefault()
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => { useShellStore.getState().changeModalCount(-1); window.removeEventListener('keydown', key, true); requestAnimationFrame(() => { if (prior instanceof HTMLElement && prior.isConnected && !prior.closest('[inert]')) prior.focus() }) }
  }, [])
  return createPortal(<div className="win7 file-modal-shade"><div className="window glass active file-dialog" role="dialog" aria-modal="true" aria-label={title} ref={panel} style={{ width }}><div className="title-bar"><div className="title-bar-text">{title}</div><div className="title-bar-controls"><button aria-label="Close" onClick={close} /></div></div>{content}</div></div>, document.body)
}
export default function FileDialog({ mode, initial, filename = 'Untitled.txt', text = '', done, close }: { mode: 'open' | 'save'; initial: NodeId; filename?: string; text?: string; done: (id: NodeId) => void; close: () => void }) {
  const files = useFilesStore()
  const [parent, setParent] = useState(initial)
  const [path, setPath] = useState(pathFor(files, initial))
  const [name, setName] = useState(mode === 'save' ? filename : '')
  const [replace, setReplace] = useState<NodeId | null>(null)
  const folders = children(files, parent).filter(node => node.kind === 'folder' || node.payload.kind === 'text').sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || natural(a.name, b.name))
  const navigate = (id: NodeId) => { setParent(id); setPath(pathFor(files, id)); setName(mode === 'save' ? filename : ''); setReplace(null) }
  const save = (id?: NodeId) => {
    const result = files.commit(id ? { kind: 'writeText', id, text } : { kind: 'createText', parent, name: /\.txt$/i.test(name) ? name : `${name}.txt`, text })
    if (!result.ok) { showError(result.error); return }
    const target = id ?? result.value
    if (target) done(target)
  }
  const submit = () => {
    const node = folders.find(node => node.name.toLowerCase() === name.toLowerCase() || node.kind === 'file' && node.name.toLowerCase() === `${name}.txt`.toLowerCase())
    if (node?.kind === 'folder') { navigate(node.id); return }
    if (mode === 'open') { if (node?.kind === 'file' && node.payload.kind === 'text') done(node.id); else { void play('ding') } }
    else if (!name) void play('ding')
    else if (node) setReplace(node.id)
    else save()
  }
  return <ModalShell title={mode === 'open' ? 'Open' : 'Save As'} close={close} width={560}><div className="vfs-dialog"><div className="vfs-address"><button aria-label="Up one level" onClick={() => { const target = parentLocation(files, { kind: 'folder', id: parent }); if (target?.kind === 'folder') navigate(target.id) }}>↑</button><input aria-label="Folder path" value={path} onChange={event => setPath(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { const target = resolvePath(files, path); if (target?.kind === 'folder') navigate(target.id); else void play('ding') } }} /></div><div className="vfs-body"><nav>{[['Desktop', desktopId], ['Documents', nodeId('akshat-documents')], ['Computer', nodeId('c')]].map(([label, id]) => <button key={label} onClick={() => navigate(nodeId(id))}>{label}</button>)}</nav><div className="vfs-files" role="listbox" aria-label="Files">{folders.map(node => <button key={node.id} className="shell-button" role="option" aria-selected={name === node.name} onClick={() => setName(node.name)} onDoubleClick={() => node.kind === 'folder' ? navigate(node.id) : mode === 'open' ? done(node.id) : setName(node.name)}>{node.name}</button>)}{!folders.length && <p>This folder is empty.</p>}</div></div><label className="vfs-name">File name:<input data-modal-focus aria-label="File name" value={name} onChange={event => { setName(event.target.value); setReplace(null) }} onKeyDown={event => { if (event.key === 'Enter') submit() }} /></label><label className="vfs-name">{mode === 'open' ? 'Files of type:' : 'Save as type:'}<select aria-label="File type"><option>Text Documents (*.txt)</option></select></label></div>{replace ? <div className="vfs-replace"><p>{files.nodes[replace]?.name} already exists. Do you want to replace it?</p><button onClick={() => save(replace)}>Yes</button><button onClick={() => setReplace(null)}>No</button></div> : <div className="dialog-footer"><button onClick={submit}>{mode === 'open' ? 'Open' : 'Save'}</button><button onClick={close}>Cancel</button></div>}</ModalShell>
}

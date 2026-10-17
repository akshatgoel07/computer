import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { icons } from '@/assets'
import { highestRoots } from '@/fs/operations'
import { typeName } from '@/fs/paths'
import { type FsError, type IconKey, type NodeId } from '@/fs/types'
import { play } from '@/lib/sound'
import { useFilesStore } from '@/stores/filesStore'
import { useExplorerStore } from '@/stores/explorerStore'
type Request = { kind: 'delete'; ids: NodeId[]; permanent: boolean; empty: boolean } | { kind: 'error'; title: string; text: string; button?: 'Cancel'; icon?: IconKey } | { kind: 'restoreConflict'; ids: NodeId[] }
export const useFileDialog = create<{ request: Request | null; show: (request: Request | null) => void }>(set => ({ request: null, show: request => set({ request }) }))
const messages: Record<FsError, string> = { invalidName: 'The file name is not valid.', duplicate: 'A file or folder with this name already exists.', cycle: 'The destination is inside the source folder.', protected: 'You cannot change this system folder.', missing: 'This item no longer exists.', quota: 'There is not enough space to save your changes.', restoreConflict: 'This location already contains a file with the same name.' }
export function showError(error: FsError) {
  void play(error === 'quota' ? 'critical' : 'ding')
  useFileDialog.getState().show({ kind: 'error', title: 'Windows Explorer', text: messages[error] })
}
export function requestDelete(ids: NodeId[], permanent = false, empty = false) {
  const state = useFilesStore.getState()
  const roots = highestRoots(state, ids).filter(id => Boolean(state.nodes[id]))
  if (!roots.length) return
  if (roots.some(id => state.nodes[id].protected)) { void play('ding'); return }
  useFileDialog.getState().show({ kind: 'delete', ids: roots, permanent, empty })
}
export function restoreItems(ids: NodeId[], keepBoth = false) {
  const before = useFilesStore.getState()
  const result = before.commit({ kind: 'restore', ids, conflict: keepBoth ? 'keepBoth' : 'fail' })
  if (!result.ok) {
    if (result.error === 'restoreConflict') useFileDialog.getState().show({ kind: 'restoreConflict', ids })
    else showError(result.error)
    return
  }
  const explorer = useExplorerStore.getState()
  for (const [windowId, session] of Object.entries(explorer.sessions)) {
    const restored = ids.filter(id => before.bin[id] && (session.location.kind === 'folder' && session.location.id === before.bin[id].originalParentId || session.location.kind === 'library' && before.bin[id].originalParentId === `akshat-${session.location.library}`))
    if (restored.length) explorer.patch(windowId, { selection: restored, anchor: restored[0] })
  }
}
export default function DeleteDialog() {
  const request = useFileDialog(state => state.request)
  const panel = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!request) return
    const prior = document.activeElement
    panel.current?.querySelector<HTMLButtonElement>('.dialog-footer button')?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); useFileDialog.getState().show(null) }
      if (event.key === 'Tab') {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('.dialog-footer button') ?? [])
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault()
        buttons[(current + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus()
      }
    }
    window.addEventListener('keydown', keys, true)
    return () => { window.removeEventListener('keydown', keys, true); if (prior instanceof HTMLElement && prior.isConnected) prior.focus() }
  }, [request])
  if (!request) return null
  const files = useFilesStore.getState()
  const first = request.kind === 'delete' ? files.nodes[request.ids[0]] : null
  const multiple = request.kind === 'delete' && request.ids.length > 1
  const folder = first?.kind === 'folder'
  const title = request.kind === 'error' ? request.title : request.kind === 'restoreConflict' ? 'Confirm File Replace' : multiple ? 'Delete Multiple Items' : folder ? 'Delete Folder' : 'Delete File'
  const question = request.kind === 'error' ? request.text : request.kind === 'restoreConflict' ? messages.restoreConflict : request.permanent ? multiple ? `Are you sure you want to permanently delete these ${request.ids.length} items?` : `Are you sure you want to permanently delete this ${folder ? 'folder' : 'file'}?` : multiple ? `Are you sure you want to move these ${request.ids.length} items to the Recycle Bin?` : `Are you sure you want to move this ${folder ? 'folder' : 'file'} to the Recycle Bin?`
  const close = () => useFileDialog.getState().show(null)
  const confirm = () => {
    if (busy) return
    setBusy(true)
    if (request.kind === 'restoreConflict') { close(); restoreItems(request.ids, true) }
    if (request.kind === 'delete') {
      const current = useFilesStore.getState()
      const count = request.empty ? Object.keys(current.bin).length : request.ids.filter(id => current.nodes[id]).length
      const result = current.commit(request.empty ? { kind: 'empty' } : { kind: 'delete', ids: request.ids, permanent: request.permanent, now: Date.now() })
      close()
      if (!result.ok) showError(result.error)
      else if (count && (!request.permanent || request.empty)) void play('recycle')
    }
    setBusy(false)
  }
  return <div className="file-modal-shade" onPointerDown={event => event.stopPropagation()}><div ref={panel} className="window glass active file-dialog" data-multiple={multiple || request.kind !== 'delete'} role="alertdialog" aria-modal="true" aria-label={title}>
    <div className="title-bar"><div className="title-bar-text">{title}</div><div className="title-bar-controls"><button aria-label="Close" onClick={close} /></div></div>
    <div className="dialog-content"><img src={icons[request.kind === 'error' ? request.icon ?? 'error' : multiple ? 'recycleFull' : first?.icon ?? 'folder']} alt="" /><div><p>{question}</p>{first && !multiple && <div className="dialog-metadata"><strong>{first.name}</strong><br />{typeName(first)}{first.kind === 'file' && first.bytes > 0 ? `, ${Math.ceil(first.bytes / 1024)} KB` : ''}{first.modifiedAt > 0 && <><br />Date modified: {new Date(first.modifiedAt).toLocaleString('en-US')}</>}</div>}</div></div>
    <div className="dialog-footer">{request.kind === 'error' ? <button onClick={close}>{request.button ?? 'OK'}</button> : <><button onClick={confirm}>{request.kind === 'restoreConflict' ? 'Keep both files' : 'Yes'}</button><button onClick={close}>{request.kind === 'restoreConflict' ? 'Cancel' : 'No'}</button></>}</div>
  </div></div>
}

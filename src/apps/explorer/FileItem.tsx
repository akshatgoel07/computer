import { useEffect, useRef, useState } from 'react'
import { icons, images } from '@/assets'
import { displayName } from '@/fs/paths'
import { type Item } from '@/fs/types'
import { play } from '@/lib/sound'
import { useFilesStore } from '@/stores/filesStore'
import { showError } from '@/shell/DeleteDialog'
export function ItemImage({ item, large = false }: { item: Item; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const node = item.node
  const source = large && node?.kind === 'file' && node.payload.kind === 'image' ? images[node.payload.key] : icons[item.icon]
  const image = failed ? <span className={`icon-fallback ${node?.kind === 'file' ? 'file-fallback' : ''}`} aria-hidden="true" /> : <img src={source} alt="" draggable={false} onError={() => setFailed(true)} />
  return node?.kind === 'file' && node.payload.kind === 'shortcut' ? <span className="shortcut-icon">{image}<img className="shortcut-overlay" src={icons.shortcutOverlay} alt="" /></span> : image
}
export function RenameInput({ item, finish, multiline = false }: { item: Item; finish: () => void; multiline?: boolean }) {
  const node = item.node
  const [value, setValue] = useState(node ? displayName(node) : item.name)
  const [invalid, setInvalid] = useState(false)
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const done = useRef(false)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const commit = () => {
    if (!node || done.current) return
    const extension = node.kind === 'file' ? node.name.slice(displayName(node).length) : ''
    const result = useFilesStore.getState().commit({ kind: 'rename', id: node.id, name: value + extension })
    if (result.ok) { done.current = true; finish() }
    else if (result.error === 'quota') { done.current = true; finish(); showError(result.error) }
    else { setInvalid(true); void play('ding'); input.current?.focus(); input.current?.select() }
  }
  const Control = multiline ? 'textarea' : 'input'
  return <Control className="rename-input" ref={(element: HTMLInputElement | HTMLTextAreaElement | null) => { input.current = element }} aria-label="File name" aria-invalid={invalid} data-tooltip={invalid ? 'Enter a valid name that differs from other items.' : undefined} value={value} onChange={event => { setValue(event.target.value); setInvalid(false) }} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onBlur={commit} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Enter') { event.preventDefault(); commit() }
    if (event.key === 'Escape') { event.preventDefault(); done.current = true; finish() }
  }} />
}

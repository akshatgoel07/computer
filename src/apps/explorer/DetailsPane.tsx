import { typeName } from '@/fs/paths'
import { type Item } from '@/fs/types'
import { ItemImage } from './FileItem'
import { size } from './FileList'
export default function DetailsPane({ items, selected }: { items: Item[]; selected: Item[] }) {
  const item = selected.length === 1 ? selected[0] : { id: 'folder', name: '', icon: 'folder' as const }
  const bytes = selected.reduce((sum, entry) => sum + (entry.node?.kind === 'file' ? entry.node.bytes : 0), 0)
  return <footer className="details-pane"><ItemImage item={item} /><div>{selected.length === 0 ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : selected.length === 1 ? item.name : `${selected.length} items selected`}{selected.length > 0 && <small>{selected.length === 1 && item.node ? typeName(item.node) : ''}{bytes > 0 ? ` ${size(bytes)}` : ''}</small>}</div></footer>
}

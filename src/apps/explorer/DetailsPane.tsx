import { locationIcon, typeName } from '@/fs/paths'
import { type Item, type Location } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { ItemImage } from './FileItem'
import { size } from './FileList'
export default function DetailsPane({ items, selected, location }: { items: Item[]; selected: Item[]; location: Location }) {
  const files = useFilesStore()
  const item = selected.length === 1 ? selected[0] : { id: 'folder', name: '', icon: locationIcon(files, location) }
  const bytes = selected.reduce((sum, entry) => sum + (entry.node?.kind === 'file' ? entry.node.bytes : 0), 0)
  return <footer className="details-pane"><ItemImage item={item} /><div>{selected.length === 0 ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : selected.length === 1 ? item.name : `${selected.length} items selected`}{selected.length > 0 && <small>{selected.length === 1 && item.node ? typeName(item.node) : ''}{bytes > 0 ? ` ${size(bytes)}` : ''}</small>}</div></footer>
}

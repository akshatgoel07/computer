import { itemsAt } from '@/fs/paths'
import { type Snapshot } from '@/fs/types'
export const binItems = (snapshot: Snapshot) => itemsAt(snapshot, { kind: 'shell', name: 'bin' })
export { restoreItems, requestDelete } from '@/shell/DeleteDialog'

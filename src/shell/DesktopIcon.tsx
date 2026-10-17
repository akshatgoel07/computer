import type { CSSProperties, PointerEvent } from 'react'
import type { Item } from '@/fs/types'
import { ItemImage, RenameInput } from '@/apps/explorer/FileItem'
export default function DesktopIcon({ item, selected, position, size, rename, finishRename, onClick, onDoubleClick, onContextMenu, onPointerDown, dragging, cut }: { item: Item; selected: boolean; position: { x: number; y: number }; size: 'large' | 'medium' | 'small'; rename: boolean; finishRename: () => void; onClick: (event: React.MouseEvent) => void; onDoubleClick: () => void; onContextMenu: (event: React.MouseEvent) => void; onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void; dragging: boolean; cut?: boolean }) {
  const dimension = size === 'large' ? 96 : size === 'small' ? 32 : 48
  const width = size === 'large' ? 112 : size === 'small' ? 60 : 76
  const height = size === 'large' ? 130 : size === 'small' ? 70 : 94
  return <button className="shell-button desktop-icon" data-item-id={item.id} data-selected={selected} aria-pressed={selected} data-drag={dragging} data-cut={cut} style={{ left: position.x, top: position.y + 2, width, height, '--label-top': `${dimension + 11}px` } as CSSProperties} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} onPointerDown={onPointerDown}>
    <span className="desktop-image" style={{ position: 'absolute', left: (width - dimension) / 2, top: 7, width: dimension, height: dimension }}><ItemImage item={item} /></span>{rename ? <RenameInput multiline item={item} finish={finishRename} /> : <span style={{ top: dimension + 11, width: width - 2 }}>{item.name}</span>}
  </button>
}

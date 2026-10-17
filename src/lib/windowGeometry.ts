export type Rect = { x: number; y: number; width: number; height: number }
export type WorkArea = { width: number; height: number }
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export function workArea(): WorkArea {
  return { width: window.innerWidth, height: Math.max(0, window.innerHeight - 40) }
}

export function visibleRect(rect: Rect, area = workArea(), minimum = { width: 320, height: 200 }): Rect {
  const width = Math.min(area.width, Math.max(minimum.width, rect.width))
  const height = Math.min(area.height, Math.max(minimum.height, rect.height))
  return {
    width, height,
    x: Math.max(48 - width, Math.min(area.width - 48, rect.x)),
    y: Math.max(0, Math.min(Math.max(0, area.height - 30), rect.y)),
  }
}

export function resizeRect(rect: Rect, edge: ResizeEdge, dx: number, dy: number, minimum = { width: 320, height: 200 }): Rect {
  const area = workArea()
  const left = edge.includes('w') ? Math.max(0, Math.min(rect.x + dx, rect.x + rect.width - Math.min(minimum.width, area.width))) : rect.x
  const top = edge.includes('n') ? Math.max(0, Math.min(rect.y + dy, rect.y + rect.height - Math.min(minimum.height, area.height))) : rect.y
  const right = edge.includes('e') ? Math.max(left + Math.min(minimum.width, area.width), Math.min(area.width, rect.x + rect.width + dx)) : rect.x + rect.width
  const bottom = edge.includes('s') ? Math.max(top + Math.min(minimum.height, area.height), Math.min(area.height, rect.y + rect.height + dy)) : rect.y + rect.height
  return { x: left, y: top, width: right - left, height: bottom - top }
}

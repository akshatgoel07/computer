import { create } from 'zustand'
import { workArea, type Rect } from '@/lib/windowGeometry'
export type WindowMode = 'normal' | 'maximized' | 'left' | 'right' | 'vertical'
export type WindowTransition = { token: number; kind: 'open' | 'close' | 'minimize' | 'restore' | 'geometry'; from?: Rect }
let sequence = 0
export const transition = (kind: WindowTransition['kind'], from?: Rect): WindowTransition => ({ token: ++sequence, kind, from })
export const duration = (milliseconds: number) => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : milliseconds
export const easing = 'cubic-bezier(0.2,0,0.2,1)'
export function modeRect(mode: WindowMode, normal: Rect, area = workArea()): Rect {
  if (mode === 'normal') return normal
  if (mode === 'vertical') return { ...normal, y: 0, height: area.height }
  const half = Math.floor(area.width / 2)
  return { x: mode === 'right' ? half : 0, y: 0, width: mode === 'maximized' ? area.width : mode === 'right' ? area.width - half : half, height: area.height }
}
export const rectangleTransform = (base: Rect, target: Rect) => `translate(${target.x - base.x}px,${target.y - base.y}px) scale(${target.width / base.width},${target.height / base.height})`
export const useAero = create<{ peek: string | null; snap: Exclude<WindowMode, 'normal' | 'vertical'> | null; epoch: number }>(() => ({ peek: null, snap: null, epoch: 0 }))
export function cancelPreviews() { useAero.setState(state => ({ peek: null, snap: null, epoch: state.epoch + 1 })) }
export function taskRectangle(id: string): Rect {
  const element = Array.from(document.querySelectorAll<HTMLElement>('.task-button')).find(button => button.dataset.windowIds?.split(' ').includes(id))
  if (element) { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height } }
  return { x: 120, y: innerHeight - 40, width: 60, height: 40 }
}

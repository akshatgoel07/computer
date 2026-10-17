import { useEffect, useRef } from 'react'
export type MenuEntry = { label: string; action?: () => void; checked?: boolean } | { separator: true }
export default function ContextMenu({ x, y, entries, close }: { x: number; y: number; entries: MenuEntry[]; close: () => void }) {
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = menu.current
    if (!element) return
    const bounds = element.getBoundingClientRect()
    element.style.left = `${Math.max(2, Math.min(x, innerWidth - bounds.width - 2))}px`
    element.style.top = `${Math.max(2, Math.min(y, innerHeight - bounds.height - 2))}px`
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !element.contains(event.target)) close() }
    const timer = setTimeout(() => window.addEventListener('pointerdown', outside), 0)
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', outside) }
  }, [x, y, close])
  return <div ref={menu} className="explorer-popup context-menu" role="menu" style={{ left: x, top: y }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { event.preventDefault(); close() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus() }
  }}>{entries.map((entry, index) => 'separator' in entry ? <div className="menu-separator" key={index} role="separator" /> : <button className="shell-button" role="menuitem" key={index} disabled={!entry.action} onClick={() => { close(); entry.action?.() }}><span className="menu-check">{entry.checked ? '✓' : ''}</span>{entry.label}</button>)}</div>
}

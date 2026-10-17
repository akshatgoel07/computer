import { useLayoutEffect, useRef } from 'react'
function readonlyNode(source: Node, scrolls: { source: HTMLElement | SVGElement; target: Element }[]): Node | null {
  if (source instanceof Text) return document.createTextNode(source.textContent ?? '')
  if (!(source instanceof HTMLElement) && !(source instanceof SVGElement)) return null
  if (['AUDIO', 'VIDEO', 'IFRAME', 'SCRIPT', 'STYLE'].includes(source.tagName)) return null
  const element = document.createElementNS(source.namespaceURI, source.tagName.toLowerCase())
  for (const attribute of Array.from(source.attributes)) {
    if (!['id', 'for', 'autofocus', 'name', 'aria-labelledby', 'aria-describedby', 'aria-controls'].includes(attribute.name) && !attribute.name.startsWith('on')) element.setAttribute(attribute.name, attribute.value)
  }
  element.removeAttribute('data-app-focus')
  element.setAttribute('tabindex', '-1')
  for (const child of source.childNodes) { const next = readonlyNode(child, scrolls); if (next) element.appendChild(next) }
  if (element instanceof HTMLInputElement && source instanceof HTMLInputElement) { element.value = source.value; element.checked = source.checked; element.disabled = true }
  if (element instanceof HTMLTextAreaElement && source instanceof HTMLTextAreaElement) { element.value = source.value; element.readOnly = true }
  if (element instanceof HTMLButtonElement || element instanceof HTMLSelectElement) element.disabled = true
  if (source.scrollTop || source.scrollLeft) scrolls.push({ source, target: element })
  return element
}
export default function ReadonlyAppView({ windowId }: { windowId: string }) {
  const host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const source = document.querySelector<HTMLElement>(`.shell-window[data-window-id="${windowId}"] > .window-body`)
    const target = host.current
    if (!source || !target) return
    let frame = 0
    const render = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const scrolls: { source: HTMLElement | SVGElement; target: Element }[] = []
        const view = readonlyNode(source, scrolls)
        if (!(view instanceof HTMLElement)) return
        const owner = source.closest<HTMLElement>('.shell-window')
        const style = getComputedStyle(owner ?? source)
        const pixels = (value: string) => Number.parseFloat(value) || 0
        const width = source.clientWidth || pixels(style.width) - pixels(style.paddingLeft) - pixels(style.paddingRight) - pixels(style.borderLeftWidth) - pixels(style.borderRightWidth)
        const height = source.clientHeight || pixels(style.height) - pixels(style.paddingTop) - pixels(style.paddingBottom) - pixels(style.borderTopWidth) - pixels(style.borderBottomWidth)
        Object.assign(view.style, { width: `${width}px`, height: `${height}px`, transform: `scale(${Math.min(200 / width, 124 / height)})`, transformOrigin: 'top left', position: 'absolute', left: `${(200 - width * Math.min(200 / width, 124 / height)) / 2}px`, top: `${(124 - height * Math.min(200 / width, 124 / height)) / 2}px` })
        target.replaceChildren(view)
        for (const pair of scrolls) { pair.target.scrollTop = pair.source.scrollTop; pair.target.scrollLeft = pair.source.scrollLeft }
      })
    }
    const observer = new MutationObserver(render)
    observer.observe(source, { subtree: true, childList: true, characterData: true, attributes: true })
    const resize = new ResizeObserver(render)
    resize.observe(source)
    source.addEventListener('input', render)
    source.addEventListener('scroll', render, true)
    render()
    return () => { observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); source.removeEventListener('input', render); source.removeEventListener('scroll', render, true) }
  }, [windowId])
  return <div ref={host} className="thumbnail-view" inert aria-hidden="true" />
}

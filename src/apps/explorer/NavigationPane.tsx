import { useState, type KeyboardEvent } from 'react'
import { icons } from '@/assets'
import { children, locationName, sameLocation } from '@/fs/paths'
import { libraries, rootId } from '@/fs/seed'
import { nodeId, type IconKey, type Location } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { useExplorerStore } from '@/stores/explorerStore'
type Branch = { id: string; name: string; icon: IconKey; location?: Location; children?: Branch[] }
export default function NavigationPane({ windowId, location }: { windowId: string; location: Location }) {
  const files = useFilesStore()
  const [expanded, setExpanded] = useState<string[]>(['favorites', 'libraries'])
  const [focused, setFocused] = useState('')
  const physical = (id: string): Branch => {
    const node = files.nodes[nodeId(id)]
    return { id, name: id === rootId ? 'Local Disk (C:)' : node.name, icon: node.icon, location: { kind: 'folder', id: node.id }, children: children(files, node.id).filter(child => child.kind === 'folder').map(child => ({ id: child.id, name: child.name, icon: child.icon, location: { kind: 'folder', id: child.id } })) }
  }
  const shell = (name: 'desktop' | 'recent' | 'homegroup' | 'computer' | 'network', icon: IconKey): Branch => ({ id: name, name: locationName(files, { kind: 'shell', name }), icon, location: { kind: 'shell', name } })
  const branches: Branch[] = [
    { id: 'favorites', name: 'Favorites', icon: 'favorites', children: [shell('desktop', 'desktop'), { ...physical('akshat-downloads'), icon: 'downloads' }, shell('recent', 'recentPlaces')] },
    { id: 'libraries', name: 'Libraries', icon: 'libraries', location: { kind: 'shell', name: 'libraries' }, children: libraries.map(library => ({ id: `library-${library}`, name: locationName(files, { kind: 'library', library }), icon: `library${library[0].toUpperCase()}${library.slice(1)}` as IconKey, location: { kind: 'library', library } })) },
    shell('homegroup', 'homegroup'), { ...shell('computer', 'computer'), children: [physical('c'), { id: 'dvd', name: 'DVD RW Drive (D:)', icon: 'driveDvd' }] }, shell('network', 'network'),
  ]
  const navigate = (branch: Branch) => { if (branch.location) useExplorerStore.getState().navigate(windowId, branch.location) }
  const toggle = (id: string) => setExpanded(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])
  const render = (branch: Branch, depth: number, parent?: string): React.ReactNode => {
    const resolved = branch.location?.kind === 'folder' && expanded.includes(branch.id) ? physical(branch.id) : branch
    const descendants = resolved.children ?? []
    const open = expanded.includes(branch.id)
    const key = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight' && descendants.length) { event.preventDefault(); if (!open) toggle(branch.id); else document.getElementById(`${windowId}-nav-${descendants[0].id}`)?.focus() }
      if (event.key === 'ArrowLeft') { event.preventDefault(); if (open) toggle(branch.id); else if (parent) document.getElementById(`${windowId}-nav-${parent}`)?.focus() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const rows = Array.from(event.currentTarget.closest('nav')?.querySelectorAll<HTMLElement>('[role=treeitem]') ?? [])
        rows[rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)]?.focus()
      }
      if (event.key === 'Enter') { event.preventDefault(); navigate(branch) }
    }
    return <div key={branch.id} className={depth === 0 ? 'navigation-group' : undefined}><div id={`${windowId}-nav-${branch.id}`} className="navigation-row" role="treeitem" aria-selected={branch.location ? sameLocation(location, branch.location) : false} aria-expanded={descendants.length ? open : undefined} style={{ paddingLeft: depth * 16 }} tabIndex={focused === branch.id || !focused && branch.id === 'favorites' ? 0 : -1} onFocus={() => setFocused(branch.id)} onKeyDown={key} onClick={() => navigate(branch)}>
      <button className="shell-button tree-expander" tabIndex={-1} aria-label={`${open ? 'Collapse' : 'Expand'} ${branch.name}`} onClick={event => { event.stopPropagation(); toggle(branch.id) }}>{descendants.length ? open ? '▾' : '▸' : ''}</button><img src={icons[branch.icon]} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden' }} /><span>{branch.name}</span></div>{open && descendants.map(child => render(child, depth + 1, branch.id))}</div>
  }
  return <nav className="navigation-pane" aria-label="Folders"><div role="tree">{branches.map(branch => render(branch, 0))}</div></nav>
}

import { ancestors, inBin, pathFor, validName } from '@/fs/paths'
import { rootId } from '@/fs/seed'
import { failure, nodeId, success, type IconKey, type Location, type NodeId, type Result, type Snapshot } from '@/fs/types'
type ShortcutTarget = Location | { kind: 'file'; id: NodeId }
export type Operation = { kind: 'createText'; parent: NodeId; name?: string; text?: string } | { kind: 'writeText'; id: NodeId; text: string } | { kind: 'shortcuts'; parent: NodeId; targets: { target: ShortcutTarget; name: string; icon: IconKey }[] } | { kind: 'createFolder'; parent: NodeId; name?: string } | { kind: 'rename'; id: NodeId; name: string } | { kind: 'delete'; ids: NodeId[]; permanent: boolean; now: number } | { kind: 'restore'; ids: NodeId[]; conflict: 'fail' | 'keepBoth' } | { kind: 'empty' } | { kind: 'move' | 'copy'; ids: NodeId[]; parent: NodeId }
const siblings = (state: Snapshot, parent: NodeId, name: string, except?: NodeId) => Object.values(state.nodes).some(node => node.parentId === parent && node.id !== except && node.name.toLowerCase() === name.toLowerCase())
export function freeName(state: Snapshot, parent: NodeId, name: string, extension = false) {
  if (!siblings(state, parent, name)) return name
  const index = extension ? name.lastIndexOf('.') : -1
  const base = index > 0 ? name.slice(0, index) : name
  const suffix = index > 0 ? name.slice(index) : ''
  let number = 2
  while (siblings(state, parent, `${base} (${number})${suffix}`)) number++
  return `${base} (${number})${suffix}`
}
export const highestRoots = (state: Snapshot, ids: NodeId[]) => [...new Set(ids)].filter(id => !ancestors(state, id).slice(0, -1).some(node => ids.includes(node.id)))
function removeTree(state: Snapshot, id: NodeId) {
  const ids = Object.values(state.nodes).filter(node => ancestors(state, node.id).some(parent => parent.id === id)).map(node => node.id)
  for (const child of ids) { delete state.nodes[child]; delete state.bin[child] }
}
export function operate(source: Snapshot, operation: Operation): Result<{ snapshot: Snapshot; id?: NodeId }> {
  const state = structuredClone(source)
  if (operation.kind === 'writeText') {
    const node = state.nodes[operation.id]
    if (!node || node.kind !== 'file' || node.payload.kind !== 'text' || inBin(state, node.id)) return failure('missing')
    if (node.protected) return failure('protected')
    node.payload.text = operation.text
    node.bytes = new TextEncoder().encode(operation.text).length
    node.modifiedAt = Date.now()
  }
  if (operation.kind === 'createText') {
    const parent = state.nodes[operation.parent]
    if (!parent || parent.kind !== 'folder' || inBin(state, parent.id)) return failure('missing')
    const name = operation.name ?? freeName(state, parent.id, 'New Text Document.txt', true)
    if (!validName(name)) return failure('invalidName')
    if (siblings(state, parent.id, name)) return failure('duplicate')
    const id = nodeId(crypto.randomUUID())
    const text = operation.text ?? ''
    state.nodes[id] = { id, parentId: parent.id, name, kind: 'file', bytes: new TextEncoder().encode(text).length, payload: { kind: 'text', text }, icon: 'textFile', createdAt: Date.now(), modifiedAt: Date.now(), protected: false, hidden: false }
    return success({ snapshot: state, id })
  }
  if (operation.kind === 'shortcuts') {
    const parent = state.nodes[operation.parent]
    if (!parent || parent.kind !== 'folder' || inBin(state, parent.id)) return failure('missing')
    let first: NodeId | undefined
    for (const entry of operation.targets) {
      if ((entry.target.kind === 'folder' || entry.target.kind === 'file') && (!state.nodes[entry.target.id] || inBin(state, entry.target.id))) return failure('missing')
      const id = nodeId(crypto.randomUUID())
      first ??= id
      const name = freeName(state, parent.id, `${entry.name} - Shortcut.lnk`, true)
      state.nodes[id] = { id, parentId: parent.id, name, kind: 'file', bytes: 0, payload: { kind: 'shortcut', target: entry.target }, icon: entry.icon, protected: false, hidden: false, createdAt: Date.now(), modifiedAt: Date.now() }
    }
    return success({ snapshot: state, id: first })
  }
  if (operation.kind === 'createFolder') {
    const parent = state.nodes[operation.parent]
    if (!parent || parent.kind !== 'folder' || inBin(state, parent.id)) return failure('missing')
    const name = operation.name ?? freeName(state, parent.id, 'New folder')
    if (!validName(name)) return failure('invalidName')
    if (siblings(state, parent.id, name)) return failure('duplicate')
    const id = nodeId(crypto.randomUUID())
    const now = Date.now()
    state.nodes[id] = { id, parentId: parent.id, name, kind: 'folder', template: 'general', icon: 'folder', protected: false, hidden: false, createdAt: now, modifiedAt: now }
    return success({ snapshot: state, id })
  }
  if (operation.kind === 'move' || operation.kind === 'copy') {
    const parent = state.nodes[operation.parent]
    if (!parent || parent.kind !== 'folder' || inBin(state, parent.id)) return failure('missing')
    const ids = highestRoots(state, operation.ids)
    const names = new Set<string>()
    for (const id of ids) {
      const node = state.nodes[id]
      if (!node || inBin(state, id)) return failure('missing')
      if (node.protected && operation.kind === 'move') return failure('protected')
      if (ancestors(state, parent.id).some(ancestor => ancestor.id === id)) return failure('cycle')
      const name = node.name.toLowerCase()
      if (names.has(name) || siblings(state, parent.id, node.name, operation.kind === 'move' ? id : undefined)) return failure('duplicate')
      names.add(name)
    }
    if (operation.kind === 'move') for (const id of ids) state.nodes[id].parentId = parent.id
    else {
      const descendants = Object.values(source.nodes).filter(node => ancestors(source, node.id).some(ancestor => ids.includes(ancestor.id)))
      const copies = new Map(descendants.map(node => [node.id, nodeId(crypto.randomUUID())]))
      for (const node of descendants) {
        const id = copies.get(node.id)
        const parentId = ids.includes(node.id) ? parent.id : node.parentId && copies.get(node.parentId)
        if (!id || !parentId) return failure('missing')
        state.nodes[id] = { ...node, id, parentId, protected: false, createdAt: Date.now() }
      }
    }
  }
  if (operation.kind === 'rename') {
    const node = state.nodes[operation.id]
    if (!node || inBin(state, node.id)) return failure('missing')
    if (node.protected) return failure('protected')
    if (!validName(operation.name)) return failure('invalidName')
    if (node.parentId && siblings(state, node.parentId, operation.name, node.id)) return failure('duplicate')
    node.name = operation.name
    node.modifiedAt = Date.now()
  }
  if (operation.kind === 'delete') {
    const ids = highestRoots(state, operation.ids)
    for (const id of ids) {
      const node = state.nodes[id]
      if (!node || (!operation.permanent && inBin(state, id))) return failure('missing')
      if (node.protected) return failure('protected')
    }
    for (const id of ids) {
      const node = state.nodes[id]
      if (operation.permanent) removeTree(state, id)
      else if (node.parentId) {
        state.bin[id] = { id, originalParentId: node.parentId, originalLocation: pathFor(state, node.parentId), deletedAt: operation.now }
        node.parentId = null
      }
    }
  }
  if (operation.kind === 'restore') {
    const restoreOne = (id: NodeId): boolean => {
      const entry = state.bin[id]
      const node = state.nodes[id]
      if (!entry || !node) return false
      const deletedParent = ancestors(state, entry.originalParentId).find(parent => Boolean(state.bin[parent.id]))
      if (deletedParent && !restoreOne(deletedParent.id)) return false
      let parent = state.nodes[entry.originalParentId]
      if (!parent) {
        let current = rootId
        for (const part of entry.originalLocation.split('\\').slice(1).filter(Boolean)) {
          const existing = Object.values(state.nodes).find(item => item.parentId === current && item.name.toLowerCase() === part.toLowerCase())
          if (existing && existing.kind !== 'folder') return false
          if (existing) current = existing.id
          else {
            const key = nodeId(crypto.randomUUID())
            state.nodes[key] = { id: key, parentId: current, name: part, kind: 'folder', template: 'general', icon: 'folder', createdAt: Date.now(), modifiedAt: Date.now(), protected: false, hidden: false }
            current = key
          }
        }
        parent = state.nodes[current]
      }
      if (parent.kind !== 'folder' || inBin(state, parent.id)) return false
      if (siblings(state, parent.id, node.name)) {
        if (operation.conflict !== 'keepBoth') return false
        node.name = freeName(state, parent.id, node.name, node.kind === 'file')
      }
      node.parentId = parent.id
      delete state.bin[id]
      return true
    }
    for (const id of operation.ids) if (state.bin[id] && !restoreOne(id)) return failure('restoreConflict')
  }
  if (operation.kind === 'empty') for (const id of Object.keys(state.bin)) removeTree(state, nodeId(id))
  return success({ snapshot: state })
}

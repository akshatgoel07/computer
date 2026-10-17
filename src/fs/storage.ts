import { icons, images, media } from '@/assets'
import { seed, rootId, applyAssetMetadata } from '@/fs/seed'
import { nodeId, type Location, type Snapshot } from '@/fs/types'
const key = 'computer.fs.v1'
export const byteLimit = 2097152
let writable = true
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const templates = ['general', 'documents', 'pictures', 'music', 'videos']
function location(value: unknown): value is Location {
  if (!object(value)) return false
  if (value.kind === 'folder') return typeof value.id === 'string'
  if (value.kind === 'library') return typeof value.library === 'string' && templates.slice(1).includes(value.library)
  return value.kind === 'shell' && typeof value.name === 'string' && ['desktop', 'libraries', 'computer', 'bin', 'recent', 'homegroup', 'network'].includes(value.name)
}
export function parseSnapshot(value: unknown): Snapshot | null {
  if (!object(value)) return null
  const candidate = object(value.state) ? value.state : value
  if (candidate.version !== 1 || !object(candidate.nodes) || !object(candidate.bin)) return null
  const nodes = candidate.nodes
  const bin = candidate.bin
  for (const [id, node] of Object.entries(nodes)) {
    if (!object(node) || node.id !== id || typeof node.name !== 'string' || !node.name || typeof node.icon !== 'string' || !(Object.hasOwn(icons, node.icon)) || typeof node.protected !== 'boolean' || typeof node.hidden !== 'boolean' || !finite(node.createdAt) || !finite(node.modifiedAt)) return null
    if (node.parentId !== null) {
      if (typeof node.parentId !== 'string') return null
      const parentNode = nodes[node.parentId]
      if (!object(parentNode) || parentNode.kind !== 'folder') return null
    }
    if (node.kind === 'folder') { if (typeof node.template !== 'string' || !templates.includes(node.template)) return null }
    else if (node.kind === 'file') {
      const payload = node.payload
      if (!finite(node.bytes) || !object(payload)) return null
      if (payload.kind === 'text') { if (typeof payload.text !== 'string') return null }
      else if (payload.kind === 'image') { if (typeof payload.key !== 'string' || !(Object.hasOwn(images, payload.key))) return null }
      else if (payload.kind === 'video' && payload.key === undefined) {}
      else if (payload.kind === 'audio' || payload.kind === 'video') { if (typeof payload.key !== 'string' || !(Object.hasOwn(media, payload.key))) return null }
      else if (payload.kind === 'shortcut') { const target = payload.target; if (object(target) && target.kind === 'file') { if (typeof target.id !== 'string' || !object(nodes[target.id])) return null } else if (!location(target) || (target.kind === 'folder' && !nodes[target.id])) return null }
      else return null
    } else return null
    const seen = new Set<string>([id])
    let parent: unknown = node.parentId
    while (typeof parent === 'string') {
      if (seen.has(parent)) return null
      seen.add(parent)
      const ancestor = nodes[parent]
      if (!object(ancestor)) return null
      parent = ancestor.parentId
    }
    if (node.parentId === null && id !== rootId && !bin[id]) return null
  }
  const root = nodes[rootId]
  if (!object(root) || root.kind !== 'folder' || root.parentId !== null) return null
  for (const [id, entry] of Object.entries(bin)) {
    const binNode = nodes[id]
    if (!object(entry) || entry.id !== id || !object(binNode) || binNode.parentId !== null || binNode.protected || typeof entry.originalParentId !== 'string' || typeof entry.originalLocation !== 'string' || !finite(entry.deletedAt)) return null
    const prior = nodes[entry.originalParentId]
    if (prior !== undefined && (!object(prior) || prior.kind !== 'folder')) return null
    const seen = new Set<string>([id])
    let previous: unknown = entry.originalParentId
    while (typeof previous === 'string' && object(bin[previous])) {
      if (seen.has(previous)) return null
      seen.add(previous)
      const previousEntry = bin[previous]
      previous = object(previousEntry) ? previousEntry.originalParentId : null
    }
  }
  for (const id of Object.keys(nodes)) {
    const visited = new Set<string>()
    let current: unknown = id
    while (typeof current === 'string' && object(nodes[current])) {
      if (visited.has(current)) return null
      visited.add(current)
      const node = nodes[current]
      const entry = bin[current]
      current = object(node) && node.parentId !== null ? node.parentId : object(entry) ? entry.originalParentId : null
    }
  }
  return candidate as Snapshot
}
export function saveSnapshot(snapshot: Snapshot) {
  if (!writable) return false
  try {
    const json = JSON.stringify({ state: snapshot, version: 1 })
    if (new TextEncoder().encode(json).length > byteLimit) return false
    localStorage.setItem(key, json)
    return true
  } catch { return false }
}
export function loadSnapshot(): Snapshot {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
    if (raw === null) return seed()
    const value = parseSnapshot(JSON.parse(raw))
    if (value && new TextEncoder().encode(raw).length <= byteLimit) return applyAssetMetadata(value)
  } catch { if (raw === null) writable = false }
  if (raw !== null) {
    try { localStorage.setItem(`computer.fs.recovery.${Date.now()}`, raw) }
    catch { writable = false }
  }
  return seed()
}
export function readPreference<T>(name: string, fallback: T, validate: (value: unknown) => value is T): T {
  try { const value: unknown = JSON.parse(localStorage.getItem(name) ?? 'null'); return validate(value) ? value : fallback } catch { return fallback }
}
export function savePreference(name: string, value: unknown) {
  try { localStorage.setItem(name, JSON.stringify(value)) } catch { return }
}
export const storedIds = (values: string[]) => values.map(nodeId)

export const durableStorage = {
  getItem: (name: string) => {
    try { const raw = localStorage.getItem(name); return raw && parseSnapshot(JSON.parse(raw)) ? raw : null } catch { return null }
  },
  setItem: (name: string, value: string) => {
    try { if (localStorage.getItem(name) !== value) localStorage.setItem(name, value) } catch { return }
  },
  removeItem: (name: string) => { try { localStorage.removeItem(name) } catch { return } },
}

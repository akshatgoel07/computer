import type { icons, images, media } from '@/assets'
export type NodeId = string & { readonly __brand: 'NodeId' }
export const nodeId = (value: string) => value as NodeId
export type IconKey = keyof typeof icons
export type Template = 'general' | 'documents' | 'music' | 'pictures' | 'videos'
export type Library = Exclude<Template, 'general'>
export type Location = { kind: 'folder'; id: NodeId } | { kind: 'library'; library: Library } | { kind: 'shell'; name: 'desktop' | 'libraries' | 'computer' | 'bin' | 'recent' | 'homegroup' | 'network' }
export type Payload = { kind: 'text'; text: string } | { kind: 'image'; key: keyof typeof images } | { kind: 'audio'; key: keyof typeof media } | { kind: 'video'; key?: keyof typeof media } | { kind: 'shortcut'; target: Location | { kind: 'file'; id: NodeId } }
type BaseNode = { id: NodeId; parentId: NodeId | null; name: string; icon: IconKey; createdAt: number; modifiedAt: number; protected: boolean; hidden: boolean }
export type FsNode = BaseNode & ({ kind: 'folder'; template: Template } | { kind: 'file'; bytes: number; payload: Payload })
export type TrashEntry = { id: NodeId; originalParentId: NodeId; originalLocation: string; deletedAt: number }
export type Snapshot = { version: 1; nodes: Record<NodeId, FsNode>; bin: Record<NodeId, TrashEntry> }
export type FsError = 'invalidName' | 'duplicate' | 'cycle' | 'protected' | 'missing' | 'quota' | 'restoreConflict'
export type Result<T> = { ok: true; value: T } | { ok: false; error: FsError }
export const success = <T,>(value: T): Result<T> => ({ ok: true, value })
export const failure = (error: FsError): Result<never> => ({ ok: false, error })
export type View = 'extraLarge' | 'large' | 'medium' | 'small' | 'list' | 'details' | 'tiles' | 'content'
export type Item = { id: string; name: string; icon: IconKey; location?: Location; node?: FsNode }

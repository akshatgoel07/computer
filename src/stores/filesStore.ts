import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { operate, type Operation } from '@/fs/operations'
import { durableStorage, loadSnapshot, saveSnapshot } from '@/fs/storage'
import { failure, success, type NodeId, type Result, type Snapshot } from '@/fs/types'
type FilesStore = Snapshot & { commit: (operation: Operation) => Result<NodeId | undefined> }
export const useFilesStore = create<FilesStore>()(persist((set, get) => ({
  ...loadSnapshot(),
  commit: operation => {
    const current = get()
    const candidate = operate({ version: 1, nodes: current.nodes, bin: current.bin }, operation)
    if (!candidate.ok) return candidate
    if (!saveSnapshot(candidate.value.snapshot)) return failure('quota')
    set(candidate.value.snapshot)
    return success(candidate.value.id)
  },
}), { name: 'computer.fs.v1', version: 1, skipHydration: true, storage: createJSONStorage(() => durableStorage), partialize: state => ({ version: state.version, nodes: state.nodes, bin: state.bin }) }))

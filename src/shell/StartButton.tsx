import { useShellStore } from '@/stores/shellStore'

export default function StartButton() {
  const open = useShellStore(state => state.startOpen)
  return <button id="start-button" className="shell-button start-button" aria-label="Start" data-tooltip="Start"
    aria-expanded={open} aria-controls="start-menu" onClick={() => useShellStore.getState().setStart(!open)}>
    <span className="start-orb" />
  </button>
}

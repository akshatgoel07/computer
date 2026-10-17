import { useEffect, useRef, useState } from 'react'
import { icons, media } from '@/assets'
import { audioMetadata } from '@/fs/seed'
import { displayName, inBin } from '@/fs/paths'
import { type NodeId } from '@/fs/types'
import { useFilesStore } from '@/stores/filesStore'
import { useWindows } from '@/stores/windows'
import ContextMenu, { type MenuEntry } from '@/shell/ContextMenu'
import './media.css'
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const albums: Partial<Record<keyof typeof media, keyof typeof media>> = { kalimba: 'albumKalimba', maid: 'albumMaid', sleepAway: 'albumSleepAway' }
export default function MediaPlayer({ windowId }: { windowId: string }) {
  const context = useWindows(state => state.windows[windowId]?.launchContext)
  const files = useFilesStore()
  const all = Object.values(files.nodes).filter(node => node.kind === 'file' && node.payload.kind === 'audio' && !inBin(files, node.id)).map(node => node.id)
  const queue = (context?.kind === 'audio' ? context.ids : all).filter(id => { const node = files.nodes[id]; return node?.kind === 'file' && node.payload.kind === 'audio' && !inBin(files, id) })
  const [current, setCurrent] = useState<NodeId | null>(() => context?.kind === 'audio' ? context.selected : all[0] ?? null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(.5)
  const [muted, setMuted] = useState(false)
  const [showList, setShowList] = useState(false)
  const [menuBar, setMenuBar] = useState(false)
  const [failedCover, setFailedCover] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const wanted = useRef(context?.kind === 'audio' ? context.play : false)
  const node = current ? files.nodes[current] : null
  const payload = node?.kind === 'file' && node.payload.kind === 'audio' ? node.payload : null
  const source = payload ? media[payload.key] : undefined
  useEffect(() => {
    if (context?.kind === 'audio' && context.selected && context.selected !== current) { wanted.current = context.play; setCurrent(context.selected) }
    else if (context?.kind === 'audio' && context.play && !wanted.current) { wanted.current = true; void audio.current?.play().catch(() => { wanted.current = false }) }
  }, [context])
  useEffect(() => {
    const element = audio.current
    if (!element) return
    element.pause(); setElapsed(0); setDuration(0); setPlaying(false); setFailedCover(false)
    if (source) element.src = source
    else element.removeAttribute('src')
    element.load()
    if (wanted.current && source) void element.play().catch(() => { wanted.current = false; setPlaying(false) })
  }, [source])
  useEffect(() => { if (audio.current) { audio.current.volume = volume; audio.current.muted = muted } }, [volume, muted])
  useEffect(() => { const element = audio.current; element?.parentElement?.focus(); return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load() } } }, [])
  const toggle = () => {
    const element = audio.current
    if (!element || !source) return
    if (element.paused) { wanted.current = true; void element.play().catch(() => { wanted.current = false }) }
    else { wanted.current = false; element.pause() }
  }
  const step = (delta: number) => { if (queue.length) { const index = current ? queue.indexOf(current) : -1; setCurrent(queue[(index + delta + queue.length) % queue.length]) } }
  useEffect(() => {
    const record = useWindows.getState().windows[windowId]
    if (!record || record.launchContext.kind === 'audio' && record.launchContext.selected === current && record.launchContext.play === wanted.current) return
    useWindows.getState().setContext(windowId, { kind: 'audio', selected: current, ids: queue, play: wanted.current })
  }, [current, playing, windowId])
  useEffect(() => { if (current && !queue.includes(current)) setCurrent(queue[0] ?? null) }, [JSON.stringify(queue)])
  const cover = payload ? albums[payload.key] : undefined
  const title = node ? displayName(node) : 'Windows Media Player'
  const artist = payload ? audioMetadata[payload.key]?.artist ?? '' : ''
  const entries: MenuEntry[] = [{ label: 'Show list', checked: showList, action: () => setShowList(!showList) }, ...['Full screen', 'Visualizations', 'Enhancements', 'Lyrics, captions, and subtitles', 'Help'].map(label => ({ label })), { label: 'Exit', action: () => useWindows.getState().close(windowId) }]
  return <div className="media-app" tabIndex={0} data-app-focus onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, entries }) }} onKeyDown={event => {
    if (event.key === 'Alt') { event.preventDefault(); setMenuBar(!menuBar) }
    if (event.code === 'Space' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); toggle() }
  }}><audio ref={audio} src={source} preload="metadata" onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { wanted.current = true; step(1) }} />{menuBar && <div className="media-menubar">{['File', 'View', 'Play', 'Tools', 'Help'].map(label => <button className="shell-button" key={label} disabled={label === 'Tools' || label === 'Help'} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ x: rect.left, y: rect.bottom, entries: label === 'File' ? [entries.at(-1)!] : label === 'View' ? [entries[0]] : [{ label: playing ? 'Pause' : 'Play', action: toggle }, { label: 'Previous', action: () => step(-1) }, { label: 'Next', action: () => step(1) }] }) }}>{label}</button>)}</div>}<div className="media-stage"><div className="media-art"><img src={!failedCover && cover ? media[cover] : icons.audioFile} alt="Album cover" onError={() => setFailedCover(true)} /><div>{title}</div><div>{artist}</div></div>{showList && <ol className="media-list" aria-label="Play queue">{queue.map(id => <li key={id}><button className="shell-button" aria-current={id === current} onClick={() => { wanted.current = playing; setCurrent(id) }}>{displayName(files.nodes[id])}</button></li>)}</ol>}</div><div className="media-controls"><input className="media-seek" aria-label="Seek" type="range" min={0} max={duration || 1} step={.1} value={Math.min(elapsed, duration || 1)} disabled={!duration} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setElapsed(Number(event.target.value)) } }} /><div className="media-control-row"><span className="media-time">{time(elapsed)}</span><button className="media-small" aria-label="Previous" onClick={() => step(-1)}>◀</button><button className="media-play" aria-label={playing ? 'Pause' : 'Play'} disabled={!source} onClick={toggle}>{playing ? 'Ⅱ' : '▶'}</button><button className="media-small" aria-label="Next" onClick={() => step(1)}>▶</button><button className="media-mute" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? '×' : '♪'}</button><input aria-label="Volume" type="range" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} /></div></div>{menu && <ContextMenu {...menu} close={() => setMenu(null)} />}</div>
}

import { sounds, type SoundName } from '@/assets'

let context: AudioContext | undefined
const buffers = new Map<SoundName, AudioBuffer>()
const pending = new Map<SoundName, Promise<AudioBuffer | undefined>>()

function load(name: SoundName): Promise<AudioBuffer | undefined> {
  const cached = buffers.get(name)
  if (cached) return Promise.resolve(cached)
  const existing = pending.get(name)
  if (existing) return existing
  const audio = context
  if (!audio) return Promise.resolve(undefined)
  const request = fetch(sounds[name])
    .then(response => response.ok ? response.arrayBuffer() : undefined)
    .then(data => data ? audio.decodeAudioData(data) : undefined)
    .then(buffer => {
      if (buffer) buffers.set(name, buffer)
      return buffer
    })
    .catch(() => undefined)
  pending.set(name, request)
  return request
}

export function unlockAudio() {
  try {
    context ??= new AudioContext()
    void context.resume().catch(() => undefined)
    for (const name of ['startup', 'shutdown', 'logoff'] satisfies SoundName[]) void load(name)
  } catch {
    return
  }
}

export async function play(name: SoundName, expiresAt = performance.now() + 1500) {
  try {
    const buffer = await load(name)
    if (!context || context.state !== 'running' || !buffer || performance.now() >= expiresAt) return
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.onended = () => source.disconnect()
    source.start()
  } catch {
    return
  }
}

export default function BootScreen({ elapsed }: { elapsed: number }) {
  const tick = Math.floor(elapsed / (1000 / 15))
  const frame = tick < 60 ? tick : 60 + (tick - 60) % 45
  return (
    <div className="boot-screen" role="status" aria-label="Starting Windows">
      <div className="boot-sprite" style={{ backgroundPosition: `${-200 * (frame % 7)}px ${-200 * Math.floor(frame / 7)}px` }} />
      <div className="boot-title">Starting Windows</div>
      <div className="boot-copyright">© Microsoft Corporation</div>
    </div>
  )
}

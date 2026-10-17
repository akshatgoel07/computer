import { images } from '@/assets'

export function Spinner() {
  return <span className="spinner" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => (
    <span key={index} style={{ transform: `rotate(${index * 30}deg) translateY(-8px)`, opacity: (index + 1) / 12 }} />
  ))}</span>
}

export default function WelcomeScreen({ text = 'Welcome', reveal = false, locked = false, onUnlock }: {
  text?: string
  reveal?: boolean
  locked?: boolean
  onUnlock?: () => void
}) {
  return (
    <div className={`welcome-screen${reveal ? ' reveal' : ''}`} role="status">
      {locked ? <button className="unlock-tile" onClick={onUnlock} autoFocus>
        <img src={images.userTile} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
        <span>Akshat</span>
      </button> : <div className="welcome-status"><Spinner /><span>{text}</span></div>}
    </div>
  )
}

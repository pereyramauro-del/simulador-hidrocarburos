interface Props {
  label: string
  text: string
  go?: string
  wait?: string
  /** no hay nada que tocar: se está esperando */
  waiting: boolean
  /** cambia con cada paso; vuelve a animar el globo */
  stepKey: string
}

const A = 60 // tamaño del capitán

/**
 * El capitán habla desde su propio lugar arriba del mímico, sin tapar nada.
 * Lo que hay que tocar lo marca el pulso azul en el control.
 */
export function Captain({ label, text, go, wait, waiting, stepKey }: Props) {
  return (
    <div className={`captain-dock ${waiting ? 'is-waiting' : ''}`}>
      <div className="captain-face" key={stepKey} aria-hidden="true">
        <CaptainFace />
      </div>
      <div className="captain-bubble" key={`b${stepKey}`} role="status" aria-live="polite">
        <span className="captain-step">{label}</span>
        <span className="captain-text">{text}</span>
        {go && <span className="captain-go">{go}</span>}
        {wait && <span className="captain-wait">{wait}</span>}
      </div>
    </div>
  )
}

/** Ilustración propia: capitán con gorra blanca, visera negra, ancla dorada y barba canosa. */
function CaptainFace() {
  return (
    <svg viewBox="0 0 64 64" width={A} height={A} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#dfe6ee" />
      {/* hombros con charreteras */}
      <path d="M8 58c3-10 12-14 24-14s21 4 24 14a31 31 0 0 1-48 0z" fill="#1d2b45" />
      <path d="M26 44l6 8 6-8" fill="#fff" />
      <rect x="12" y="50" width="9" height="3" rx="1" fill="#d9a300" />
      <rect x="43" y="50" width="9" height="3" rx="1" fill="#d9a300" />
      {/* cara */}
      <ellipse cx="32" cy="32" rx="12.5" ry="13.5" fill="#e9b98f" />
      {/* barba */}
      <path d="M19.6 31c0 9 5.6 15.5 12.4 15.5S44.4 40 44.4 31c-2 4-5 5.5-6.6 5.5-1.6-1.6-3.6-2.3-5.8-2.3s-4.2.7-5.8 2.3c-1.6 0-4.6-1.5-6.6-5.5z" fill="#eef0f1" />
      <path d="M27.5 37.5c1.4-1 2.9-1.4 4.5-1.4s3.1.4 4.5 1.4" fill="none" stroke="#c9cdd0" strokeWidth="1.4" strokeLinecap="round" />
      {/* ojos y cejas */}
      <circle cx="27" cy="29" r="1.5" fill="#1d2327" />
      <circle cx="37" cy="29" r="1.5" fill="#1d2327" />
      <path d="M24.5 25.6c1.6-.9 3.4-1 5-.3M34.5 25.3c1.6-.7 3.4-.6 5 .3" fill="none" stroke="#eef0f1" strokeWidth="1.8" strokeLinecap="round" />
      {/* gorra */}
      <path d="M17 19.5c0-6 6.7-9.5 15-9.5s15 3.5 15 9.5v2.5H17z" fill="#fff" stroke="#c3c8cc" strokeWidth="1" />
      <rect x="17" y="19.5" width="30" height="3.4" fill="#1d2b45" />
      <path d="M18.5 22.9h27c-1 2.6-6.6 3.8-13.5 3.8s-12.5-1.2-13.5-3.8z" fill="#1d2327" />
      {/* ancla */}
      <g stroke="#d9a300" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <circle cx="32" cy="12.6" r="1.1" />
        <path d="M32 13.7v4.6M30.2 15h3.6M29.4 16.6c.6 1.3 1.5 1.9 2.6 1.9s2-.6 2.6-1.9" />
      </g>
    </svg>
  )
}

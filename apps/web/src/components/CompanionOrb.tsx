/**
 * The companion's visual presence — a living, breathing gradient orb. It's the one
 * element that makes KIPR feel like a companion rather than a form. State changes its
 * motion: calm when idle, quicker + brighter when thinking/saving.
 */
export type OrbState = 'idle' | 'thinking' | 'speaking'

export function CompanionOrb({ size = 132, state = 'idle' }: { size?: number; state?: OrbState }) {
  return (
    <div className={`orb orb-${state}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="orb-glow" />
      <span className="orb-core" />
      <span className="orb-sheen" />
    </div>
  )
}

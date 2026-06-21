export type Status = 'idle' | 'busy' | 'ok' | 'error'

export function Dot({ status }: { status: Status }) {
  const label =
    status === 'ok' ? 'ok' : status === 'error' ? 'error' : status === 'busy' ? 'working' : 'idle'
  return <span className={`statusdot ${status}`} aria-label={label} title={label} />
}

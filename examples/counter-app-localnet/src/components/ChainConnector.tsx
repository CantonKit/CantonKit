interface ChainConnectorProps {
  variant?: 'default' | 'brand'
}

export function ChainConnector({ variant = 'default' }: ChainConnectorProps) {
  const cls =
    variant === 'brand'
      ? 'bg-gradient-to-r from-indigo-400/60 to-violet-400/60'
      : 'bg-default-300/40'
  return (
    <span
      aria-hidden="true"
      className={`mx-1 inline-block h-px w-4 shrink-0 self-center ${cls}`}
    />
  )
}

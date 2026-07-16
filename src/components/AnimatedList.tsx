import { useRef, useState, useCallback, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** Hauteur max du conteneur défilant (classe Tailwind), ex: "max-h-[60vh]" */
  maxHeightClass?: string
  /** Couleur de fond utilisée pour le dégradé haut/bas (doit matcher le fond du conteneur) */
  fadeColor?: string
}

/**
 * Conteneur défilant inspiré de l'AnimatedList de reactbits.dev.
 * Seul ce bloc défile (pas la page ni le bandeau latéral) : les éléments
 * enfants animent leur apparition via le hook `useAnimatedListItem`, et de
 * légers dégradés en haut/bas indiquent qu'il reste du contenu à faire défiler.
 */
export default function AnimatedList({ children, className = '', maxHeightClass = 'max-h-[60vh]', fadeColor = 'var(--color-bg)' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtTop(el.scrollTop <= 4)
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
  }, [])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`${maxHeightClass} overflow-y-auto pr-0.5 ${className}`}
      >
        {children}
      </div>
      <div
        className="pointer-events-none absolute top-0 left-0 right-1 h-6 transition-opacity duration-200"
        style={{ opacity: atTop ? 0 : 1, background: `linear-gradient(to bottom, ${fadeColor}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-1 h-6 transition-opacity duration-200"
        style={{ opacity: atBottom ? 0 : 1, background: `linear-gradient(to top, ${fadeColor}, transparent)` }}
      />
    </div>
  )
}

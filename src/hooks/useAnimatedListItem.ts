import { useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * Hook inspiré de l'AnimatedList de reactbits.dev.
 * Anime l'apparition d'un élément (ligne de tableau, carte…) en fondu + léger
 * décalage vertical dès qu'il entre dans le viewport du conteneur scrollable.
 * L'animation est décalée (stagger) en fonction de l'index pour un effet de liste.
 */
export function useAnimatedListItem<T extends HTMLElement = HTMLElement>(
  index: number,
  staggerMs = 40,
) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const delay = Math.min(index * staggerMs, 420)

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    willChange: 'opacity, transform',
  }

  return { ref, style }
}

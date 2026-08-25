import { useRef, useState, useEffect, useMemo } from 'react'

export type PointGraphe = {
  label: string
  valeur: number
  // Point projeté : le segment qui y mène est tracé en pointillés.
  projete?: boolean
}

const MARGE = { haut: 26, bas: 24, gauche: 12, droite: 12 }

/**
 * Courbe simple en SVG. Largeur mesurée sur le conteneur pour que le trait et
 * les libellés gardent leur taille réelle quelle que soit la place disponible.
 */
export default function GraphiqueLigne({
  points,
  hauteur = 220,
  formatValeur,
  couleur = '#074750',
  couleurProjection = '#F97316',
}: {
  points: PointGraphe[]
  hauteur?: number
  formatValeur: (v: number) => string
  couleur?: string
  couleurProjection?: string
}) {
  const conteneurRef = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(640)

  useEffect(() => {
    const el = conteneurRef.current
    if (!el) return
    const observer = new ResizeObserver(([entree]) => {
      setLargeur(entree.contentRect.width)
    })
    observer.observe(el)
    setLargeur(el.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  const geometrie = useMemo(() => {
    if (points.length === 0) return null

    const valeurs = points.map((p) => p.valeur)
    // On inclut toujours zéro pour que l'échelle reste honnête.
    const min = Math.min(...valeurs, 0)
    const max = Math.max(...valeurs, 0)
    const amplitude = max - min || 1

    const zoneLargeur = Math.max(largeur - MARGE.gauche - MARGE.droite, 1)
    const zoneHauteur = hauteur - MARGE.haut - MARGE.bas

    const x = (i: number) =>
      MARGE.gauche + (points.length === 1 ? zoneLargeur / 2 : (i / (points.length - 1)) * zoneLargeur)
    const y = (v: number) => MARGE.haut + zoneHauteur - ((v - min) / amplitude) * zoneHauteur

    return {
      coords: points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.valeur) })),
      yZero: y(0),
      afficherZero: min < 0,
    }
  }, [points, largeur, hauteur])

  return (
    <div ref={conteneurRef} className="w-full">
      {geometrie && (
        <svg width={largeur} height={hauteur} className="overflow-visible">
          {/* Ligne de zéro, seulement si la courbe passe en négatif */}
          {geometrie.afficherZero && (
            <line
              x1={MARGE.gauche} y1={geometrie.yZero}
              x2={largeur - MARGE.droite} y2={geometrie.yZero}
              stroke="#E53535" strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
            />
          )}

          {/* Segments : plein entre points réels, pointillés dès qu'un point est projeté */}
          {geometrie.coords.slice(1).map((p, i) => {
            const precedent = geometrie.coords[i]
            const enProjection = !!p.projete
            return (
              <line
                key={i}
                x1={precedent.cx} y1={precedent.cy}
                x2={p.cx} y2={p.cy}
                stroke={enProjection ? couleurProjection : couleur}
                strokeWidth={2}
                strokeDasharray={enProjection ? '5 4' : undefined}
                strokeLinecap="round"
              />
            )
          })}

          {/* Points et valeurs */}
          {geometrie.coords.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.cx} cy={p.cy} r={3.5}
                fill={p.projete ? '#FFFFFF' : couleur}
                stroke={p.projete ? couleurProjection : couleur}
                strokeWidth={2}
              />
              <text
                x={p.cx} y={p.cy - 10}
                textAnchor="middle"
                className="text-[10px] font-bold tabular-nums"
                fill={p.projete ? couleurProjection : p.valeur < 0 ? '#E53535' : '#0B3B41'}
              >
                {formatValeur(p.valeur)}
              </text>
              <text
                x={p.cx} y={hauteur - 6}
                textAnchor="middle"
                className="text-[10px] capitalize"
                fill={p.projete ? couleurProjection : '#6B8A8F'}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

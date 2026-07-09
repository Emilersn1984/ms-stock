import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDown, Search, Plus, Pencil } from 'lucide-react'
import PhotoLightbox from '../components/PhotoLightbox'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { useSousEnsemblesStock } from '../hooks/useSousEnsemblesStock'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { getCouleurSeuil, COULEUR_LABEL } from '../utils/couleurSeuil'
import ModalModifierQuantite from '../components/ModalModifierQuantite'
import ModalAjouterPiece from '../components/ModalAjouterPiece'
import ModalModifierSE from '../components/ModalModifierSE'
import { Piece, SousEnsemble, CouleurSeuil } from '../types'

const ACCENT_HEX: Record<CouleurSeuil, string> = {
  rouge: '#E53535', jaune: '#F9BC1A', vert: '#22B84F',
}
const QTY_CLASS: Record<CouleurSeuil, string> = {
  rouge: 'text-danger-600', jaune: 'text-warning-600', vert: 'text-primary-900',
}
const STATUS_CLASS: Record<CouleurSeuil, string> = {
  rouge: 'text-danger-600', jaune: 'text-warning-600', vert: 'text-success-600',
}

function SectionLabel({ texte, count, accent }: { texte: string; count?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${accent ?? 'text-primary-700'}`}>{texte}</span>
      <div className="flex-1 h-px bg-primary-100" />
      {count !== undefined && <span className="text-xs font-semibold text-primary-600 tabular-nums">{count}</span>}
    </div>
  )
}

function KpiStrip({ rouge, jaune, vert }: { rouge: number; jaune: number; vert: number }) {
  const metrics = [
    { val: rouge, label: 'Critique', accent: rouge > 0 ? 'text-danger-400'  : 'text-success-300' },
    { val: jaune, label: 'Faible',   accent: jaune > 0 ? 'text-warning-400' : 'text-success-300' },
    { val: vert,  label: 'OK',       accent: 'text-success-300' },
  ]
  return (
    <div className="grid grid-cols-3 bg-primary-900 rounded-2xl overflow-hidden mb-6">
      {metrics.map((m, i) => (
        <div key={i} className="px-6 py-5 flex flex-col gap-1.5">
          <span className={`text-5xl font-bold leading-none tracking-tight tabular-nums ${m.accent}`}>{m.val}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">{m.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function Stock() {
  const { pieces, chargement, erreur } = useStock()
  const { sousEnsembles: sousEnsemblesEnStock } = useSousEnsemblesStock()
  const utilisateur = getUtilisateurStored()

  const [recherche, setRecherche] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null)
  const [sousSystemeFiltre, setSousSystemeFiltre] = useState<string | null>(null)
  const [filtreNonAttribuees, setFiltreNonAttribuees] = useState(false)
  const [dropdownSSOuvert, setDropdownSSOuvert] = useState(false)
  const [sousEnsemblesListe, setSousEnsemblesListe] = useState<{ id: string; nom: string }[]>([])
  const [pieceVersSeIds, setPieceVersSeIds] = useState<Record<string, string[]>>({})
  const dropdownSSRef = useRef<HTMLDivElement>(null)
  const [pieceAModifier, setPieceAModifier] = useState<Piece | null>(null)
  const [seAModifier, setSeAModifier] = useState<SousEnsemble | null>(null)
  const [showAjouter, setShowAjouter] = useState(false)
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null)

  useEffect(() => {
    async function charger() {
      const [{ data: seData }, { data: nomData }] = await Promise.all([
        supabase.from('sous_ensembles').select('id, nom').order('nom'),
        supabase.from('nomenclature').select('piece_id, sous_ensemble_id').not('piece_id', 'is', null),
      ])
      setSousEnsemblesListe((seData ?? []) as { id: string; nom: string }[])
      const map: Record<string, string[]> = {}
      for (const row of (nomData ?? []) as { piece_id: string; sous_ensemble_id: string }[]) {
        if (!map[row.piece_id]) map[row.piece_id] = []
        map[row.piece_id].push(row.sous_ensemble_id)
      }
      setPieceVersSeIds(map)
    }
    charger()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownSSRef.current && !dropdownSSRef.current.contains(e.target as Node)) {
        setDropdownSSOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    pieces.forEach((p) => { if (p.categorie) cats.add(p.categorie) })
    return Array.from(cats).sort()
  }, [pieces])

  const piecesFiltrees = useMemo(() => {
    return pieces.filter((p) => {
      const matchNom = p.nom.toLowerCase().includes(recherche.toLowerCase())
      const matchCat = !categorieFiltre || p.categorie === categorieFiltre
      const matchSE = !sousSystemeFiltre || (pieceVersSeIds[p.id] ?? []).includes(sousSystemeFiltre)
      const matchNonAttr = !filtreNonAttribuees || !(pieceVersSeIds[p.id]?.length)
      return matchNom && matchCat && matchSE && matchNonAttr
    })
  }, [pieces, recherche, categorieFiltre, sousSystemeFiltre, filtreNonAttribuees, pieceVersSeIds])

  const stats = useMemo(() => {
    return pieces.reduce(
      (acc, p) => { acc[getCouleurSeuil(p)]++; return acc },
      { rouge: 0, jaune: 0, vert: 0 }
    )
  }, [pieces])

  if (chargement) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-primary-400 text-sm">Chargement du stock…</p>
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="p-5 md:p-8">
        <p className="text-danger-600 bg-danger-50 rounded-xl p-4 text-sm">Erreur : {erreur}</p>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Stock</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            {pieces.length} pièce{pieces.length !== 1 ? 's' : ''} référencée{pieces.length !== 1 ? 's' : ''}
          </p>
        </div>
        {utilisateur?.role === 'patron' && (
          <button
            onClick={() => setShowAjouter(true)}
            className="flex items-center gap-2 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Ajouter une pièce</span>
          </button>
        )}
      </div>

      {/* KPI strip */}
      {pieces.length > 0 && (
        <KpiStrip rouge={stats.rouge} jaune={stats.jaune} vert={stats.vert} />
      )}

      {/* Sous-ensembles fabriqués */}
      {sousEnsemblesEnStock.length > 0 && (
        <div className="mb-8">
          <SectionLabel
            texte="Sous-ensembles fabriqués"
            count={`${sousEnsemblesEnStock.length} assemblé${sousEnsemblesEnStock.length !== 1 ? 's' : ''}`}
          />

          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-primary-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-primary-50 border-b border-primary-100">
                <tr>
                  <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Sous-ensemble</th>
                  <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Quantité</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-50">
                {sousEnsemblesEnStock.map((se) => (
                  <tr key={se.id} className="hover:bg-primary-50 transition-colors">
                    <td className="border-l-4 px-4 py-3.5" style={{ borderLeftColor: '#22B84F' }}>
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="font-medium text-primary-900">{se.nom}</p>
                          {se.description && <p className="text-xs text-primary-500 mt-0.5 truncate max-w-xs">{se.description}</p>}
                        </div>
                        {se.photo_url && (
                          <img src={se.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPhotoLightbox(se.photo_url!)} />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xl font-bold tabular-nums text-success-600">{se.quantite}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {utilisateur && (
                        <button
                          onClick={() => setSeAModifier(se)}
                          className="text-sm text-primary-500 hover:text-primary-800 font-medium transition-colors"
                        >
                          Corriger
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-1.5">
            {sousEnsemblesEnStock.map((se) => (
              <div key={se.id} className="flex rounded-xl overflow-hidden border border-primary-100">
                <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#22B84F' }} />
                <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-white min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-900 truncate">{se.nom}</p>
                    {se.description && <p className="text-xs text-primary-500 mt-0.5 truncate">{se.description}</p>}
                  </div>
                  {se.photo_url && (
                    <img src={se.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPhotoLightbox(se.photo_url!)} />
                  )}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xl font-bold tabular-nums text-success-600 leading-tight">{se.quantite}</p>
                    <p className="text-[10px] uppercase tracking-wide font-bold text-success-600">assemblé{se.quantite !== 1 ? 's' : ''}</p>
                  </div>
                  {utilisateur && (
                    <button
                      onClick={() => setSeAModifier(se)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-primary-400 hover:text-primary-700 hover:bg-primary-50 transition-colors ml-1"
                      title="Corriger le stock"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pièces */}
      <SectionLabel
        texte="Pièces"
        count={
          piecesFiltrees.length === pieces.length
            ? `${pieces.length} référencée${pieces.length !== 1 ? 's' : ''}`
            : `${piecesFiltrees.length} / ${pieces.length} référencée${pieces.length !== 1 ? 's' : ''}`
        }
      />

      {/* Recherche */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une pièce…"
          className="w-full pl-9 pr-9 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
        />
        {recherche && (
          <button
            onClick={() => setRecherche('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-700 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          <button
            onClick={() => setCategorieFiltre(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              !categorieFiltre
                ? 'bg-primary-900 text-white border-primary-900'
                : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
            }`}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategorieFiltre(categorieFiltre === cat ? null : cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                categorieFiltre === cat
                  ? 'bg-primary-900 text-white border-primary-900'
                  : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Filtres sous-système */}
      <div className="flex gap-2 flex-wrap mb-6">
        <div className="relative" ref={dropdownSSRef}>
          <button
            onClick={() => setDropdownSSOuvert((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              sousSystemeFiltre
                ? 'bg-primary-900 text-white border-primary-900'
                : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
            }`}
          >
            <span>Sous-système</span>
            {sousSystemeFiltre && (
              <span className="max-w-[120px] truncate">
                : {sousEnsemblesListe.find((s) => s.id === sousSystemeFiltre)?.nom}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
          {dropdownSSOuvert && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-primary-100 rounded-xl shadow-lg min-w-[200px] max-h-64 overflow-y-auto">
              <button
                onClick={() => { setSousSystemeFiltre(null); setDropdownSSOuvert(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm rounded-t-xl transition-colors ${
                  !sousSystemeFiltre ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-primary-700 hover:bg-primary-50'
                }`}
              >
                Tous les sous-systèmes
              </button>
              {sousEnsemblesListe.length === 0 ? (
                <p className="px-4 py-3 text-sm text-primary-400">Aucun sous-système défini</p>
              ) : (
                sousEnsemblesListe.map((se) => (
                  <button
                    key={se.id}
                    onClick={() => { setSousSystemeFiltre(se.id); setFiltreNonAttribuees(false); setDropdownSSOuvert(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      sousSystemeFiltre === se.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-primary-700 hover:bg-primary-50'
                    }`}
                  >
                    {se.nom}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => { setFiltreNonAttribuees((v) => !v); setSousSystemeFiltre(null) }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
            filtreNonAttribuees
              ? 'bg-warning-500 text-white border-warning-500'
              : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
          }`}
        >
          Pièces non attribuées
        </button>
      </div>

      {/* État vide */}
      {piecesFiltrees.length === 0 && (
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          {recherche || categorieFiltre || sousSystemeFiltre || filtreNonAttribuees
            ? 'Aucune pièce trouvée pour ces filtres'
            : 'Aucune pièce dans le stock — commencez par en ajouter une'}
        </p>
      )}

      {/* Tableau desktop */}
      {piecesFiltrees.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-primary-100 overflow-hidden mb-2">
            <table className="w-full">
              <thead className="bg-primary-50 border-b border-primary-100">
                <tr>
                  <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Pièce</th>
                  <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Catégorie</th>
                  <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Quantité</th>
                  <th className="text-center text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Délai appro</th>
                  <th className="text-center text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Statut</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-50">
                {piecesFiltrees.map((piece) => {
                  const couleur = getCouleurSeuil(piece)
                  return (
                    <tr key={piece.id} className="hover:bg-primary-50 transition-colors">
                      <td
                        className="border-l-4 px-4 py-3.5"
                        style={{ borderLeftColor: ACCENT_HEX[couleur] }}
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="min-w-0">
                            <span className="font-medium text-primary-900">{piece.nom}</span>
                            {piece.description && (
                              <p className="text-xs text-primary-400 mt-0.5 truncate max-w-xs">{piece.description}</p>
                            )}
                          </div>
                          {piece.photo_url && (
                            <img src={piece.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPhotoLightbox(piece.photo_url!)} />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {piece.categorie
                          ? <span className="text-xs text-primary-500">{piece.categorie}</span>
                          : <span className="text-primary-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-xl font-bold tabular-nums ${QTY_CLASS[couleur]}`}>{piece.quantite}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {piece.delai_appro != null ? (
                          <span className="text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-2.5 py-1 whitespace-nowrap">
                            {piece.delai_appro} sem.
                          </span>
                        ) : (
                          <span className="text-primary-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-bold uppercase tracking-wide ${STATUS_CLASS[couleur]}`}>{COULEUR_LABEL[couleur]}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {utilisateur && (
                          <button
                            onClick={() => setPieceAModifier(piece)}
                            className="text-sm text-primary-500 hover:text-primary-800 font-medium transition-colors"
                          >
                            Modifier
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cartes mobile */}
          <div className="md:hidden space-y-1.5">
            {piecesFiltrees.map((piece) => {
              const couleur = getCouleurSeuil(piece)
              return (
                <div key={piece.id} className="flex rounded-xl overflow-hidden border border-primary-100">
                  <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: ACCENT_HEX[couleur] }} />
                  <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-white min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{piece.nom}</p>
                      {piece.description && <p className="text-xs text-primary-400 mt-0.5 truncate">{piece.description}</p>}
                      {piece.categorie && <p className="text-xs text-primary-500 mt-0.5">{piece.categorie}</p>}
                    </div>
                    {piece.photo_url && (
                      <img src={piece.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPhotoLightbox(piece.photo_url!)} />
                    )}
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <p className={`text-xl font-bold tabular-nums leading-tight ${QTY_CLASS[couleur]}`}>{piece.quantite}</p>
                        {piece.delai_appro != null && (
                          <span className="text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                            {piece.delai_appro} sem.
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] uppercase tracking-wide font-bold ${STATUS_CLASS[couleur]}`}>{COULEUR_LABEL[couleur]}</p>
                    </div>
                    {utilisateur && (
                      <button
                        onClick={() => setPieceAModifier(piece)}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-primary-400 hover:text-primary-700 hover:bg-primary-50 transition-colors ml-1"
                        title="Modifier la quantité"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}


      {/* Modals */}
      {pieceAModifier && utilisateur && (
        <ModalModifierQuantite
          piece={pieceAModifier}
          utilisateur={utilisateur}
          categoriesExistantes={categories}
          onClose={() => setPieceAModifier(null)}
          onSuccess={() => {}}
        />
      )}

      {seAModifier && utilisateur && (
        <ModalModifierSE
          se={seAModifier}
          utilisateur={utilisateur}
          onClose={() => setSeAModifier(null)}
        />
      )}

      {photoLightbox && <PhotoLightbox url={photoLightbox} onClose={() => setPhotoLightbox(null)} />}

      {showAjouter && utilisateur && (
        <ModalAjouterPiece
          utilisateur={utilisateur}
          categoriesExistantes={categories}
          onClose={() => setShowAjouter(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}

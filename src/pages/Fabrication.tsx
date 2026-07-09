import { useState, useEffect, useRef } from 'react'
import { Search, Check, X, Factory, Wrench, Boxes, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { creerOperation } from '../utils/creerOperation'
import { calcConsommation, LigneConsommation, LigneConsommationSE } from '../utils/calcConsommation'
import { SousEnsemble, Piece } from '../types'

export default function Fabrication() {
  const { pieces } = useStock()
  const utilisateur = getUtilisateurStored()

  const [sousEnsembles, setSousEnsembles] = useState<SousEnsemble[]>([])
  const [chargementSE, setChargementSE] = useState(true)
  const [selectionne, setSelectionne] = useState<SousEnsemble | null>(null)
  const [rechercheSE, setRechercheSE] = useState('')
  const [dropdownOuvert, setDropdownOuvert] = useState(false)
  const [quantite, setQuantite] = useState('')
  const [lignes, setLignes] = useState<LigneConsommation[]>([])
  const [lignesSE, setLignesSE] = useState<LigneConsommationSE[]>([])
  const [calcule, setCalcule] = useState(false)
  const [chargementCalc, setChargementCalc] = useState(false)
  const [popupConfirm, setPopupConfirm] = useState(false)
  const [fabricationEnCours, setFabricationEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ se: string; qte: number } | null>(null)
  const [popupCorrection, setPopupCorrection] = useState(false)
  const [correctionValues, setCorrectionValues] = useState<Record<string, string>>({})
  const [corrigingStock, setCorrigingStock] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('sous_ensembles').select('*').order('nom').then(({ data }) => {
      setSousEnsembles((data as SousEnsemble[]) ?? [])
      setChargementSE(false)
    })
  }, [])

  useEffect(() => {
    if (!confirmation) return
    const t = setTimeout(() => setConfirmation(null), 6000)
    return () => clearTimeout(t)
  }, [confirmation])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const seFiltres = rechercheSE.trim()
    ? sousEnsembles.filter((s) => s.nom.toLowerCase().includes(rechercheSE.toLowerCase()))
    : sousEnsembles

  function selectionnerSE(se: SousEnsemble) {
    setSelectionne(se)
    setRechercheSE(se.nom)
    setDropdownOuvert(false)
    setLignes([])
    setLignesSE([])
    setCalcule(false)
    setErreur(null)
  }

  async function calculer() {
    if (!selectionne) return
    const qte = parseInt(quantite, 10)
    if (isNaN(qte) || qte <= 0) { setErreur('Quantité invalide — doit être un entier positif'); return }
    setChargementCalc(true)
    setErreur(null)
    try {
      const result = await calcConsommation(selectionne.id, qte, pieces, sousEnsembles)
      if (result.pieces.length === 0 && result.sousEnsembles.length === 0) {
        setErreur('Ce sous-ensemble n\'a aucun composant. Configurez sa nomenclature d\'abord.')
        setCalcule(false)
      } else {
        setLignes(result.pieces)
        setLignesSE(result.sousEnsembles)
        setCalcule(true)
      }
    } catch {
      setErreur('Erreur lors du calcul de la consommation')
    } finally {
      setChargementCalc(false)
    }
  }

  async function appliquerCorrections() {
    if (!utilisateur || !selectionne) return
    const invalide = lignesInsuffisantes.some((l) => {
      const v = parseInt(correctionValues[l.piece_id] ?? '', 10)
      return isNaN(v) || v < l.quantite_necessaire
    })
    if (invalide) return
    setCorrigingStock(true)
    setErreur(null)
    try {
      for (const ligne of lignesInsuffisantes) {
        const nouvelleQte = parseInt(correctionValues[ligne.piece_id], 10)
        const { error } = await supabase
          .from('pieces')
          .update({ quantite: nouvelleQte })
          .eq('id', ligne.piece_id)
        if (error) throw error
        await creerOperation({
          type: 'correction',
          piece_id: ligne.piece_id,
          quantite_avant: ligne.quantite_stock,
          quantite_apres: nouvelleQte,
          delta: nouvelleQte - ligne.quantite_stock,
          utilisateur_id: utilisateur.id,
          commentaire: 'Correction avant fabrication',
        })
      }
      const { data: freshPieces } = await supabase
        .from('pieces')
        .select('*')
        .eq('archivee', false)
      const qte = parseInt(quantite, 10)
      const result = await calcConsommation(selectionne.id, qte, (freshPieces as Piece[]) ?? [], sousEnsembles)
      setLignes(result.pieces)
      setLignesSE(result.sousEnsembles)
      setPopupCorrection(false)
      const stillNegative = result.pieces.some((l) => l.quantite_stock - l.quantite_necessaire < 0)
      if (!stillNegative) {
        setPopupConfirm(true)
      } else {
        const init: Record<string, string> = {}
        result.pieces.filter((l) => l.quantite_stock - l.quantite_necessaire < 0).forEach((l) => {
          init[l.piece_id] = String(l.quantite_necessaire)
        })
        setCorrectionValues(init)
        setPopupCorrection(true)
      }
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de la correction des stocks')
    } finally {
      setCorrigingStock(false)
    }
  }

  async function confirmerFabrication() {
    if (!selectionne || !utilisateur || (lignes.length === 0 && lignesSE.length === 0)) return
    const qte = parseInt(quantite, 10)
    setFabricationEnCours(true)
    setErreur(null)
    try {
      for (const ligne of lignes) {
        const nouvelleQte = ligne.quantite_stock - ligne.quantite_necessaire
        const { error } = await supabase
          .from('pieces')
          .update({ quantite: nouvelleQte })
          .eq('id', ligne.piece_id)
        if (error) throw error
        await creerOperation({
          type: 'fabrication',
          piece_id: ligne.piece_id,
          sous_ensemble_id: selectionne.id,
          quantite_avant: ligne.quantite_stock,
          quantite_apres: nouvelleQte,
          delta: -ligne.quantite_necessaire,
          utilisateur_id: utilisateur.id,
        })
      }
      for (const ligneSE of lignesSE) {
        const nouvelleQteSE = ligneSE.quantite_stock - ligneSE.quantite_necessaire
        const { error } = await supabase
          .from('sous_ensembles')
          .update({ quantite: nouvelleQteSE })
          .eq('id', ligneSE.sous_ensemble_id)
        if (error) throw error
        await creerOperation({
          type: 'fabrication',
          sous_ensemble_id: ligneSE.sous_ensemble_id,
          quantite_avant: ligneSE.quantite_stock,
          quantite_apres: nouvelleQteSE,
          delta: -ligneSE.quantite_necessaire,
          utilisateur_id: utilisateur.id,
          commentaire: `Consommé en stock pour la fabrication de ${selectionne.nom}`,
        })
      }
      const { data: seActuel } = await supabase
        .from('sous_ensembles')
        .select('quantite')
        .eq('id', selectionne.id)
        .single()
      const qteSEActuelle = (seActuel as { quantite: number } | null)?.quantite ?? 0
      await supabase
        .from('sous_ensembles')
        .update({ quantite: qteSEActuelle + qte })
        .eq('id', selectionne.id)

      const { error: erreurProduction } = await supabase.from('productions').insert({
        sous_ensemble_id: selectionne.id,
        quantite: qte,
        utilisateur_id: utilisateur.id,
      })
      if (erreurProduction) throw erreurProduction

      setConfirmation({ se: selectionne.nom, qte })
      setLignes([])
      setLignesSE([])
      setCalcule(false)
      setQuantite('')
      setSelectionne(null)
      setRechercheSE('')
      setPopupConfirm(false)
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de la fabrication')
    } finally {
      setFabricationEnCours(false)
    }
  }

  const hasStockNegatif = lignes.some((l) => l.quantite_stock - l.quantite_necessaire < 0)
  const hasComposants = lignes.length > 0 || lignesSE.length > 0
  const lignesInsuffisantes = lignes.filter((l) => l.quantite_stock - l.quantite_necessaire < 0)

  if (!utilisateur) {
    return (
      <div className="p-5 md:p-8">
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Connectez-vous pour déclarer une fabrication.
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Fabrication</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            Déclarer une fabrication et déduire les pièces du stock
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
          <Factory size={17} className="text-primary-700" />
        </div>
      </div>

      {/* Bannière de confirmation */}
      {confirmation && (
        <div className="mb-6 flex rounded-xl overflow-hidden border border-primary-100">
          <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#22B84F' }} />
          <div className="flex-1 flex items-center gap-3 px-3.5 py-3 bg-white min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 border border-primary-100">
              <Check size={13} className="text-success-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-900">Fabrication enregistrée</p>
              <p className="text-xs text-primary-500 mt-0.5">
                <span className="font-bold tabular-nums">{confirmation.qte}×</span> {confirmation.se}
              </p>
            </div>
            <button
              onClick={() => setConfirmation(null)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border border-primary-100 p-5 space-y-4">

        {/* Sélecteur de sous-ensemble */}
        <div ref={dropdownRef} className="relative">
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Sous-ensemble à fabriquer
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
            <input
              type="text"
              value={rechercheSE}
              onChange={(e) => {
                setRechercheSE(e.target.value)
                setDropdownOuvert(true)
                if (selectionne && e.target.value !== selectionne.nom) {
                  setSelectionne(null)
                  setLignes([])
                  setCalcule(false)
                }
              }}
              onFocus={() => setDropdownOuvert(true)}
              placeholder={chargementSE ? 'Chargement…' : 'Rechercher un sous-ensemble…'}
              className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              autoComplete="off"
            />
          </div>

          {dropdownOuvert && seFiltres.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {seFiltres.map((se) => (
                <button
                  key={se.id}
                  type="button"
                  onClick={() => selectionnerSE(se)}
                  className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors"
                >
                  <p className="text-sm font-medium text-primary-900">{se.nom}</p>
                  {se.description && <p className="text-xs text-primary-500 truncate mt-0.5">{se.description}</p>}
                </button>
              ))}
            </div>
          )}

          {dropdownOuvert && !chargementSE && sousEnsembles.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg px-4 py-3">
              <p className="text-sm text-primary-400">Aucun sous-ensemble — créez-en un dans Nomenclature</p>
            </div>
          )}

          {selectionne && (
            <div className="mt-2 bg-primary-50 rounded-xl px-3.5 py-2.5">
              <p className="text-sm text-primary-800 font-medium">
                {selectionne.nom}
                {selectionne.description && (
                  <span className="ml-2 text-primary-500 text-xs font-normal">· {selectionne.description}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Quantité */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Quantité à fabriquer
          </label>
          <input
            type="number"
            min="1"
            value={quantite}
            onChange={(e) => { setQuantite(e.target.value); setLignes([]); setCalcule(false) }}
            placeholder="Ex : 2"
            className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-lg font-bold tabular-nums text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>

        {erreur && (
          <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
        )}

        {!calcule && (
          <button
            type="button"
            onClick={calculer}
            disabled={!selectionne || !quantite.trim() || chargementCalc}
            className="w-full bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {chargementCalc ? 'Calcul en cours…' : 'Calculer la consommation'}
          </button>
        )}
      </div>

      {/* Résultat de consommation */}
      {calcule && hasComposants && (
        <div className="mt-5">
          {lignesSE.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
                  Sous-ensembles pris en stock — {quantite}× {selectionne?.nom}
                </span>
                <div className="flex-1 h-px bg-primary-100" />
              </div>
              <div className="space-y-1.5 mb-4">
                {lignesSE.map((ligneSE) => {
                  const apres = ligneSE.quantite_stock - ligneSE.quantite_necessaire
                  return (
                    <div key={ligneSE.sous_ensemble_id} className="flex rounded-xl overflow-hidden border border-primary-100">
                      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#20808E' }} />
                      <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-white min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 border border-primary-100">
                          <Boxes size={12} className="text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary-900 truncate">{ligneSE.nom}</p>
                          <p className="text-xs text-primary-500 tabular-nums">Stock actuel : {ligneSE.quantite_stock}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold tabular-nums text-danger-600">−{ligneSE.quantite_necessaire}</p>
                          <p className="text-xs font-bold tabular-nums text-primary-500">→ {apres}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {lignes.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
              Pièces à consommer — {quantite}× {selectionne?.nom}
            </span>
            <div className="flex-1 h-px bg-primary-100" />
            {hasStockNegatif && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <AlertTriangle size={11} className="text-alert-500" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-alert-500">
                  Stock insuffisant
                </span>
              </div>
            )}
          </div>
          )}

          <div className="space-y-1.5">
            {lignes.map((ligne) => {
              const apres = ligne.quantite_stock - ligne.quantite_necessaire
              const negatif = apres < 0
              return (
                <div key={ligne.piece_id} className="flex rounded-xl overflow-hidden border border-primary-100">
                  <div
                    className="w-[3px] flex-shrink-0"
                    style={{ backgroundColor: negatif ? '#E53535' : '#22B84F' }}
                  />
                  <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-white min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 border border-primary-100">
                      <Wrench size={12} className="text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{ligne.nom}</p>
                      <p className="text-xs text-primary-500 tabular-nums">Stock actuel : {ligne.quantite_stock}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums text-danger-600">−{ligne.quantite_necessaire}</p>
                      <p className={`text-xs font-bold tabular-nums ${negatif ? 'text-alert-500' : 'text-primary-500'}`}>
                        → {apres}
                      </p>
                    </div>
                    {negatif && (
                      <AlertTriangle size={14} className="text-alert-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => { setLignes([]); setLignesSE([]); setCalcule(false) }}
              className="flex-1 border border-primary-200 text-primary-700 rounded-xl py-2.5 text-sm font-medium hover:bg-primary-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasStockNegatif) {
                  const init: Record<string, string> = {}
                  lignesInsuffisantes.forEach((l) => {
                    init[l.piece_id] = String(l.quantite_necessaire)
                  })
                  setCorrectionValues(init)
                  setErreur(null)
                  setPopupCorrection(true)
                } else {
                  setPopupConfirm(true)
                }
              }}
              className="flex-1 bg-primary-900 hover:bg-primary-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {hasStockNegatif ? 'Corriger les stocks' : 'Confirmer la fabrication'}
            </button>
          </div>
        </div>
      )}

      {/* Modal correction stocks */}
      {popupCorrection && (
        <div
          className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-danger-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-danger-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary-900 leading-tight">Stock insuffisant</h2>
                <p className="text-xs text-primary-500 mt-0.5">
                  {lignesInsuffisantes.length} pièce{lignesInsuffisantes.length > 1 ? 's' : ''} à corriger avant de fabriquer
                </p>
              </div>
            </div>

            <div className="mb-4 flex rounded-xl overflow-hidden border border-primary-100">
              <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#E53535' }} />
              <div className="px-3.5 py-2.5 bg-white flex-1">
                <p className="text-xs text-primary-600">
                  Ajustez les quantités ci-dessous. Les corrections seront enregistrées dans l'historique avant de lancer la fabrication.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-5 max-h-64 overflow-y-auto">
              {lignesInsuffisantes.map((ligne) => {
                const valSaisie = parseInt(correctionValues[ligne.piece_id] ?? '', 10)
                const valInsuffisante = isNaN(valSaisie) || valSaisie < ligne.quantite_necessaire
                return (
                  <div key={ligne.piece_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-primary-900 truncate flex-1 mr-3">{ligne.nom}</p>
                      <p className="text-xs text-primary-500 flex-shrink-0 tabular-nums">
                        actuel : <span className="font-semibold text-danger-600">{ligne.quantite_stock}</span>
                        {' · '}besoin : <span className="font-semibold text-primary-700">{ligne.quantite_necessaire}</span>
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={correctionValues[ligne.piece_id] ?? ''}
                      onChange={(e) => setCorrectionValues((prev) => ({ ...prev, [ligne.piece_id]: e.target.value }))}
                      placeholder={`Min. ${ligne.quantite_necessaire}`}
                      className={`w-full border rounded-xl px-3.5 py-2 text-sm font-bold tabular-nums text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                        valInsuffisante ? 'border-danger-400' : 'border-primary-200 focus:border-primary-400'
                      }`}
                    />
                    {valInsuffisante && (
                      <p className="text-xs text-danger-600 mt-1 tabular-nums">
                        Minimum requis : {ligne.quantite_necessaire}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {erreur && (
              <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mb-4">{erreur}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setPopupCorrection(false); setErreur(null) }}
                disabled={corrigingStock}
                className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={appliquerCorrections}
                disabled={corrigingStock || lignesInsuffisantes.some((l) => {
                  const v = parseInt(correctionValues[l.piece_id] ?? '', 10)
                  return isNaN(v) || v < l.quantite_necessaire
                })}
                className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {corrigingStock ? 'Correction…' : 'Corriger et continuer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation */}
      {popupConfirm && (
        <div
          className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Factory size={17} className="text-primary-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary-900 leading-tight">Confirmer la fabrication</h2>
                <p className="text-xs text-primary-500 mt-0.5">
                  <span className="font-bold tabular-nums">{quantite}×</span> {selectionne?.nom}
                </p>
              </div>
            </div>


            <div className="bg-primary-50 rounded-xl divide-y divide-primary-100 mb-5 max-h-60 overflow-y-auto">
              {lignesSE.map((ligneSE) => {
                const apres = ligneSE.quantite_stock - ligneSE.quantite_necessaire
                return (
                  <div key={ligneSE.sous_ensemble_id} className="px-3.5 py-2.5 flex items-center gap-2">
                    <span className="flex-1 text-sm text-primary-800 font-medium truncate">{ligneSE.nom}</span>
                    <span className="text-sm font-bold tabular-nums text-danger-600 flex-shrink-0">
                      −{ligneSE.quantite_necessaire}
                    </span>
                    <span className="text-xs tabular-nums ml-1 flex-shrink-0 font-semibold text-primary-500">
                      → {apres}
                    </span>
                  </div>
                )
              })}
              {lignes.map((ligne) => {
                const apres = ligne.quantite_stock - ligne.quantite_necessaire
                return (
                  <div key={ligne.piece_id} className="px-3.5 py-2.5 flex items-center gap-2">
                    <span className="flex-1 text-sm text-primary-800 font-medium truncate">{ligne.nom}</span>
                    <span className="text-sm font-bold tabular-nums text-danger-600 flex-shrink-0">
                      −{ligne.quantite_necessaire}
                    </span>
                    <span className={`text-xs tabular-nums ml-1 flex-shrink-0 font-semibold ${apres < 0 ? 'text-alert-500' : 'text-primary-500'}`}>
                      → {apres}
                    </span>
                  </div>
                )
              })}
            </div>

            {erreur && (
              <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mb-4">{erreur}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPopupConfirm(false)}
                disabled={fabricationEnCours}
                className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={confirmerFabrication}
                disabled={fabricationEnCours}
                className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {fabricationEnCours ? 'Traitement…' : 'Je confirme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

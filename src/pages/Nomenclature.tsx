import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Plus, Pencil, Search, Layers, Wrench, X, Check, ChevronDown, ChevronUp, Camera } from 'lucide-react'
import PhotoLightbox from '../components/PhotoLightbox'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { SousEnsemble } from '../types'

type ComposantLigne = {
  id: string
  quantite_requise: number
  type: 'piece' | 'sous_ensemble'
  ref_id: string
  nom: string
  description?: string | null
  photo_url?: string | null
}

type ModalSEState = {
  ouvert: boolean
  mode: 'creer' | 'editer'
  nom: string
  description: string
}

type ModalCompState = {
  ouvert: boolean
  typeComp: 'piece' | 'sous_ensemble'
  recherche: string
  selection: Record<string, number>
}

const MODAL_SE_VIDE: ModalSEState = { ouvert: false, mode: 'creer', nom: '', description: '' }
const MODAL_COMP_VIDE: ModalCompState = {
  ouvert: false, typeComp: 'piece', recherche: '', selection: {},
}

export default function Nomenclature() {
  const { pieces } = useStock()
  const utilisateur = getUtilisateurStored()
  const estPatron = utilisateur?.role === 'patron'
  const [sousEnsembles, setSousEnsembles] = useState<SousEnsemble[]>([])
  const [selectionne, setSelectionne] = useState<SousEnsemble | null>(null)
  const [composants, setComposants] = useState<ComposantLigne[]>([])
  const [chargement, setChargement] = useState(true)
  const [chargementComp, setChargementComp] = useState(false)
  const [modalSE, setModalSE] = useState<ModalSEState>(MODAL_SE_VIDE)
  const [enregistrement, setEnregistrement] = useState(false)
  const [modalComp, setModalComp] = useState<ModalCompState>(MODAL_COMP_VIDE)
  const [erreurComp, setErreurComp] = useState<string | null>(null)
  const [ajoutComp, setAjoutComp] = useState(false)
  const [rechercheListe, setRechercheListe] = useState('')
  const [fichierPhotoSE, setFichierPhotoSE] = useState<File | null>(null)
  const [previewUrlSE, setPreviewUrlSE] = useState<string | null>(null)
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null)
  const fileInputRefSE = useRef<HTMLInputElement>(null)
  const chargerSE = useCallback(async () => {
    const { data } = await supabase.from('sous_ensembles').select('*').order('nom')
    setSousEnsembles((data as SousEnsemble[]) ?? [])
    setChargement(false)
  }, [])

  const chargerComposants = useCallback(async (se: SousEnsemble) => {
    setChargementComp(true)
    const { data } = await supabase
      .from('nomenclature')
      .select('id, piece_id, sous_ensemble_enfant_id, quantite_requise')
      .eq('sous_ensemble_id', se.id)

    const lignes: ComposantLigne[] = ((data ?? []) as {
      id: string; piece_id: string | null; sous_ensemble_enfant_id: string | null; quantite_requise: number
    }[]).map((row) => {
      if (row.piece_id) {
        const piece = pieces.find((p) => p.id === row.piece_id)
        return { id: row.id, quantite_requise: row.quantite_requise, type: 'piece' as const, ref_id: row.piece_id, nom: piece?.nom ?? '—', description: piece?.description ?? null, photo_url: piece?.photo_url ?? null }
      } else {
        const enfant = sousEnsembles.find((s) => s.id === row.sous_ensemble_enfant_id)
        return { id: row.id, quantite_requise: row.quantite_requise, type: 'sous_ensemble' as const, ref_id: row.sous_ensemble_enfant_id ?? '', nom: enfant?.nom ?? '—', photo_url: enfant?.photo_url ?? null }
      }
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

    setComposants(lignes)
    setChargementComp(false)
  }, [pieces, sousEnsembles])

  useEffect(() => { chargerSE() }, [chargerSE])

  useEffect(() => {
    if (selectionne) chargerComposants(selectionne)
    else setComposants([])
  }, [selectionne, chargerComposants])

  useEffect(() => {
    if (modalSE.ouvert && modalSE.mode === 'editer') {
      setPreviewUrlSE(selectionne?.photo_url ?? null)
    } else if (!modalSE.ouvert) {
      setFichierPhotoSE(null)
      setPreviewUrlSE(null)
    }
  }, [modalSE.ouvert, modalSE.mode, selectionne])

  const seFiltres = useMemo(() =>
    rechercheListe.trim()
      ? sousEnsembles.filter((s) => s.nom.toLowerCase().includes(rechercheListe.toLowerCase()))
      : sousEnsembles,
    [sousEnsembles, rechercheListe]
  )

  const optionsComposant = useMemo(() => {
    if (modalComp.typeComp === 'piece') {
      return pieces
        .filter((p) => !modalComp.recherche.trim() || p.nom.toLowerCase().includes(modalComp.recherche.toLowerCase()))
        .filter((p) => !composants.some((c) => c.type === 'piece' && c.ref_id === p.id))
        .map((p) => ({ id: p.id, nom: p.nom, description: p.description ?? null }))
    }
    return sousEnsembles
      .filter((s) => s.id !== selectionne?.id)
      .filter((s) => !modalComp.recherche.trim() || s.nom.toLowerCase().includes(modalComp.recherche.toLowerCase()))
      .filter((s) => !composants.some((c) => c.type === 'sous_ensemble' && c.ref_id === s.id))
      .map((s) => ({ id: s.id, nom: s.nom, description: null }))
  }, [modalComp.typeComp, modalComp.recherche, pieces, sousEnsembles, selectionne, composants])

  function handleFileChangeSE(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFichierPhotoSE(file)
      setPreviewUrlSE(URL.createObjectURL(file))
    }
  }

  async function sauvegarderSE() {
    if (!modalSE.nom.trim()) return
    setEnregistrement(true)
    try {
      if (modalSE.mode === 'creer') {
        const { data, error } = await supabase
          .from('sous_ensembles')
          .insert({ nom: modalSE.nom.trim(), description: modalSE.description.trim() || null })
          .select()
          .single()
        if (error) throw error
        if (fichierPhotoSE) {
          const ext = fichierPhotoSE.name.split('.').pop() ?? 'jpg'
          console.log('Nomenclature - Uploading file:', fichierPhotoSE.name, 'to se-photos/', `${data.id}.${ext}`)
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('se-photos')
            .upload(`${data.id}.${ext}`, fichierPhotoSE, { upsert: true })
          console.log('Nomenclature - Upload result:', { uploadData, uploadError })
          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('se-photos').getPublicUrl(uploadData.path)
            console.log('Nomenclature - Public URL:', publicUrl)
            await supabase.from('sous_ensembles').update({ photo_url: publicUrl }).eq('id', data.id)
          } else if (uploadError) {
            console.error('Nomenclature - Upload error:', uploadError)
          }
        }
        await chargerSE()
        setSelectionne(data as SousEnsemble)
      } else if (selectionne) {
        const payload: Record<string, unknown> = {
          nom: modalSE.nom.trim(),
          description: modalSE.description.trim() || null,
        }
        if (fichierPhotoSE) {
          const ext = fichierPhotoSE.name.split('.').pop() ?? 'jpg'
          console.log('Nomenclature Edit - Uploading file:', fichierPhotoSE.name, 'to se-photos/', `${selectionne.id}.${ext}`)
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('se-photos')
            .upload(`${selectionne.id}.${ext}`, fichierPhotoSE, { upsert: true })
          console.log('Nomenclature Edit - Upload result:', { uploadData, uploadError })
          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('se-photos').getPublicUrl(uploadData.path)
            console.log('Nomenclature Edit - Public URL:', publicUrl)
            payload.photo_url = publicUrl
          } else if (uploadError) {
            console.error('Nomenclature Edit - Upload error:', uploadError)
          }
        }
        const { error } = await supabase
          .from('sous_ensembles')
          .update(payload)
          .eq('id', selectionne.id)
        if (error) throw error
        await chargerSE()
        setSelectionne((prev) => prev ? {
          ...prev,
          nom: modalSE.nom.trim(),
          description: modalSE.description.trim() || null,
          ...(payload.photo_url ? { photo_url: payload.photo_url as string } : {}),
        } : null)
      }
      setModalSE(MODAL_SE_VIDE)
    } finally {
      setEnregistrement(false)
    }
  }

  async function ajouterComposant() {
    const ids = Object.keys(modalComp.selection)
    if (!selectionne || ids.length === 0) { setErreurComp('Sélectionnez au moins un élément'); return }
    setAjoutComp(true)
    setErreurComp(null)
    try {
      const rows = ids.map((id) => ({
        sous_ensemble_id: selectionne.id,
        piece_id: modalComp.typeComp === 'piece' ? id : null,
        sous_ensemble_enfant_id: modalComp.typeComp === 'sous_ensemble' ? id : null,
        quantite_requise: modalComp.selection[id],
      }))
      const { error } = await supabase.from('nomenclature').insert(rows)
      if (error) throw error
      await chargerComposants(selectionne)
      setModalComp(MODAL_COMP_VIDE)
    } catch (err: unknown) {
      setErreurComp(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setAjoutComp(false)
    }
  }

  async function supprimerComposant(id: string) {
    await supabase.from('nomenclature').delete().eq('id', id)
    setComposants((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Sous-ensembles</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            {sousEnsembles.length} sous-ensemble{sousEnsembles.length !== 1 ? 's' : ''} défini{sousEnsembles.length !== 1 ? 's' : ''}
          </p>
        </div>
        {estPatron && (
          <button
            onClick={() => setModalSE({ ouvert: true, mode: 'creer', nom: '', description: '' })}
            className="flex items-center gap-2 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Nouveau sous-ensemble</span>
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-5">

        {/* Panneau gauche — liste SE */}
        <div className="md:w-72 flex-shrink-0">

          {/* Recherche */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={rechercheListe}
              onChange={(e) => setRechercheListe(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            />
          </div>

          {/* Liste */}
          {chargement ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-primary-400 text-sm">Chargement…</p>
            </div>
          ) : seFiltres.length === 0 ? (
            <div className="py-2 pl-3 border-l-2 border-primary-200">
              <p className="text-sm text-primary-600 italic">
                {rechercheListe ? 'Aucun résultat' : 'Aucun sous-ensemble défini'}
              </p>
              {!rechercheListe && estPatron && (
                <button
                  onClick={() => setModalSE({ ouvert: true, mode: 'creer', nom: '', description: '' })}
                  className="mt-1.5 text-xs font-medium text-primary-500 hover:text-primary-900 transition-colors"
                >
                  + Créer le premier
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {seFiltres.map((se) => {
                const isSelected = selectionne?.id === se.id
                return (
                  <button key={se.id} onClick={() => setSelectionne(se)} className="w-full text-left">
                    <div className={`flex rounded-xl overflow-hidden border transition-colors ${
                      isSelected ? 'border-primary-200' : 'border-primary-100 hover:border-primary-200'
                    }`}>
                      <div
                        className="w-[3px] flex-shrink-0 transition-colors"
                        style={{ backgroundColor: isSelected ? '#074750' : 'transparent' }}
                      />
                      <div className={`flex-1 flex items-center gap-2 px-3.5 py-2.5 transition-colors ${isSelected ? 'bg-primary-50' : 'bg-white'}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary-900' : 'text-primary-700'}`}>
                            {se.nom}
                          </p>
                          {se.description && (
                            <p className="text-xs text-primary-500 truncate mt-0.5">{se.description}</p>
                          )}
                        </div>
                        {se.photo_url && (
                          <img
                            src={se.photo_url}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPhotoLightbox(se.photo_url!)}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Panneau droit — détail SE */}
        <div className="flex-1 min-w-0">
          {!selectionne ? (
            <div className="border border-dashed border-primary-200 rounded-2xl px-6 py-16 text-center">
              <p className="text-sm text-primary-400 italic">
                Sélectionnez un sous-ensemble pour voir sa composition
              </p>
            </div>
          ) : (
            <>
              {/* En-tête du SE sélectionné */}
              <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex items-start gap-3 min-w-0">
                  {selectionne.photo_url && (
                    <img
                      src={selectionne.photo_url}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setPhotoLightbox(selectionne.photo_url!)}
                    />
                  )}
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-primary-900 leading-tight">{selectionne.nom}</h2>
                    {selectionne.description && (
                      <p className="text-xs text-primary-500 mt-1">{selectionne.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModalSE({ ouvert: true, mode: 'editer', nom: selectionne.nom, description: selectionne.description ?? '' })}
                  className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-800 font-medium transition-colors flex-shrink-0"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
              </div>

              {/* Section composants */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
                  Composants
                </span>
                <div className="flex-1 h-px bg-primary-100" />
                {composants.length > 0 && (
                  <span className="text-xs font-semibold text-primary-600 tabular-nums">{composants.length}</span>
                )}
                <button
                  onClick={() => setModalComp({ ...MODAL_COMP_VIDE, ouvert: true })}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 hover:text-primary-900 transition-colors"
                >
                  <Plus size={11} />
                  Ajouter
                </button>
              </div>

              {chargementComp ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-primary-400 text-sm">Chargement…</p>
                </div>
              ) : composants.length === 0 ? (
                <div className="py-10 border border-dashed border-primary-200 rounded-xl text-center">
                  <p className="text-sm text-primary-400 italic mb-2">Aucun composant défini</p>
                  <button
                    onClick={() => setModalComp({ ...MODAL_COMP_VIDE, ouvert: true })}
                    className="text-xs font-medium text-primary-500 hover:text-primary-900 transition-colors"
                  >
                    + Ajouter le premier composant
                  </button>
                </div>
              ) : (() => {
                const sousEnsemblesComp = composants.filter((c) => c.type === 'sous_ensemble')
                const piecesComp = composants.filter((c) => c.type === 'piece')
                const renderLigne = (comp: ComposantLigne) => (
                  <div key={comp.id} className="flex rounded-xl overflow-hidden border border-primary-100">
                    <div
                      className="w-[3px] flex-shrink-0"
                      style={{ backgroundColor: comp.type === 'piece' ? '#22B84F' : '#F97316' }}
                    />
                    <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-white min-w-0">
                      {comp.photo_url ? (
                        <img src={comp.photo_url} alt={comp.nom} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPhotoLightbox(comp.photo_url!)} />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 border border-primary-100">
                          {comp.type === 'piece'
                            ? <Wrench size={13} className="text-primary-400" />
                            : <Layers size={13} className="text-alert-400" />
                          }
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-900 truncate">{comp.nom}</p>
                        {comp.type === 'piece' && comp.description
                          ? <p className="text-xs text-primary-400 truncate">{comp.description}</p>
                          : <p className="text-xs text-primary-500">{comp.type === 'piece' ? 'Pièce' : 'Sous-ensemble'}</p>
                        }
                      </div>
                      <span className="text-sm font-bold tabular-nums text-primary-700 flex-shrink-0">
                        ×{comp.quantite_requise}
                      </span>
                      <button
                        onClick={() => supprimerComposant(comp.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-danger-500 hover:bg-danger-100 transition-colors ml-1"
                        title="Supprimer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )
                return (
                  <div className="space-y-4">
                    {sousEnsemblesComp.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
                            Sous-ensembles fabriqués
                          </span>
                          <div className="flex-1 h-px bg-primary-100" />
                          <span className="text-xs font-semibold text-primary-600 tabular-nums">{sousEnsemblesComp.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {sousEnsemblesComp.map(renderLigne)}
                        </div>
                      </div>
                    )}
                    {piecesComp.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
                            Pièces
                          </span>
                          <div className="flex-1 h-px bg-primary-100" />
                          <span className="text-xs font-semibold text-primary-600 tabular-nums">{piecesComp.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {piecesComp.map(renderLigne)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {/* Modal créer / éditer sous-ensemble */}
      {modalSE.ouvert && (
        <div
          className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Layers size={17} className="text-primary-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary-900 leading-tight">
                  {modalSE.mode === 'creer' ? 'Nouveau sous-ensemble' : 'Modifier le sous-ensemble'}
                </h2>
                <p className="text-xs text-primary-500 mt-0.5">
                  {modalSE.mode === 'creer' ? 'Définir un nouvel assemblage' : selectionne?.nom}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Nom *
                </label>
                <input
                  type="text"
                  value={modalSE.nom}
                  onChange={(e) => setModalSE((prev) => ({ ...prev, nom: e.target.value }))}
                  placeholder="Ex : Tambour résiné"
                  autoFocus
                  className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Description{' '}
                  <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
                </label>
                <textarea
                  value={modalSE.description}
                  onChange={(e) => setModalSE((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Description du sous-ensemble…"
                  className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fileInputRefSE}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChangeSE}
                />
                <button
                  type="button"
                  onClick={() => fileInputRefSE.current?.click()}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-900 transition-colors"
                >
                  <Camera size={13} />
                  {previewUrlSE ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                {previewUrlSE && (
                  <img
                    src={previewUrlSE}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPhotoLightbox(previewUrlSE)}
                  />
                )}
                {fichierPhotoSE && (
                  <span className="text-xs text-primary-400 truncate max-w-[120px]">{fichierPhotoSE.name}</span>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModalSE(MODAL_SE_VIDE)}
                className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={sauvegarderSE}
                disabled={!modalSE.nom.trim() || enregistrement}
                className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajouter composant */}
      {modalComp.ouvert && (
        <div className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Plus size={17} className="text-primary-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary-900 leading-tight">Ajouter des composants</h2>
                <p className="text-xs text-primary-500 mt-0.5">{selectionne?.nom}</p>
              </div>
            </div>

            {/* Toggle type */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setModalComp((prev) => ({ ...prev, typeComp: 'piece', selection: {}, recherche: '' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  modalComp.typeComp === 'piece'
                    ? 'bg-primary-900 text-white border-primary-900'
                    : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
                }`}
              >
                <Wrench size={12} />
                Pièce
              </button>
              <button
                type="button"
                onClick={() => setModalComp((prev) => ({ ...prev, typeComp: 'sous_ensemble', selection: {}, recherche: '' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  modalComp.typeComp === 'sous_ensemble'
                    ? 'bg-primary-900 text-white border-primary-900'
                    : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
                }`}
              >
                <Layers size={12} />
                Sous-ensemble
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
              <input
                type="text"
                value={modalComp.recherche}
                onChange={(e) => setModalComp((prev) => ({ ...prev, recherche: e.target.value }))}
                placeholder="Rechercher…"
                className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>

            {/* Multi-select list */}
            <div className="border border-primary-100 rounded-xl max-h-80 overflow-y-auto">
              {optionsComposant.length === 0 ? (
                <div className="px-4 py-3 text-sm text-primary-400 italic">Aucun résultat</div>
              ) : (
                optionsComposant.map((opt) => {
                  const isChecked = opt.id in modalComp.selection
                  const qte = modalComp.selection[opt.id] ?? 1
                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 border-b border-primary-50 last:border-0 transition-colors ${
                        isChecked ? 'bg-primary-50' : 'hover:bg-primary-50/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setModalComp((prev) => {
                          const sel = { ...prev.selection }
                          if (isChecked) delete sel[opt.id]
                          else sel[opt.id] = 1
                          return { ...prev, selection: sel }
                        })}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isChecked ? 'bg-primary-900 border-primary-900' : 'border-primary-300 hover:border-primary-500'
                        }`}
                      >
                        {isChecked && <Check size={11} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isChecked ? 'text-primary-900 font-medium' : 'text-primary-700'}`}>{opt.nom}</p>
                        {opt.description && <p className="text-xs text-primary-400 truncate">{opt.description}</p>}
                      </div>
                      {isChecked && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setModalComp((prev) => ({ ...prev, selection: { ...prev.selection, [opt.id]: Math.max(1, qte - 1) } }))}
                            className="w-6 h-6 rounded-lg bg-primary-100 hover:bg-primary-200 flex items-center justify-center text-primary-700 transition-colors"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <span className="w-7 text-center text-sm font-bold tabular-nums text-primary-900">{qte}</span>
                          <button
                            type="button"
                            onClick={() => setModalComp((prev) => ({ ...prev, selection: { ...prev.selection, [opt.id]: qte + 1 } }))}
                            className="w-6 h-6 rounded-lg bg-primary-100 hover:bg-primary-200 flex items-center justify-center text-primary-700 transition-colors"
                          >
                            <ChevronUp size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {Object.keys(modalComp.selection).length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mt-2 pl-1">
                {Object.keys(modalComp.selection).length} sélectionné{Object.keys(modalComp.selection).length > 1 ? 's' : ''}
              </p>
            )}

            {erreurComp && (
              <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mt-3">{erreurComp}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setModalComp(MODAL_COMP_VIDE); setErreurComp(null) }}
                className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={ajouterComposant}
                disabled={Object.keys(modalComp.selection).length === 0 || ajoutComp}
                className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {ajoutComp ? 'Ajout…' : `Ajouter${Object.keys(modalComp.selection).length > 0 ? ` (${Object.keys(modalComp.selection).length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {photoLightbox && <PhotoLightbox url={photoLightbox} onClose={() => setPhotoLightbox(null)} />}
    </div>
  )
}

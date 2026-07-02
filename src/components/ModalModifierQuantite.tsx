import { useState, useRef } from 'react'
import { X, Camera, Bell, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { creerOperation } from '../utils/creerOperation'
import { Piece, Utilisateur } from '../types'
import PhotoLightbox from './PhotoLightbox'

type Props = {
  piece: Piece
  utilisateur: Utilisateur
  categoriesExistantes?: string[]
  onClose: () => void
  onSuccess: () => void
}

export default function ModalModifierQuantite({ piece, utilisateur, categoriesExistantes = [], onClose, onSuccess }: Props) {
  const [nouvelleQuantite, setNouvelleQuantite] = useState(String(piece.quantite))
  const [commentaire, setCommentaire] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(piece.photo_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [envoyerAlerte, setEnvoyerAlerte] = useState(false)
  const [messageAlerte, setMessageAlerte] = useState(`⚠️ Stock modifié — ${piece.nom}`)
  const [commentaireAlerte, setCommentaireAlerte] = useState('')

  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archivageEnCours, setArchivageEnCours] = useState(false)

  const isAdmin = utilisateur.role === 'patron'
  const [description, setDescription] = useState(piece.description ?? '')
  const [categorie, setCategorie] = useState(piece.categorie ?? '')
  const [seuilRouge, setSeuilRouge] = useState(String(piece.seuil_rouge))
  const [seuilJaune, setSeuilJaune] = useState(String(piece.seuil_jaune))
  const [seuilVert, setSeuilVert] = useState(String(piece.seuil_vert))

  const nv = parseInt(nouvelleQuantite, 10)
  const delta = isNaN(nv) ? null : nv - piece.quantite

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFichierPhoto(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  async function soumettre() {
    if (isNaN(nv)) { setErreur('Quantité invalide'); return }
    const adminFieldsChanged = isAdmin && (
      description !== (piece.description ?? '') ||
      categorie !== (piece.categorie ?? '') ||
      parseInt(seuilRouge, 10) !== piece.seuil_rouge ||
      parseInt(seuilJaune, 10) !== piece.seuil_jaune ||
      parseInt(seuilVert, 10) !== piece.seuil_vert
    )
    if (nv === piece.quantite && !commentaire.trim() && !fichierPhoto && !adminFieldsChanged) { onClose(); return }

    setChargement(true)
    setErreur(null)

    try {
      let photoUrl: string | undefined = undefined

      if (fichierPhoto) {
        const ext = fichierPhoto.name.split('.').pop() ?? 'jpg'
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('piece-photos')
          .upload(`${piece.id}.${ext}`, fichierPhoto, { upsert: true })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('piece-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = publicUrl
      }

      const updatePayload: Record<string, unknown> = { quantite: nv }
      if (photoUrl) updatePayload.photo_url = photoUrl
      if (isAdmin) {
        updatePayload.description = description.trim() || null
        updatePayload.categorie = categorie.trim() || null
        updatePayload.seuil_rouge = parseInt(seuilRouge, 10) || 0
        updatePayload.seuil_jaune = parseInt(seuilJaune, 10) || 0
        updatePayload.seuil_vert = parseInt(seuilVert, 10) || 0
      }

      const { error } = await supabase
        .from('pieces')
        .update(updatePayload)
        .eq('id', piece.id)
      if (error) throw error

      await creerOperation({
        type: 'correction',
        piece_id: piece.id,
        quantite_avant: piece.quantite,
        quantite_apres: nv,
        delta: nv - piece.quantite,
        utilisateur_id: utilisateur.id,
        commentaire: commentaire.trim() || undefined,
      })

      if (envoyerAlerte && messageAlerte.trim()) {
        const alertPayload: Record<string, unknown> = {
          message: messageAlerte.trim(),
          utilisateur_id: utilisateur.id,
          resolue: false,
        }
        if (commentaireAlerte.trim()) alertPayload.commentaire = commentaireAlerte.trim()
        await supabase.from('alertes_manuelles').insert(alertPayload)
      }

      onSuccess()
      onClose()
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la modification')
    } finally {
      setChargement(false)
    }
  }

  async function archiverPiece() {
    setArchivageEnCours(true)
    setErreur(null)
    try {
      const { error } = await supabase
        .from('pieces')
        .update({ archivee: true })
        .eq('id', piece.id)
      if (error) throw error
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la suppression')
      setArchivageEnCours(false)
      setConfirmArchive(false)
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-primary-100 sticky top-0 bg-white z-10">
          <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Pencil size={15} className="text-primary-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-primary-900 leading-tight">Modifier la quantité</h2>
            <p className="text-xs text-primary-500 truncate mt-0.5">{piece.nom}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 hover:bg-primary-50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Info pièce + aperçu photo */}
          <div className="bg-primary-50 rounded-xl px-3.5 py-3 flex items-center gap-3">
            {previewUrl && (
              <img
                src={previewUrl}
                alt=""
                className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${fichierPhoto ? 'ring-2 ring-primary-400' : ''}`}
                onClick={() => setLightboxUrl(previewUrl)}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-900 truncate">{piece.nom}</p>
              <p className="text-xs text-primary-500 mt-0.5 tabular-nums">
                Quantité actuelle :{' '}
                <span className="font-bold text-primary-700">{piece.quantite}</span>
                {piece.categorie && <span className="ml-2">· {piece.categorie}</span>}
              </p>
            </div>
          </div>

          {/* Photo */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-900 transition-colors"
            >
              <Camera size={13} />
              {previewUrl ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            {fichierPhoto && (
              <span className="text-xs text-primary-400 truncate max-w-[160px]">{fichierPhoto.name}</span>
            )}
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Nouvelle quantité
            </label>
            <input
              type="number"
              value={nouvelleQuantite}
              onChange={(e) => setNouvelleQuantite(e.target.value)}
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              autoFocus
            />
            {delta !== null && delta !== 0 && (
              <p className={`text-sm mt-1.5 font-bold tabular-nums ${delta > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {delta > 0 ? `+${delta}` : delta} unités par rapport à l'actuel
              </p>
            )}
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Commentaire{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Ex : Comptage physique, correction d'erreur…"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 placeholder-primary-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>

          {/* Section admin : catégorie + seuils */}
          {isAdmin && (
            <div className="border border-primary-100 rounded-xl p-3.5 space-y-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600">Paramètres admin</p>

              {/* Description / usage */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Description / usage{' '}
                  <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex : Fermeture tourelle + Bride GB…"
                  className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-sm placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Catégorie
                </label>
                <input
                  list="categories-list"
                  type="text"
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
                  placeholder="Ex : Visserie, Électronique…"
                  className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-sm placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
                {categoriesExistantes.length > 0 && (
                  <datalist id="categories-list">
                    {categoriesExistantes.map((c) => <option key={c} value={c} />)}
                  </datalist>
                )}
              </div>

              {/* Seuils */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Seuils d'alerte
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-danger-600 mb-1">
                      <span className="w-2 h-2 rounded-full bg-danger-500 inline-block" />
                      Rouge
                    </label>
                    <input
                      type="number"
                      value={seuilRouge}
                      onChange={(e) => setSeuilRouge(e.target.value)}
                      className="w-full border border-danger-200 rounded-xl px-3 py-2 text-primary-900 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-danger-300 focus:border-danger-400"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-warning-600 mb-1">
                      <span className="w-2 h-2 rounded-full bg-warning-400 inline-block" />
                      Jaune
                    </label>
                    <input
                      type="number"
                      value={seuilJaune}
                      onChange={(e) => setSeuilJaune(e.target.value)}
                      className="w-full border border-warning-200 rounded-xl px-3 py-2 text-primary-900 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-warning-300 focus:border-warning-400"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success-600 mb-1">
                      <span className="w-2 h-2 rounded-full bg-success-400 inline-block" />
                      Vert
                    </label>
                    <input
                      type="number"
                      value={seuilVert}
                      onChange={(e) => setSeuilVert(e.target.value)}
                      className="w-full border border-success-300 rounded-xl px-3 py-2 text-primary-900 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-success-300 focus:border-success-400"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-primary-400 mt-1.5">Rouge ≤ seuil rouge · Jaune ≤ seuil jaune · sinon Vert</p>
              </div>
            </div>
          )}

          {/* Alerte */}
          <div className="border border-primary-100 rounded-xl p-3.5 space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={envoyerAlerte}
                onChange={(e) => setEnvoyerAlerte(e.target.checked)}
                className="w-4 h-4 rounded accent-alert-500"
              />
              <Bell size={13} className="text-primary-500" />
              <span className="text-sm font-medium text-primary-700">Envoyer une alerte</span>
            </label>
            {envoyerAlerte && (
              <>
                <input
                  type="text"
                  value={messageAlerte}
                  onChange={(e) => setMessageAlerte(e.target.value)}
                  placeholder="Titre de l'alerte…"
                  className="w-full border border-alert-400 rounded-xl px-3 py-2 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-alert-400 focus:border-transparent"
                />
                <textarea
                  value={commentaireAlerte}
                  onChange={(e) => setCommentaireAlerte(e.target.value)}
                  rows={2}
                  placeholder="Commentaire (facultatif) — précisez la raison ou le contexte…"
                  className="w-full border border-alert-400 rounded-xl px-3 py-2 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-alert-400 focus:border-transparent resize-none"
                />
              </>
            )}
          </div>

          {erreur && (
            <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={soumettre}
            disabled={chargement}
            className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {chargement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>

        {/* Zone suppression */}
        <div className="px-5 pb-5 pt-2 border-t border-primary-100">
          {!confirmArchive ? (
            <button
              onClick={() => setConfirmArchive(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-danger-500 hover:text-danger-700 font-medium py-2 rounded-xl hover:bg-danger-100 transition-colors"
            >
              <Trash2 size={13} />
              Supprimer cette pièce du stock
            </button>
          ) : (
            <div className="bg-danger-100 border border-danger-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-danger-800 font-medium">
                Supprimer <span className="font-bold">«&nbsp;{piece.nom}&nbsp;»</span> ?
                Elle disparaîtra du stock (action réversible via la base).
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmArchive(false)}
                  disabled={archivageEnCours}
                  className="flex-1 border border-danger-200 text-danger-700 rounded-lg py-2 text-sm font-medium hover:bg-danger-100 transition-colors disabled:opacity-50"
                >
                  Non, garder
                </button>
                <button
                  onClick={archiverPiece}
                  disabled={archivageEnCours}
                  className="flex-1 bg-danger-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-danger-700 transition-colors disabled:opacity-50"
                >
                  {archivageEnCours ? 'Suppression…' : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
  </>
  )
}

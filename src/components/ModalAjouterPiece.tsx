import { useState, useRef } from 'react'
import { X, Camera, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { creerOperation } from '../utils/creerOperation'
import { Utilisateur } from '../types'

type Props = {
  utilisateur: Utilisateur
  categoriesExistantes: string[]
  onClose: () => void
  onSuccess: () => void
}

type FormData = {
  nom: string
  quantite: string
  seuil_rouge: string
  seuil_jaune: string
  seuil_vert: string
  categorie: string
}

const FORM_INIT: FormData = {
  nom: '',
  quantite: '0',
  seuil_rouge: '0',
  seuil_jaune: '5',
  seuil_vert: '10',
  categorie: '',
}

export default function ModalAjouterPiece({ utilisateur, categoriesExistantes, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormData>(FORM_INIT)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function setField(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFichierPhoto(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  async function soumettre() {
    if (!form.nom.trim()) {
      setErreur('Le nom de la pièce est requis')
      return
    }

    setChargement(true)
    setErreur(null)

    try {
      const qty = parseInt(form.quantite, 10) || 0

      const { data, error } = await supabase
        .from('pieces')
        .insert({
          nom: form.nom.trim(),
          quantite: qty,
          seuil_rouge: parseInt(form.seuil_rouge, 10) || 0,
          seuil_jaune: parseInt(form.seuil_jaune, 10) || 0,
          seuil_vert: parseInt(form.seuil_vert, 10) || 0,
          categorie: form.categorie.trim() || null,
          archivee: false,
        })
        .select()
        .single()

      if (error) throw error

      if (fichierPhoto) {
        const ext = fichierPhoto.name.split('.').pop() ?? 'jpg'
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('piece-photos')
          .upload(`${data.id}.${ext}`, fichierPhoto, { upsert: true })
        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('piece-photos')
            .getPublicUrl(uploadData.path)
          await supabase.from('pieces').update({ photo_url: publicUrl }).eq('id', data.id)
        }
      }

      await creerOperation({
        type: 'ajout_piece',
        piece_id: data.id,
        quantite_avant: 0,
        quantite_apres: qty,
        delta: qty,
        utilisateur_id: utilisateur.id,
        commentaire: `Pièce créée : ${form.nom.trim()}`,
      })

      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la création'
      setErreur(msg)
    } finally {
      setChargement(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-primary-100 sticky top-0 bg-white z-10">
          <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Wrench size={15} className="text-primary-700" />
          </div>
          <h2 className="flex-1 text-base font-bold text-primary-900">Ajouter une pièce</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 hover:bg-primary-50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Nom */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Nom de la pièce <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setField('nom', e.target.value)}
              placeholder="Ex : Coque inférieure"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              autoFocus
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Photo{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img src={previewUrl} alt="Aperçu" className="w-14 h-14 rounded-xl object-cover border border-primary-100 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl border-2 border-dashed border-primary-200 flex items-center justify-center flex-shrink-0">
                  <Camera size={18} className="text-primary-300" />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-900 transition-colors"
              >
                <Camera size={13} />
                {previewUrl ? 'Changer la photo' : 'Choisir une photo'}
              </button>
            </div>
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Catégorie{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
            </label>
            <input
              type="text"
              value={form.categorie}
              onChange={(e) => setField('categorie', e.target.value)}
              placeholder="Ex : Visserie, Plastique, Électronique…"
              list="categories-datalist"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            {categoriesExistantes.length > 0 && (
              <datalist id="categories-datalist">
                {categoriesExistantes.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>

          {/* Quantité initiale */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Quantité initiale
            </label>
            <input
              type="number"
              value={form.quantite}
              onChange={(e) => setField('quantite', e.target.value)}
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>

          {/* Seuils */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-2">Seuils d'alerte</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-danger-600 mb-1">Critique</label>
                <input
                  type="number"
                  value={form.seuil_rouge}
                  onChange={(e) => setField('seuil_rouge', e.target.value)}
                  className="w-full border border-danger-200 rounded-xl px-3 py-2 text-sm text-primary-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-danger-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-warning-600 mb-1">Faible</label>
                <input
                  type="number"
                  value={form.seuil_jaune}
                  onChange={(e) => setField('seuil_jaune', e.target.value)}
                  className="w-full border border-warning-400 rounded-xl px-3 py-2 text-sm text-primary-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-warning-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-success-600 mb-1">OK</label>
                <input
                  type="number"
                  value={form.seuil_vert}
                  onChange={(e) => setField('seuil_vert', e.target.value)}
                  className="w-full border border-success-400 rounded-xl px-3 py-2 text-sm text-primary-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-success-400 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-xs text-primary-400 mt-1.5">
              Critique ≤ rouge &lt; jaune &lt; vert (à régler selon la pièce)
            </p>
          </div>

          {erreur && (
            <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
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
            {chargement ? 'Création…' : 'Créer la pièce'}
          </button>
        </div>
      </div>
    </div>
  )
}

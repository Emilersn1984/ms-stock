import { useState, useRef } from 'react'
import { X, Factory, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SousEnsemble, Utilisateur } from '../types'
import PhotoLightbox from './PhotoLightbox'

type Props = {
  se: SousEnsemble
  utilisateur: Utilisateur
  onClose: () => void
}

export default function ModalModifierSE({ se, utilisateur: _utilisateur, onClose }: Props) {
  const [quantite, setQuantite] = useState(String(se.quantite))
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(se.photo_url ?? null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setFichierPhoto(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  async function soumettre() {
    const nv = parseInt(quantite, 10)
    if (isNaN(nv) || nv < 0) { setErreur('Quantité invalide (minimum 0)'); return }
    if (nv === se.quantite && !fichierPhoto) { onClose(); return }
    setChargement(true)
    setErreur(null)
    try {
      const updatePayload: Record<string, unknown> = { quantite: nv }

      if (fichierPhoto) {
        const ext = fichierPhoto.name.split('.').pop() ?? 'jpg'
        console.log('Uploading file:', fichierPhoto.name, 'to se-photos/', `${se.id}.${ext}`)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('se-photos')
          .upload(`${se.id}.${ext}`, fichierPhoto, { upsert: true })
        console.log('Upload result:', { uploadData, uploadError })
        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw uploadError
        }
        const { data: { publicUrl } } = supabase.storage
          .from('se-photos')
          .getPublicUrl(uploadData.path)
        console.log('Public URL:', publicUrl)
        updatePayload.photo_url = publicUrl
      }

      const { error } = await supabase
        .from('sous_ensembles')
        .update(updatePayload)
        .eq('id', se.id)
      if (error) throw error
      onClose()
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la correction')
    } finally {
      setChargement(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-sm">

          <div className="flex items-center gap-3 px-5 py-4 border-b border-primary-100">
            <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Factory size={15} className="text-primary-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-primary-900 leading-tight">Corriger le stock</h2>
              <p className="text-xs text-primary-500 mt-0.5">{se.nom}</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 hover:bg-primary-50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="bg-primary-50 rounded-xl px-3.5 py-3 flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${fichierPhoto ? 'ring-2 ring-primary-400' : ''}`}
                  onClick={() => setLightboxUrl(previewUrl)}
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-primary-100">
                  <Factory size={14} className="text-primary-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-primary-900">{se.nom}</p>
                <p className="text-xs text-primary-500 mt-0.5 tabular-nums">
                  Stock actuel : <span className="font-bold text-primary-700">{se.quantite}</span> fabriqué{se.quantite !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

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

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Quantité réelle en stock
              </label>
              <input
                type="number"
                min="0"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                autoFocus
              />
            </div>

            {erreur && (
              <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
            )}
          </div>

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
              {chargement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </>
  )
}

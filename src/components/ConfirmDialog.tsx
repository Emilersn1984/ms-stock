import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

type Props = {
  titre: string
  message: string
  labelConfirmation?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ titre, message, labelConfirmation, onConfirm, onCancel }: Props) {
  const [etape, setEtape] = useState<1 | 2>(1)

  return (
    <div className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-danger-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={17} className="text-danger-600" />
            </div>
            <h2 className="text-base font-bold text-primary-900 leading-tight">{titre}</h2>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-sm text-primary-600 mb-5">
          {etape === 1 ? message : (labelConfirmation ?? 'Cette action est irréversible. Confirmez-vous vraiment la suppression ?')}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => (etape === 1 ? setEtape(2) : onConfirm())}
            className="flex-1 py-2.5 bg-danger-600 hover:bg-danger-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {etape === 1 ? 'Supprimer' : 'Confirmer la suppression'}
          </button>
        </div>
      </div>
    </div>
  )
}

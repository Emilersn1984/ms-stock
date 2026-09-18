import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Check, Undo2, FileText } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { useFacturesFournisseurs } from '../hooks/useFacturesFournisseurs'
import { FactureFournisseur } from '../types'

// Une échéance dans les 7 jours (ou déjà passée) déclenche la pastille d'alerte.
const SEUIL_ALERTE_JOURS = 7

const CHAMP = 'w-full bg-transparent text-xs text-primary-800 px-1 py-1 rounded hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-300'

function formatEuros(v: number): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

function aujourdhuiIso(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/** Jours restants avant l'échéance : 0 = aujourd'hui, négatif = dépassée. */
function joursAvant(echeance: string): number {
  const jour = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
  return Math.round((jour(echeance) - jour(aujourdhuiIso())) / 86400000)
}

function libelleEcheance(jours: number): string {
  if (jours < -1) return `en retard de ${-jours} jours`
  if (jours === -1) return 'en retard de 1 jour'
  if (jours === 0) return "aujourd'hui"
  if (jours === 1) return 'demain'
  return `dans ${jours} jours`
}

export default function SectionFacturesFournisseurs() {
  const { factures, chargement, erreur, ajouter, modifier, supprimer } = useFacturesFournisseurs()
  const [ouverte, setOuverte] = useState(false)
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [afficherPayees, setAfficherPayees] = useState(false)
  const [aSupprimer, setASupprimer] = useState<FactureFournisseur | null>(null)

  const [fournisseur, setFournisseur] = useState('')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [echeance, setEcheance] = useState(aujourdhuiIso())

  const { aPayer, payees, total, nbAlerte, enRetard } = useMemo(() => {
    const aPayer = factures.filter((f) => !f.date_paiement)
    const alertes = aPayer.filter((f) => joursAvant(f.date_echeance) <= SEUIL_ALERTE_JOURS)
    return {
      aPayer,
      payees: factures.filter((f) => f.date_paiement),
      total: aPayer.reduce((s, f) => s + Number(f.montant_ttc), 0),
      nbAlerte: alertes.length,
      enRetard: alertes.some((f) => joursAvant(f.date_echeance) < 0),
    }
  }, [factures])

  async function confirmerAjout() {
    const valeur = Number(montant.replace(',', '.'))
    if (!fournisseur.trim() || !echeance || !Number.isFinite(valeur)) return
    await ajouter({
      fournisseur: fournisseur.trim(),
      libelle: libelle.trim() || null,
      montant_ttc: valeur,
      date_echeance: echeance,
    })
    setFournisseur('')
    setLibelle('')
    setMontant('')
    setEcheance(aujourdhuiIso())
    setAjoutOuvert(false)
  }

  const visibles = afficherPayees ? [...aPayer, ...payees] : aPayer

  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
      <button
        type="button"
        onClick={() => setOuverte((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        {ouverte ? <ChevronDown size={14} className="text-primary-400" /> : <ChevronRight size={14} className="text-primary-400" />}
        <FileText size={15} className="text-primary-700" />
        <h2 className="text-sm font-bold text-primary-900">Factures fournisseurs à payer</h2>
        {nbAlerte > 0 && (
          <span
            title={enRetard ? 'Au moins une échéance est dépassée' : `Échéance dans moins de ${SEUIL_ALERTE_JOURS} jours`}
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg ${
              enRetard ? 'bg-danger-100 text-danger-600' : 'bg-warning-100 text-warning-700'
            }`}
          >
            {nbAlerte} à échéance
          </span>
        )}
        <span className="flex-1" />
        {aPayer.length > 0 && (
          <span className="text-xs text-primary-500 tabular-nums">
            {aPayer.length} en attente · {formatEuros(total)}
          </span>
        )}
      </button>

      {ouverte && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              onClick={() => setAjoutOuvert((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-500 hover:text-primary-900 transition-colors"
            >
              <Plus size={12} />
              Ajouter une facture
            </button>
            {payees.length > 0 && (
              <button
                onClick={() => setAfficherPayees((v) => !v)}
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-400 hover:text-primary-700 transition-colors"
              >
                {afficherPayees ? 'Masquer les payées' : `Afficher les payées (${payees.length})`}
              </button>
            )}
          </div>

          {ajoutOuvert && (
            <div className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-primary-50 rounded-xl">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">Fournisseur</label>
                <input
                  type="text"
                  value={fournisseur}
                  onChange={(e) => setFournisseur(e.target.value)}
                  placeholder="Ex : JLCPCB"
                  className="w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">
                  Libellé <span className="font-normal normal-case tracking-normal text-primary-400">(facultatif)</span>
                </label>
                <input
                  type="text"
                  value={libelle}
                  onChange={(e) => setLibelle(e.target.value)}
                  placeholder="Ex : Facture 2026-114"
                  className="w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">Montant TTC</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmerAjout() }}
                  placeholder="1290"
                  className="w-28 border border-primary-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">Échéance</label>
                <input
                  type="date"
                  value={echeance}
                  onChange={(e) => setEcheance(e.target.value)}
                  className="border border-primary-200 rounded-lg px-2 py-1.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <button
                onClick={confirmerAjout}
                disabled={!fournisseur.trim() || !montant.trim() || !echeance}
                className="px-4 py-1.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Ajouter
              </button>
            </div>
          )}

          {erreur && <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mb-3">{erreur}</p>}

          {chargement ? (
            <p className="text-xs text-primary-400 italic">Chargement…</p>
          ) : visibles.length === 0 ? (
            <p className="text-xs text-primary-400 italic">Aucune facture à payer.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-primary-100">
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-2 py-1.5 w-40">Fournisseur</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-2 py-1.5">Libellé</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-2 py-1.5 w-52">Échéance</th>
                    <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-2 py-1.5 w-28">Montant TTC</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => {
                    const jours = joursAvant(f.date_echeance)
                    const payee = !!f.date_paiement
                    const couleur = payee ? 'text-primary-400' : jours < 0 ? 'text-danger-600' : jours <= SEUIL_ALERTE_JOURS ? 'text-warning-700' : 'text-primary-500'
                    return (
                      <tr key={f.id} className={`border-b border-primary-50 hover:bg-primary-50/60 group ${payee ? 'opacity-60' : ''}`}>
                        <td className="px-1.5 py-0">
                          <input
                            type="text"
                            defaultValue={f.fournisseur}
                            onBlur={(e) => {
                              const v = e.target.value.trim()
                              if (v && v !== f.fournisseur) modifier(f.id, { fournisseur: v })
                              else e.target.value = f.fournisseur
                            }}
                            className={`${CHAMP} truncate`}
                          />
                        </td>
                        <td className="px-1.5 py-0">
                          <input
                            type="text"
                            defaultValue={f.libelle ?? ''}
                            placeholder="—"
                            onBlur={(e) => {
                              const v = e.target.value.trim() || null
                              if (v !== (f.libelle ?? null)) modifier(f.id, { libelle: v })
                            }}
                            className={`${CHAMP} truncate placeholder-primary-300`}
                          />
                        </td>
                        <td className="px-1.5 py-0 whitespace-nowrap">
                          <input
                            type="date"
                            value={f.date_echeance}
                            onChange={(e) => { if (e.target.value) modifier(f.id, { date_echeance: e.target.value }) }}
                            className={`${CHAMP} w-32 inline-block`}
                          />
                          {!payee && (
                            <span className={`ml-1 text-[11px] ${couleur}`}>{libelleEcheance(jours)}</span>
                          )}
                        </td>
                        <td className="px-1.5 py-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            defaultValue={String(f.montant_ttc)}
                            onBlur={(e) => {
                              const v = Number(e.target.value.replace(',', '.'))
                              if (Number.isFinite(v) && v !== Number(f.montant_ttc)) modifier(f.id, { montant_ttc: v })
                              else e.target.value = String(f.montant_ttc)
                            }}
                            className={`${CHAMP} text-right tabular-nums`}
                          />
                        </td>
                        <td className="px-1">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => modifier(f.id, { date_paiement: payee ? null : aujourdhuiIso() })}
                              title={payee ? `Payée le ${f.date_paiement} — marquer non payée` : 'Marquer payée'}
                              className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                                payee
                                  ? 'text-success-600 hover:bg-primary-100'
                                  : 'text-primary-300 opacity-0 group-hover:opacity-100 hover:bg-success-100 hover:text-success-600'
                              }`}
                            >
                              {payee ? <Undo2 size={12} /> : <Check size={13} />}
                            </button>
                            <button
                              onClick={() => setASupprimer(f)}
                              title="Supprimer la facture"
                              className="w-6 h-6 flex items-center justify-center rounded-lg text-primary-300 opacity-0 group-hover:opacity-100 hover:bg-danger-100 hover:text-danger-600 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-primary-200 font-bold">
                    <td colSpan={3} className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-primary-900">
                      Total à payer
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-primary-900">{formatEuros(total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-primary-400 mt-3 leading-relaxed">
            Suivi informatif : ces factures ne sont pas reportées automatiquement dans le plan de trésorerie ci-dessus.
          </p>
        </div>
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre="Supprimer la facture"
          message={`Supprimer la facture ${aSupprimer.fournisseur}${aSupprimer.libelle ? ` — ${aSupprimer.libelle}` : ''} de ${formatEuros(Number(aSupprimer.montant_ttc))} ?`}
          onCancel={() => setASupprimer(null)}
          onConfirm={() => { supprimer(aSupprimer.id); setASupprimer(null) }}
        />
      )}
    </div>
  )
}

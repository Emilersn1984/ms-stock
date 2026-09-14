import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Cpu, Upload, Trash2, Plus, Search, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LigneBomJlc, StockJlc, calculerManquesJlc, lireInventaireJlc } from '../utils/jlcStock'

type Props = {
  onClose: () => void
}

type Onglet = 'manques' | 'bom'

const LABEL = 'block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5'
const CHAMP = 'border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400'

/** Quantité par produit, modifiable directement dans le tableau de la BOM. */
function CelluleQuantite({ valeur, onValider }: { valeur: number; onValider: (n: number) => void }) {
  const [saisie, setSaisie] = useState(String(valeur))
  useEffect(() => { setSaisie(String(valeur)) }, [valeur])

  function valider() {
    const n = parseInt(saisie, 10)
    if (!Number.isFinite(n) || n <= 0) { setSaisie(String(valeur)); return }
    if (n !== valeur) onValider(n)
  }

  return (
    <input
      type="number"
      min={1}
      value={saisie}
      onChange={(e) => setSaisie(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-20 border border-primary-200 rounded-lg px-2 py-1 text-sm text-right tabular-nums text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
    />
  )
}

export default function ModalStocksJlc({ onClose }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('manques')
  const [bom, setBom] = useState<LigneBomJlc[]>([])
  const [nombreProduits, setNombreProduits] = useState(40)
  const [saisieNombre, setSaisieNombre] = useState('40')
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [stocks, setStocks] = useState<Map<string, StockJlc> | null>(null)
  const [nomFichier, setNomFichier] = useState<string | null>(null)
  const [importeLe, setImporteLe] = useState<string | null>(null)
  const [lecture, setLecture] = useState(false)
  const fichierRef = useRef<HTMLInputElement>(null)

  const [recherche, setRecherche] = useState('')
  const [nouvelleRef, setNouvelleRef] = useState('')
  const [nouvelleQte, setNouvelleQte] = useState('1')
  const [ligneASupprimer, setLigneASupprimer] = useState<string | null>(null)

  async function chargerBom() {
    const { data, error } = await supabase
      .from('jlc_bom')
      .select('id, reference, quantite_par_produit, ordre')
      .order('ordre')
      .order('reference')
    if (error) setErreur(error.message)
    else setBom((data ?? []) as LigneBomJlc[])
  }

  useEffect(() => {
    async function charger() {
      const [, { data: param, error: errParam }] = await Promise.all([
        chargerBom(),
        supabase
          .from('parametres')
          .select('jlc_stock_min, jlc_inventaire, jlc_inventaire_fichier, jlc_inventaire_importe_le')
          .eq('id', 1)
          .single(),
      ])
      if (errParam) setErreur(errParam.message)
      else if (param) {
        if (param.jlc_stock_min != null) {
          setNombreProduits(param.jlc_stock_min)
          setSaisieNombre(String(param.jlc_stock_min))
        }
        // Dernier inventaire importé, réaffiché sans avoir à recharger le fichier.
        if (Array.isArray(param.jlc_inventaire)) {
          const lignes = param.jlc_inventaire as StockJlc[]
          setStocks(new Map(lignes.map((l) => [l.reference, l])))
          setNomFichier(param.jlc_inventaire_fichier ?? null)
          setImporteLe(param.jlc_inventaire_importe_le ?? null)
        }
      }
      setChargement(false)
    }
    charger()
  }, [])

  useEffect(() => {
    function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [onClose])

  async function validerNombreProduits() {
    const n = parseInt(saisieNombre, 10)
    if (!Number.isFinite(n) || n < 0) { setSaisieNombre(String(nombreProduits)); return }
    if (n === nombreProduits) return
    setNombreProduits(n)
    const { error } = await supabase
      .from('parametres')
      .update({ jlc_stock_min: n, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) setErreur(error.message)
  }

  async function importerInventaire(fichier: File) {
    setLecture(true)
    setErreur(null)
    try {
      const { readSheet } = await import('read-excel-file/browser')
      const lignes = await readSheet(fichier)
      const lus = lireInventaireJlc(lignes as unknown as Parameters<typeof lireInventaireJlc>[0])
      const maintenant = new Date().toISOString()
      // Enregistré avant affichage : un fichier illisible ne remplace pas le précédent.
      const { error } = await supabase
        .from('parametres')
        .update({
          jlc_inventaire: [...lus.values()],
          jlc_inventaire_fichier: fichier.name,
          jlc_inventaire_importe_le: maintenant,
          updated_at: maintenant,
        })
        .eq('id', 1)
      if (error) throw error
      setStocks(lus)
      setNomFichier(fichier.name)
      setImporteLe(maintenant)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Lecture du fichier impossible')
    } finally {
      setLecture(false)
      if (fichierRef.current) fichierRef.current.value = ''
    }
  }

  async function modifierQuantite(ligne: LigneBomJlc, quantite: number) {
    setBom((prev) => prev.map((l) => (l.id === ligne.id ? { ...l, quantite_par_produit: quantite } : l)))
    const { error } = await supabase.from('jlc_bom').update({ quantite_par_produit: quantite }).eq('id', ligne.id)
    if (error) { setErreur(error.message); chargerBom() }
  }

  async function supprimerLigne(id: string) {
    setLigneASupprimer(null)
    const { error } = await supabase.from('jlc_bom').delete().eq('id', id)
    if (error) setErreur(error.message)
    chargerBom()
  }

  async function ajouterLigne(e: React.FormEvent) {
    e.preventDefault()
    const reference = nouvelleRef.trim().toUpperCase()
    const quantite = parseInt(nouvelleQte, 10)
    if (!reference) { setErreur('Renseignez la référence JLCPCB'); return }
    if (!Number.isFinite(quantite) || quantite <= 0) { setErreur('Quantité par produit invalide'); return }
    if (bom.some((l) => l.reference === reference)) { setErreur(`${reference} est déjà dans la BOM`); return }
    setErreur(null)
    const ordre = bom.reduce((max, l) => Math.max(max, l.ordre), 0) + 1
    const { error } = await supabase.from('jlc_bom').insert({ reference, quantite_par_produit: quantite, ordre })
    if (error) { setErreur(error.message); return }
    setNouvelleRef('')
    setNouvelleQte('1')
    chargerBom()
  }

  const manques = useMemo(
    () => (stocks ? calculerManquesJlc(bom, stocks, nombreProduits).filter((m) => m.manque < 0) : []),
    [bom, stocks, nombreProduits]
  )

  const bomFiltree = useMemo(() => {
    const q = recherche.trim().toUpperCase()
    return q ? bom.filter((l) => l.reference.toUpperCase().includes(q)) : bom
  }, [bom, recherche])

  return (
    <div
      className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 p-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Cpu size={17} className="text-primary-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary-900 leading-tight">Stocks JLC</h2>
              <p className="text-xs text-primary-500 mt-0.5">Composants des cartes électroniques chez l'EMS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paramètre + onglets */}
        <div className="px-6 space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className={LABEL}>Stock min (nombre de produits)</label>
              <input
                type="number"
                min={0}
                value={saisieNombre}
                onChange={(e) => setSaisieNombre(e.target.value)}
                onBlur={validerNombreProduits}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className={`${CHAMP} w-28 tabular-nums`}
              />
            </div>
            <p className="text-xs text-primary-500 pb-2 flex-1 min-w-[200px]">
              Stock min d'un composant = quantité par produit × {nombreProduits}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-primary-50 rounded-xl">
            {(['manques', 'bom'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOnglet(o)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                  onglet === o ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'
                }`}
              >
                {o === 'manques' ? 'Composants en manque' : `BOM (${bom.length} références)`}
              </button>
            ))}
          </div>

          {erreur && <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>}
        </div>

        {/* Contenu */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {chargement ? (
            <p className="text-sm text-primary-400 italic">Chargement…</p>
          ) : onglet === 'manques' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fichierRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importerInventaire(f) }}
                />
                <button
                  type="button"
                  onClick={() => fichierRef.current?.click()}
                  disabled={lecture || bom.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Upload size={15} />
                  {lecture ? 'Lecture…' : nomFichier ? 'Importer un autre inventaire' : "Importer l'inventaire JLC (.xlsx)"}
                </button>
                {stocks && (
                  <span className="text-xs text-primary-500 min-w-0">
                    {nomFichier ?? 'Inventaire'} — {stocks.size} références
                    {importeLe && (
                      <> · importé le {new Date(importeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </span>
                )}
              </div>

              {!stocks ? (
                <p className="text-sm text-primary-500 leading-relaxed">
                  Exportez l'inventaire depuis JLCPCB (« Parts Inventory on JLCPCB ») puis importez le fichier :
                  les composants dont le stock ne couvre pas {nombreProduits} produits s'afficheront ici.
                </p>
              ) : manques.length === 0 ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-success-600">
                  <CheckCircle2 size={16} /> Aucun composant en manque pour {nombreProduits} produits.
                </p>
              ) : (
                <>
                  <p className="text-xs text-primary-500">
                    <span className="font-bold text-danger-600">{manques.length}</span> référence{manques.length > 1 ? 's' : ''} en
                    manque sur {bom.length}, pour {nombreProduits} produits.
                  </p>
                  <div className="rounded-xl border border-primary-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-primary-50 border-b border-primary-100">
                        <tr>
                          <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-2.5 w-[170px]">Référence</th>
                          <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-2.5">Qté / produit</th>
                          <th
                            className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-2.5"
                            title="Plus grand des stocks JLCPCB et Global Sourcing"
                          >
                            Stock actuel
                          </th>
                          <th
                            className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-2.5"
                            title={`Qté / produit × ${nombreProduits}`}
                          >
                            Stock cible
                          </th>
                          <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-2.5">Manque</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary-50">
                        {manques.map((m) => (
                          <tr key={m.reference}>
                            <td className="px-3 py-2 w-[170px] max-w-[170px]">
                              <p className="font-medium text-primary-900 tabular-nums truncate">{m.reference}</p>
                              {m.absente ? (
                                <p className="text-[11px] text-warning-600 truncate">absente de l'inventaire</p>
                              ) : m.mfr && (
                                <p className="text-[11px] text-primary-400 truncate" title={m.mfr}>{m.mfr}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-primary-700">{m.quantiteParProduit}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-primary-700">{m.stockMax.toLocaleString('fr-FR')}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-primary-700">{m.stockMin.toLocaleString('fr-FR')}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-danger-600">
                              {m.manque.toLocaleString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <form onSubmit={ajouterLigne} className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className={LABEL}>Nouvelle référence</label>
                  <input
                    type="text"
                    value={nouvelleRef}
                    onChange={(e) => setNouvelleRef(e.target.value)}
                    placeholder="Ex : C17414"
                    className={`${CHAMP} w-full`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Qté / produit</label>
                  <input
                    type="number"
                    min={1}
                    value={nouvelleQte}
                    onChange={(e) => setNouvelleQte(e.target.value)}
                    className={`${CHAMP} w-24 tabular-nums`}
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-900 hover:bg-primary-800 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </form>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une référence…"
                  className={`${CHAMP} w-full pl-8`}
                />
              </div>

              <div className="rounded-xl border border-primary-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-primary-50 border-b border-primary-100">
                    <tr>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-2.5">Référence JLCPCB</th>
                      <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-2.5">Qté / produit</th>
                      <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-2.5">Stock min</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-50">
                    {bomFiltree.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-1.5 font-medium text-primary-900 tabular-nums">{l.reference}</td>
                        <td className="px-4 py-1.5 text-right">
                          <CelluleQuantite valeur={l.quantite_par_produit} onValider={(n) => modifierQuantite(l, n)} />
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-primary-600">
                          {(l.quantite_par_produit * nombreProduits).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {ligneASupprimer === l.id ? (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => supprimerLigne(l.id)}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-danger-600 text-white hover:bg-danger-700"
                              >
                                Supprimer
                              </button>
                              <button
                                type="button"
                                onClick={() => setLigneASupprimer(null)}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-primary-500 hover:bg-primary-50"
                              >
                                Annuler
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              title="Retirer de la BOM"
                              onClick={() => setLigneASupprimer(l.id)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-primary-400 hover:bg-danger-100 hover:text-danger-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {bomFiltree.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-sm text-primary-400 italic">
                          {bom.length === 0 ? 'BOM vide — lancez la migration add-jlc-stock.sql' : 'Aucune référence trouvée'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

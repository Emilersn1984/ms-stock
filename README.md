# MS-Stock - Gestion des Stocks pour Mooring Solution

Application SaaS de gestion des stocks développée pour Mooring Solution.

## 🚀 Site en ligne

**https://ms-stock-lior.vercel.app**

Le déploiement est automatique : chaque push sur `main` déclenche un nouveau build Vercel.

Pour lancer l'application localement :
```bash
npm run dev
```

L'application est alors accessible sur `http://localhost:5173`

## 🛠️ Stack Technique

- **Frontend :** React + TypeScript + Vite
- **Styling :** Tailwind CSS avec palette personnalisée
- **Backend :** Supabase
- **Routing :** react-router-dom
- **Icons :** lucide-react
- **Lecture Excel :** read-excel-file (chargé à la demande)

## 🎨 Design System

### Palette de couleurs personnalisée
- **Turquoise brand :** primary-500 (#20808E)
- **Tempête :** primary-900 (#074750)
- **Néon brand :** success-300 (#5FF180)
- **Danger :** danger-500 (#E53535)
- **Warning :** warning-500 (#E9A20A)
- **Alert :** alert-500 (#F97316)

### Règles de design
- Fond de page : #F0FAFB
- Mobile-first responsive
- Pas de couleurs gray-* → primary-*
- Icônes lucide-react uniquement
- Composants réutilisables avec design cohérent

## 📋 Fonctionnalités

### Pages (dans l'ordre du menu)
- **Tableau de bord** — CA du mois, commandes du mois, colis fabricables, alertes, achats recommandés, objectif de vente mensuel
- **Ventes** — saisie d'une vente (client, type Vente / Don, contenu, facture émise, origines multiples, commentaire, montant HT, type de bateau, date d'expédition prévue), historique filtrable, export CSV complet (adresse, origine, commentaire et type de bateau n'y figurent que dans l'export), total sous le tableau, graphe de CA mensuel
- **Expédition** — colis à expédier, finalisation (adresse modifiable, contenu, transporteur, un n° de série par bouée proposé automatiquement), retour vers « à expédier », annulation d'une réception, historique filtrable avec une ligne par n° de série
- **SAV** — bandeau de compteurs (produits vendus et SAV, au total et sur l'année), déclaration d'une reprise sur un client existant, historique filtrable (client, cause, récupération, remboursement, période) et export CSV
- **Stock** — pièces avec seuils, prix unitaire et MOQ ; fiche détaillée au clic (référence, fournisseur, sous-ensembles qui l'utilisent) ; modale *Gérer les sous-ensembles*
- **Achats MP** — achats recommandés, commandes en cours, commande multi-références, historique des commandes passées, graphe des dépenses avec projection ; modale *Gérer stocks JLC*
- **Projections** — plan de trésorerie sur 3 mois, lignes et cellules modifiables, graphe de trésorerie, bascule manuelle au mois suivant, factures fournisseurs à payer
- **Historique** — une ligne par vente ou par achat, avec montants perçus et dépensés

### Décompte du stock
Les sous-ensembles ne sont ni fabriqués ni stockés. Une vente, un don ou un SAV indique quels
produits sortent de l'atelier : Bouée complète, Bouée mécanique, Boîtier bord, Tourelle (plusieurs
possibles, avec quantité). À la **validation de l'expédition** (À expédier → Envoyé), la nomenclature
de chaque produit est explosée récursivement et les composants unitaires sont décomptés
(`src/utils/consommerExpedition.ts`). Renvoyer l'expédition vers « à expédier » les remet en stock ;
modifier le contenu d'une expédition déjà envoyée ne répercute que la différence. Marquer reçu
ou annuler la réception ne touche pas au stock.

### Stocks JLC (composants des cartes électroniques)
Reprise du fichier *JLC Stock Manager*, accessible depuis Achats MP → *Gérer stocks JLC* :
- **BOM** des cartes (table `jlc_bom`) : référence JLCPCB et quantité par produit, modifiables
  (ajout, suppression, quantité).
- **Paramètre** « Stock min (nombre de produits) » : stock cible = quantité par produit × ce nombre.
- **Import** d'un export *Parts Inventory on JLCPCB* (.xlsx, lu dans le navigateur avec
  `read-excel-file`). Colonnes repérées par leur en-tête. Stock actuel = max(JLCPCB, Global
  Sourcing), manque = stock actuel − stock cible. Une référence absente de l'inventaire compte pour 0.
- Le **dernier import** est enregistré dans `parametres` et réaffiché à l'ouverture.
- Tableau des manques : référence, qté / produit, stock actuel, stock cible, manque (négatif, en rouge).

### Factures fournisseurs
Section repliée par défaut dans Projections, entre le graphe de trésorerie et les recettes.
Saisie et suivi des factures à payer (fournisseur, libellé, montant TTC, échéance), marquage
payée / non payée, total dû. Une pastille sur l'en-tête compte les factures dont l'échéance
est dépassée (rouge) ou à moins de 7 jours (orange) ; sans échéance proche, aucun signal.
Suivi informatif : ces montants ne sont pas reportés dans le plan de trésorerie, qui calcule
déjà les achats projetés.

### Numéros de série
Une expédition porte autant de numéros que de bouées complètes dans son contenu
(`expeditions.numeros_serie`, `src/utils/numerosSerie.ts`). Les champs s'ouvrent d'office à la
finalisation et en modification d'une expédition déjà numérotée, pré-remplis avec les prochains
numéros libres ; sur une commande encore à expédier ils restent vides. `numero_serie` garde le
premier numéro, pour les lignes anciennes et les filtres.

### SAV
Page dédiée (table `sav`). Une reprise se déclare sur un **client existant** : date, cause
(électronique / mécanique), description, remboursement demandé, moyen de récupération du matériel
(mains propres ou envoi, avec transporteur et n° de suivi), matériel concerné et date prévue de
renvoi au client.

- La recherche client fusionne les fiches `clients` et les destinataires des ventes
  (`src/utils/clientsConnus.ts`). L'import initial de l'historique n'a pas créé de fiche pour
  62 ventes : sans cette fusion, plus de la moitié des clients seraient introuvables. Le
  rapprochement ignore casse, accents et espaces ; une fiche client prime sur une ligne de vente,
  et un client sans fiche donne un SAV à `client_id` NULL, ce que la base accepte.
- Le matériel repris **n'est jamais remis en stock** : rien ne garantit qu'il soit réutilisable.
- Avec une date de renvoi, un colis est créé dans `expeditions` (catégorie SAV, statut « à
  expédier », date d'envoi prévisionnelle = date de renvoi) et rattaché par `sav.expedition_id`
  (`src/utils/expeditionSav.ts`). Sans date, aucun colis n'est créé. Un colis **déjà parti** n'est
  plus retouché : son contenu a été décompté du stock. Supprimer un SAV retire le colis s'il est
  encore à expédier.
- Le renvoi suit ensuite le circuit normal : les composants sont décomptés au passage
  « à expédier » → « expédié ». Si le matériel réparé repart tel quel, vider le contenu du colis
  avant de le valider, sinon les composants seront décomptés une seconde fois.
- Compteurs (`src/utils/statsSav.ts`) : les produits vendus comptent les produits, pas les
  commandes (une vente de 2 bouées compte 2), sur les expéditions de catégorie « vente » ; une
  vente sans contenu (saisie avant le choix des produits) compte pour 1. Un SAV
  compte pour 1. Les expéditions SAV antérieures au module sont comptées, sauf celles déjà
  rattachées à une reprise.
- La déclaration d'un SAV depuis la page Ventes a été retirée ; la catégorie SAV reste affichée
  et filtrable pour les lignes existantes et les colis de renvoi.
- Les SAV saisis avant la page SAV ont été repris par `add-sav-import.sql`, rattachés à leur
  colis. Leur **cause** et leur **moyen de récupération** sont vides (l'information n'existait
  pas) et s'affichent « À compléter » : ces deux colonnes acceptent donc NULL, mais le formulaire
  les exige dès qu'on modifie une ligne.

### Anciennes pages supprimées
Les pages *Nomenclature* et *Fabrication* ont été supprimées ; la nomenclature se gère
depuis la page Stock. Les routes `/nomenclature` et `/fabrication` redirigent vers `/stock`.
`/livraisons` redirige vers `/commandes` (libellé « Achats MP »).

## 🗂️ Structure du projet

```
src/
├── components/     # Composants réutilisables (modales, graphes, tableaux)
├── hooks/         # Hooks personnalisés (accès Supabase + temps réel)
├── layouts/       # Layout principal et navigation
├── pages/         # Pages de l'application
├── utils/         # Utilitaires métier (nomenclature, seuils, projections)
├── types/         # Types TypeScript
└── lib/           # Configuration Supabase
```

## 📊 Base de données

Base gérée via Supabase. Tables :

| Table | Rôle |
|---|---|
| `pieces` | Pièces et composants, avec quantité, seuils, délai d'appro, prix unitaire, MOQ, référence, fournisseur |
| `sous_ensembles` | Sous-ensembles ; la colonne `produit` désigne les 4 produits vendables |
| `nomenclature` | Composition des sous-ensembles (pièces et sous-ensembles enfants) |
| `operations` | Journal des mouvements de stock |
| `productions` | Historique des fabrications (plus alimentée) |
| `utilisateurs` | Membres de l'équipe et rôles |
| `clients` | Fiches clients |
| `expeditions` | Ventes et expéditions (même enregistrement) ; `items` = produits sortis, `facture_emise`, `numeros_serie` |
| `factures_fournisseurs` | Factures fournisseurs à payer (`date_paiement` à NULL = encore due) |
| `sav` | Reprises de SAV ; `materiel` = matériel repris, `expedition_id` = colis de renvoi |
| `commandes` | Achats de matières premières |
| `alertes_manuelles` | Alertes créées depuis le tableau de bord |
| `parametres` | Table singleton : objectif de vente, prix de vente moyen, trésorerie initiale, sous-ensemble « bouée complète », mois de départ des projections, paramètre et dernier inventaire JLC |
| `projections_lignes` | Lignes du plan de trésorerie |
| `jlc_bom` | BOM des cartes électroniques (référence JLCPCB, quantité par produit) |

### Migrations SQL

Les fichiers `add-*.sql` et `fix-*.sql` à la racine sont à exécuter **une fois**, dans
l'éditeur SQL de Supabase. Les plus récents sont rejouables sans risque
(`IF NOT EXISTS`, contraintes recréées) :

- `add-ventes.sql` — montant payé, type « don », origine de vente, type de bateau, sous-ensemble produit fini
- `add-achats-montant.sql` — montant payé sur les commandes
- `add-prix-moq-pieces.sql` — prix unitaire et MOQ sur les pièces
- `add-projections.sql` — paramètres de projection et table `projections_lignes`
- `add-projections-mois.sql` — mois de départ de la fenêtre de projection
- `add-commandes-groupe.sql` — `groupe_id` pour les commandes multi-références
- `add-origines-multiples.sql` — plusieurs origines par vente, et CA TTC réalisé
- `add-produits-facture-fournisseur.sql` — référence et fournisseur des pièces, facture émise, produits vendables sur les sous-ensembles
- `add-jlc-stock.sql` — table `jlc_bom` (BOM initiale de 68 références), paramètre et dernier inventaire JLC
- `add-factures-fournisseurs.sql` — table `factures_fournisseurs`
- `add-numeros-serie.sql` — plusieurs numéros de série par expédition
- `add-sav.sql` — table `sav` (reprises de SAV et colis de renvoi rattaché)
- `add-sav-import.sql` — reprise des SAV saisis avant la page SAV (cause et récupération nullables)

## 🔐 Configuration

1. Créer un fichier `.env.local` à partir de `.env.local.example`
2. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
3. Lancer l'application

En production, ces deux variables sont définies dans les *Environment Variables* du projet
Vercel. Elles sont lues **au moment du build** : après les avoir modifiées, il faut relancer
un déploiement pour qu'elles soient prises en compte.

## ⚠️ Limitation connue : authentification

L'application **n'a pas de véritable authentification**. Le rôle se choisit dans une liste, et
le mot de passe administrateur n'est vérifié que côté navigateur : il masque des boutons, il ne
protège pas les données. Les policies RLS Supabase autorisent le rôle `anon` à lire, créer,
modifier et supprimer dans toutes les tables sans condition.

Conséquence : toute personne connaissant l'URL du projet Supabase et la clé publique peut lire
et modifier l'intégralité des données. Avant d'exploiter l'application avec de vraies données
commerciales, il faut mettre en place Supabase Auth et conditionner les policies à
`auth.uid()`.

## 🚀 Développement local

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev

# Vérification des types
npx tsc --noEmit

# Build pour production
npm run build

# Preview du build
npm run preview
```

---

**Développé par :** Gabriel Widmann
**Pour :** Mooring Solution
**Version :** 1.0.0

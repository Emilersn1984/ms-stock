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
- **Ventes** — saisie d'une vente (client, type, origines multiples, montant HT, type de bateau, date d'expédition prévue), historique filtrable, export CSV, total sous le tableau, graphe de CA mensuel
- **Expédition** — colis à expédier, finalisation (adresse modifiable, contenu, transporteur, n° de série proposé automatiquement), historique filtrable
- **Stock** — pièces avec seuils, prix unitaire et MOQ ; sous-ensembles disponibles ; accès aux modales *Gérer les sous-ensembles* et *Fabrication*
- **Achats MP** — achats recommandés, commandes en cours, commande multi-références, historique des commandes passées, graphe des dépenses avec projection
- **Projections** — plan de trésorerie sur 3 mois, lignes et cellules modifiables, graphe de trésorerie, bascule manuelle au mois suivant
- **Historique** — une ligne par vente ou par achat, avec montants perçus et dépensés

### Anciennes pages devenues des modales
Les pages *Nomenclature* et *Fabrication* ont été supprimées ; leurs fonctions sont accessibles
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
| `pieces` | Pièces et composants, avec quantité, seuils, délai d'appro, prix unitaire, MOQ |
| `sous_ensembles` | Sous-ensembles assemblés |
| `nomenclature` | Composition des sous-ensembles (pièces et sous-ensembles enfants) |
| `operations` | Journal des mouvements de stock |
| `productions` | Historique des fabrications |
| `utilisateurs` | Membres de l'équipe et rôles |
| `clients` | Fiches clients |
| `expeditions` | Ventes et expéditions (même enregistrement) |
| `commandes` | Achats de matières premières |
| `alertes_manuelles` | Alertes créées depuis le tableau de bord |
| `parametres` | Table singleton : objectif de vente, prix de vente moyen, trésorerie initiale, sous-ensemble « bouée complète », mois de départ des projections |
| `projections_lignes` | Lignes du plan de trésorerie |

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

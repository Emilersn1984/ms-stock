# MS-Stock - Gestion des Stocks pour Mooring Solution

Application SaaS de gestion des stocks développée pour Mooring Solution.

## 🚀 Lancement du site

**Accès à l'application :** [https://ms-stock.vercel.app](https://ms-stock.vercel.app)

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

### Pages principales
- ✅ **Dashboard** - Vue d'ensemble avec KPIs
- ✅ **Stock** - Gestion des stocks avec filtres et recherche
- ✅ **Nomenclature** - Gestion des nomenclatures et sous-ensembles
- ✅ **Livraisons** - Suivi des livraisons
- ⏳ **Fabrication** - Gestion des ordres de fabrication
- ⏳ **Historique** - Historique des opérations

### Composants
- Header avec navigation
- Layout responsive
- Modals pour les opérations CRUD
- Tableaux avec design cohérent
- Filtres et recherche

## 🗂️ Structure du projet

```
src/
├── components/     # Composants réutilisables
├── hooks/         # Hooks personnalisés
├── layouts/       # Layouts principaux
├── pages/         # Pages de l'application
├── utils/         # Utilitaires métier
├── types/         # Types TypeScript
└── lib/           # Configuration Supabase
```

## 🚀 Développement local

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev

# Build pour production
npm run build

# Preview du build
npm run preview
```

## 📊 Base de données

La base de données est gérée via Supabase avec les tables principales :
- `pieces` - Pièces et composants
- `sous_ensembles` - Sous-ensembles
- `stocks` - État des stocks
- `operations` - Historique des opérations
- `utilisateurs` - Gestion des utilisateurs

## 🔐 Configuration

1. Créer un fichier `.env.local` à partir de `.env.local.example`
2. Configurer les variables Supabase
3. Lancer l'application

---

**Développé par :** Emile Leroux  
**Pour :** Mooring Solution  
**Version :** 1.0.0

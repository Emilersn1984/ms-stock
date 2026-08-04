# Mise en place de l'intégration Stripe

Le webhook Stripe est implémenté comme une **Supabase Edge Function** :
`supabase/functions/stripe-webhook/index.ts`. Il écoute l'événement
`checkout.session.completed` et crée automatiquement une ligne dans la table
`expeditions` (statut `a_expedier`, origine `stripe`) avec les informations
client disponibles (nom, adresse de livraison, langue). Les informations
absentes de Stripe (version du code, catégorie, sous-ensembles à décompter...)
restent à compléter via le popup lorsqu'on clique sur la carte dans la
colonne "À expédier".

## 1. Prérequis

- Avoir exécuté `add-expeditions.sql` dans l'éditeur SQL Supabase (crée les
  tables `clients` et `expeditions`, ainsi que la fonction
  `generate_numero_serie`).
- Installer la CLI Supabase : `npm install -g supabase` (ou `scoop install supabase` sur Windows).
- Avoir un compte Stripe (mode test pour commencer).

## 2. Lier le projet et déployer la fonction

```bash
supabase login
supabase link --project-ref <votre-ref-projet-supabase>
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` est nécessaire car Stripe appelle ce endpoint sans jeton
Supabase — la sécurité est assurée par la vérification de signature Stripe
dans le code de la fonction.

## 3. Configurer les secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées automatiquement
par Supabase dans les Edge Functions, pas besoin de les définir.

## 4. Créer le endpoint webhook côté Stripe

1. Dashboard Stripe → **Développeurs → Webhooks → Ajouter un endpoint**.
2. URL : `https://<votre-ref-projet>.supabase.co/functions/v1/stripe-webhook`
3. Événement à écouter : `checkout.session.completed`
4. Copier le **signing secret** (`whsec_...`) généré et le mettre dans
   `STRIPE_WEBHOOK_SECRET` (étape 3).

## 5. Tester

```bash
stripe listen --forward-to https://<votre-ref-projet>.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

Une nouvelle carte doit apparaître dans la colonne "À expédier" de la page
Expédition, avec le badge **Stripe**.

## 6. Notes

- Le webhook est idempotent : si Stripe renvoie le même événement plusieurs
  fois, la contrainte `UNIQUE` sur `stripe_session_id` empêche les doublons.
- Pour que Stripe fournisse une adresse de livraison, l'option **Collect
  shipping address** doit être activée sur la Checkout Session côté site
  e-commerce (ou `shipping_address_collection` si vous créez la session via
  l'API Stripe).
- Si le nom du produit acheté correspond à une version de code ou catégorie
  spécifique, vous pouvez enrichir la fonction pour préremplir `version_code`
  / `categorie` à partir des `line_items` de la session (nécessite d'appeler
  `stripe.checkout.sessions.listLineItems(session.id)`).

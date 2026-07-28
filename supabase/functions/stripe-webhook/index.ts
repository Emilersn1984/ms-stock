// Supabase Edge Function (Deno) — Webhook Stripe
//
// Reçoit les événements Stripe "checkout.session.completed" et crée
// automatiquement une expédition en statut "a_expedier" (origine "stripe")
// avec les informations client récupérées depuis Stripe.
//
// Déploiement :
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Variables d'environnement à configurer (supabase secrets set) :
//   STRIPE_SECRET_KEY        clé secrète Stripe (sk_live_... / sk_test_...)
//   STRIPE_WEBHOOK_SECRET    secret de signature du endpoint webhook (whsec_...)
//   SUPABASE_URL             (fourni automatiquement par Supabase)
//   SUPABASE_SERVICE_ROLE_KEY  clé service_role (fournie automatiquement par Supabase)

import Stripe from 'https://esm.sh/stripe@14?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Mappe les locales Stripe vers les codes de langue utilisés dans l'app
function mapLangue(locale: string | null | undefined): string | null {
  if (!locale) return null
  const code = locale.split('-')[0].toLowerCase()
  const supportees = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt']
  return supportees.includes(code) ? code : null
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    if (!signature) throw new Error('Signature Stripe manquante')
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Signature webhook invalide :', err)
    return new Response('Signature invalide', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Récupère l'adresse de livraison si disponible, sinon l'adresse de facturation
    const details = session.customer_details
    const shipping = (session as unknown as { shipping_details?: Stripe.Checkout.Session.ShippingDetails }).shipping_details
    const adresseSource = shipping?.address ?? details?.address ?? null
    const nomComplet = shipping?.name ?? details?.name ?? ''
    const [prenom, ...resteNom] = nomComplet.trim().split(' ')
    const nom = resteNom.join(' ') || prenom || ''

    const { error } = await supabase.from('expeditions').insert({
      statut: 'a_expedier',
      origine: 'stripe',
      stripe_session_id: session.id,
      nom_destinataire: nom || nomComplet || 'Client Stripe',
      prenom_destinataire: nomComplet && nom ? prenom : '',
      langue: mapLangue(session.locale),
      adresse: adresseSource
        ? [adresseSource.line1, adresseSource.line2].filter(Boolean).join(' ')
        : null,
      ville: adresseSource?.city ?? null,
      code_postal: adresseSource?.postal_code ?? null,
      pays: adresseSource?.country ?? null,
      commentaire: details?.email ? `Email client : ${details.email}` : null,
    })

    if (error) {
      // Si la session existe déjà (contrainte UNIQUE sur stripe_session_id),
      // on ignore l'erreur pour rendre le webhook idempotent.
      if (!error.message.includes('duplicate key')) {
        console.error('Erreur insertion expedition Stripe :', error)
        return new Response('Erreur interne', { status: 500 })
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

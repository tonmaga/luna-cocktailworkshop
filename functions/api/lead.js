/**
 * POST /api/lead
 *
 * Verwerkt een workshopaanvraag:
 *   1. valideert en controleert op spam (honeypot + Turnstile)
 *   2. mailt de aanvraag naar Luna
 *   3. stuurt het lead-event naar Meta Conversions API
 *
 * Fail fast: elke ontbrekende voorwaarde geeft direct een foutstatus.
 * De browser toont dan het WhatsApp-alternatief.
 *
 * Vereiste omgevingsvariabelen (Cloudflare Pages → Settings → Environment variables):
 *   TURNSTILE_SECRET   Cloudflare Turnstile secret key
 *   RESEND_API_KEY     API key van resend.com voor het versturen van mail
 *   MAIL_NAAR          mailadres van Luna, bijv. info@cafeluna-delft.nl
 *   MAIL_VAN           geverifieerd afzenderadres, bijv. aanvraag@cafeluna-delft.nl
 *   META_PIXEL_ID      je Meta pixel-ID
 *   META_CAPI_TOKEN    Conversions API access token
 */

export async function onRequestPost({ request, env }) {
  const lead = await request.json();

  // --- 1. Spamcontrole -----------------------------------------------------
  // Honeypot: alleen bots vullen een onzichtbaar veld in.
  if (lead.website) return json({ ok: true }, 200); // stil laten slagen, bot leert niets

  await verifieerTurnstile(lead['cf-turnstile-response'], env.TURNSTILE_SECRET,
                           request.headers.get('CF-Connecting-IP'));

  // --- 2. Validatie --------------------------------------------------------
  for (const veld of ['naam', 'telefoon', 'email', 'personen', 'datum']) {
    if (!lead[veld]) throw new Error(`Verplicht veld ontbreekt: ${veld}`);
  }

  // --- 3. Mail naar Luna ---------------------------------------------------
  await stuurMail(lead, env);

  // --- 4. Meta Conversions API ---------------------------------------------
  // Server-side event met hetzelfde event_id als de pixel, zodat Meta
  // dedupliceert. Vangt de 20-40% aan events die adblockers en iOS blokkeren.
  await stuurNaarMeta(lead, request, env);

  return json({ ok: true }, 200);
}

// -------------------------------------------------------------------------

async function verifieerTurnstile(token, secret, ip) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip })
  });
  const data = await res.json();
  if (!data.success) throw new Error('Turnstile-verificatie mislukt');
}

async function stuurMail(lead, env) {
  const regels = [
    ['Naam', lead.naam],
    ['Telefoon', lead.telefoon],
    ['E-mail', lead.email],
    ['Aantal personen', lead.personen],
    ['Voorkeursdatum', lead.datum],
    ['Soort uitje', lead.soort || 'niet opgegeven'],
    ['Bron', lead.bron],
    ['Paginavariant', lead.paginavariant],
    ['GCLID', lead.gclid || '—'],
    ['Lead-ID', lead.event_id]
  ];

  const html = `
    <h2>Nieuwe workshopaanvraag</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">
      ${regels.map(([k, v]) =>
        `<tr><td style="background:#f4f4f4"><b>${k}</b></td><td>${escapeHtml(String(v))}</td></tr>`
      ).join('')}
    </table>
    <p style="font-family:sans-serif;color:#666">
      Bel of app binnen 24 uur — snelheid van opvolging bepaalt of deze aanvraag een boeking wordt.
    </p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.MAIL_VAN,
      to: env.MAIL_NAAR,
      reply_to: lead.email,
      subject: `Workshopaanvraag: ${lead.naam} — ${lead.personen} personen — ${lead.datum}`,
      html
    })
  });

  if (!res.ok) throw new Error(`Mail versturen mislukt: ${await res.text()}`);
}

async function stuurNaarMeta(lead, request, env) {
  const gebruiker = {
    em: [await hash(lead.email.trim().toLowerCase())],
    ph: [await hash(normaliseerTelefoon(lead.telefoon))],
    fn: [await hash(lead.naam.trim().split(' ')[0].toLowerCase())],
    client_ip_address: request.headers.get('CF-Connecting-IP'),
    client_user_agent: request.headers.get('User-Agent'),
    country: [await hash('nl')]
  };
  if (lead.fbp) gebruiker.fbp = lead.fbp;
  if (lead.fbc) gebruiker.fbc = lead.fbc;
  else if (lead.fbclid) gebruiker.fbc = `fb.1.${Date.now()}.${lead.fbclid}`;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${env.META_CAPI_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: lead.event_id,          // deduplicatie met de browser-pixel
          action_source: 'website',
          event_source_url: request.headers.get('Referer'),
          user_data: gebruiker,
          custom_data: {
            currency: 'EUR',
            value: 100,
            content_category: lead.soort || lead.paginavariant
          }
        }]
      })
    }
  );

  if (!res.ok) throw new Error(`Meta CAPI mislukt: ${await res.text()}`);
}

// --- hulpfuncties ---------------------------------------------------------

async function hash(waarde) {
  const bytes = new TextEncoder().encode(waarde);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function normaliseerTelefoon(nummer) {
  const cijfers = nummer.replace(/\D/g, '');
  if (cijfers.startsWith('31')) return cijfers;
  if (cijfers.startsWith('0')) return '31' + cijfers.slice(1);
  return cijfers;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

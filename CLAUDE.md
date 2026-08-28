# Café Luna — Cocktailworkshop landingspagina

Landingspagina voor cocktailworkshops bij Café Luna, Markt 69 Delft.
Doel: zoveel mogelijk workshopaanvragen tegen zo laag mogelijke kosten per boeking,
via Google Ads en Meta.

## Stack

- Statische HTML, één bestand: `index.html`
- Cloudflare Pages (hosting + CDN + HTTPS)
- Cloudflare Pages Functions voor de formulierafhandeling: `functions/api/lead.js`
- Resend voor het versturen van de aanvraagmail
- Geen build step, geen framework, geen dependencies

## Architectuurregels

- **Geen build tooling toevoegen.** De pagina is bewust één bestand. Als iets een
  bundler nodig heeft, hoort het hier niet.
- **Eén correct pad.** Geen fallbacks, geen alternatieve routes. Faalt de
  formulier-POST, dan ziet de bezoeker een foutmelding met een mailto-link naar
  cocktailbarlunadelft@gmail.com, met de ingevulde gegevens al in de conceptmail.
  (Café Luna heeft geen bruikbaar WhatsApp-/telefoonnummer: er is geen 06-nummer,
  en het 015-nummer verwijst via een bandje terug naar dit formulier — daarom zijn
  alle WhatsApp- en bel-knoppen uit de pagina gehaald.)
- **Fail fast in de Function.** Ontbrekende omgevingsvariabelen of validatiefouten
  gooien direct een error. Niet stil doorgaan.
- **Elke functie doet één ding.** `stuurMail`, `stuurNaarMeta`, `verifieerTurnstile`
  blijven gescheiden.
- **Tags nooit hardcoden in de pagina.** Alles gaat via `dataLayer` naar GTM.
  Uitzondering: de Consent Mode v2-defaults, die moeten vóór GTM laden.

## Tracking-contract

De pagina pusht deze events naar `dataLayer`. Wijzig de namen niet zonder de
GTM-container mee aan te passen — triggers matchen op exacte naam.

| Event | Wanneer | Payload |
|---|---|---|
| `lead_formulier` | Formulier succesvol verzonden | `event_id`, `waarde`, `variant`, `personen`, `soort_uitje` |
| `formulier_gestart` | Eerste invoer in het formulier | — |
| `scroll_diepte` | 50% en 75% | `diepte` |
| `faq_geopend` | FAQ-item uitgeklapt | `vraag` |
| `formulier_fout` | POST mislukt | `status` |

**`event_id` is kritiek.** Hetzelfde ID gaat naar de Meta-pixel (browser) en naar
de Conversions API (server). Zonder deduplicatie telt Meta elke lead dubbel en
rapporteert een CPL die de helft te laag is.

## Doelgroepvarianten

Eén pagina, drie boodschappen via URL-parameter:

- `/` → standaard
- `/?d=bedrijf` → bedrijfsuitje
- `/?d=vrijgezellen` → vrijgezellenfeest
- `/?d=verjaardag` → verjaardag

De variant past hero-titel, subtekst, page title en de voorselectie van
"soort uitje" aan, en gaat mee als `paginavariant` in de lead.

## Omgevingsvariabelen

Zet deze in Cloudflare Pages → Settings → Environment variables (production).
Niet in de repo, niet in `.env` committen.

```
TURNSTILE_SECRET
RESEND_API_KEY
MAIL_NAAR
MAIL_VAN
META_PIXEL_ID
META_CAPI_TOKEN
```

## Placeholders die nog vervangen moeten worden

GTM-container-ID (`GTM-P34MFTWB`) staat er al in. Nog te doen, zoek op `XXXX`
in `index.html`:

- Cookiebot `data-cbid`
- Turnstile `data-sitekey`

Inhoudelijk nog te verifiëren bij de klant:

- Prijs `€ 32,50` is een aanname
- Reviews zijn expliciet als voorbeeld gemarkeerd — vervangen door echte
  Google-reviews met toestemming
- Reviewscore 4,6 / 300+ verifiëren
- Foto's ontbreken; de hero heeft echt beeld nodig

## Commando's

```bash
npm run dev      # lokaal draaien met Functions op localhost:8788
npm run deploy   # handmatig deployen naar Cloudflare Pages
```

Normaal deploy je via git push — Cloudflare Pages bouwt automatisch bij elke
commit op `main`.

## Werkafspraken

- Werk in kleine, gerichte commits. Eén onderwerp per commit.
- Test het formulier na elke wijziging aan `lead.js` met een echte testaanvraag.
- Controleer na tracking-wijzigingen in Meta Events Manager → Test Events dat er
  **één** Lead binnenkomt, niet twee.
- Draai PageSpeed Insights (mobiel) na wijzigingen aan de hero of aan scripts.
  LCP moet onder 2,5s blijven.

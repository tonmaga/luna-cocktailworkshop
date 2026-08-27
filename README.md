# Luna Cocktailworkshop — landingspagina

Statische landingspagina met serverless formulierafhandeling, Meta Conversions API
en volledige tracking-laag. Gehost op Cloudflare Pages.

## Snel starten

```bash
npm install
cp .dev.vars.example .dev.vars   # vul je eigen keys in
npm run dev                      # draait op http://localhost:8788
```

## Eerste keer live zetten

```bash
# 1. Repo aanmaken en pushen
git init
git add .
git commit -m "Landingspagina cocktailworkshop Luna"
gh repo create luna-cocktailworkshop --private --source=. --push

# 2. Cloudflare Pages koppelen
npx wrangler login
npx wrangler pages project create luna-cocktailworkshop
npm run deploy
```

Daarna in het Cloudflare-dashboard:

1. **Settings → Environment variables**: de zes variabelen uit `.dev.vars.example` zetten
2. **Custom domains**: `workshop.cafeluna-delft.nl` toevoegen, CNAME laten zetten bij de domeinprovider
3. **Settings → Builds**: koppelen aan de GitHub-repo zodat elke push naar `main` automatisch deployt

## Bestanden

```
index.html              De volledige landingspagina, inclusief tracking-laag
functions/api/lead.js   Formulierafhandeling: spamcheck, mail, Meta CAPI
_headers                Security headers en Content-Security-Policy
CLAUDE.md               Projectcontext en architectuurregels
```

## Let op bij de CSP

`_headers` bevat een strikte Content-Security-Policy. Voeg je een nieuw script toe
(een extra tag, een chatwidget), dan moet het domein daar expliciet bij.
Een gebroken CSP breekt je tracking stil — er verschijnt geen zichtbare fout,
alleen minder conversies.

## Voordat dit live gaat

Zie `CLAUDE.md` → "Placeholders die nog vervangen moeten worden".
De prijs, reviews en foto's zijn nog aannames.

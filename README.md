# Metin2 Market Flipper

Publiczny, read-only dashboard rynku Metin2: wyszukiwarka ofert, filtry bonusów,
statystyki cen, historia sklepów i ranking okazji po podatku.

## Architektura

- `frontend/` — React + Vite, publikowany przez GitHub Pages.
- `worker/` — read-only Cloudflare Worker API.
- Cloudflare D1 — zindeksowany, zmaterializowany snapshot rynku.
- `tools/export_public_market.py` — lokalny eksport snapshotu do D1. Dane źródłowe
  i lokalna baza nie są częścią publicznego repozytorium.

Publiczne API: <https://metin2-market-api.bitter-moon-3c49.workers.dev>

## Uruchomienie frontendu

```powershell
cd frontend
npm ci
$env:VITE_API_URL="https://metin2-market-api.bitter-moon-3c49.workers.dev"
npm run dev
```

## API

Najważniejsze endpointy:

- `GET /api/health`
- `GET /api/market-filters`
- `GET /api/market-search?q=&category=&realm=&stat=`
- `GET /api/flipper`
- `GET /api/stats`
- `GET /api/item?vnum=`
- `GET /api/merchants`
- `GET /api/merchant?merchant_id=`

API nie ma publicznych endpointów zapisu. Aktualizacja danych odbywa się poza
publicznym request path przez kontrolowany import snapshotu.

## Licencja

MIT. Projekt nie jest powiązany z Gameforge ani Webzen.

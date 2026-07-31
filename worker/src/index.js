const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json; charset=utf-8',
}

function json(body, status = 200, cache = 30) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'cache-control': `public, max-age=${cache}, s-maxage=${cache}` },
  })
}

function number(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : fallback
}

function parseRows(result) {
  return (result?.results || []).map((row) => JSON.parse(row.payload_json))
}

async function meta(db, key, fallback) {
  const row = await db.prepare('SELECT value_json FROM public_meta WHERE key=?').bind(key).first()
  return row ? JSON.parse(row.value_json) : fallback
}

function statRules(params) {
  return params.getAll('stat').slice(0, 8).map((raw) => {
    const [key, min, max] = raw.split('|')
    return { key: key?.trim(), min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) }
  }).filter((rule) => rule.key)
}

async function marketSearch(db, url) {
  const params = url.searchParams
  const where = []
  const bind = []
  const q = (params.get('q') || '').trim().toLocaleLowerCase()
  if (q) {
    if (/^\d+$/.test(q)) {
      where.push('(l.vnum=? OR l.name_search LIKE ?)')
      bind.push(Number(q), `%${q}%`)
    } else {
      where.push('l.name_search LIKE ?')
      bind.push(`%${q}%`)
    }
  }
  if (params.get('category')) { where.push('l.category_key=?'); bind.push(params.get('category')) }
  if (params.get('realm')) { where.push('l.realm_key=?'); bind.push(params.get('realm')) }
  if (params.get('price_min')) { where.push('l.unit_price>=?'); bind.push(number(params.get('price_min'))) }
  if (params.get('price_max')) { where.push('l.unit_price<=?'); bind.push(number(params.get('price_max'))) }

  const rules = statRules(params)
  const statParts = rules.map((rule) => {
    const checks = ['b.listing_id=l.id', 'b.bonus_key=?']
    bind.push(rule.key)
    if (Number.isFinite(rule.min)) { checks.push('b.value>=?'); bind.push(rule.min) }
    if (Number.isFinite(rule.max)) { checks.push('b.value<=?'); bind.push(rule.max) }
    return `EXISTS (SELECT 1 FROM public_listing_bonuses b WHERE ${checks.join(' AND ')})`
  })
  if (statParts.length) where.push(`(${statParts.join(params.get('stat_mode') === 'any' ? ' OR ' : ' AND ')})`)

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const sort = params.get('sort') || 'price_asc'
  const order = {
    price_asc: 'l.unit_price ASC, l.id ASC',
    price_desc: 'l.unit_price DESC, l.id ASC',
    latest: 'l.observed_at DESC, l.id ASC',
    name: 'l.name_search ASC, l.unit_price ASC',
    bonus_desc: rules[0]
      ? `(SELECT MAX(value) FROM public_listing_bonuses bx WHERE bx.listing_id=l.id AND bx.bonus_key='${rules[0].key.replaceAll("'", "''")}') DESC, l.unit_price ASC`
      : 'l.unit_price ASC, l.id ASC',
  }[sort] || 'l.unit_price ASC, l.id ASC'
  const limit = number(params.get('limit'), 50, 100)
  const offset = number(params.get('offset'), 0, 1_000_000)
  const count = db.prepare(`SELECT COUNT(*) total FROM public_listings l ${clause}`).bind(...bind)
  const rows = db.prepare(`SELECT l.payload_json FROM public_listings l ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...bind, limit, offset)
  const [countResult, rowsResult] = await db.batch([count, rows])
  return { rows: parseRows(rowsResult), total: countResult.results[0]?.total || 0, limit, offset }
}

async function stats(db, url) {
  const params = url.searchParams
  const where = []
  const bind = []
  const q = (params.get('q') || '').trim().toLocaleLowerCase()
  if (q) {
    if (/^\d+$/.test(q)) { where.push('(vnum=? OR name_search LIKE ?)'); bind.push(Number(q), `%${q}%`) }
    else { where.push('name_search LIKE ?'); bind.push(`%${q}%`) }
  }
  if (params.get('realm')) { where.push('realm_key=?'); bind.push(params.get('realm')) }
  const limit = number(params.get('limit'), 100, 1000)
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return parseRows(await db.prepare(`SELECT payload_json FROM public_market_stats ${clause} ORDER BY listings DESC, median_unit_price ASC LIMIT ?`).bind(...bind, limit).all())
}

async function flips(db, url, type) {
  const params = url.searchParams
  const where = ['flip_type=?']
  const bind = [type]
  const numeric = [
    ['min_profit', 'profit_per_item>=?'], ['min_margin', 'margin_pct>=?'],
    ['min_confidence', 'confidence>=?'], ['min_listings', 'listings>=?'],
    ['max_buy', 'current_price<=?'], ['min_sales', 'estimated_sales_30d>=?'],
  ]
  for (const [key, sql] of numeric) {
    const value = number(params.get(key), 0)
    if (value) { where.push(sql); bind.push(value) }
  }
  if (params.get('realm') && type === 'local') { where.push('realm_key=?'); bind.push(params.get('realm')) }
  const q = (params.get('q') || '').trim().toLocaleLowerCase()
  if (q) { where.push('name_search LIKE ?'); bind.push(`%${q}%`) }
  const order = {
    profit: 'total_profit DESC', profit_item: 'profit_per_item DESC',
    margin: 'margin_pct DESC', confidence: 'confidence DESC',
    liquidity: 'liquidity_score DESC', price: 'current_price ASC',
  }[params.get('sort')] || 'opportunity_score DESC'
  const limit = number(params.get('limit'), 100, 500)
  return parseRows(await db.prepare(`SELECT payload_json FROM public_flips WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`).bind(...bind, limit).all())
}

async function item(db, url) {
  const params = url.searchParams
  const vnum = number(params.get('vnum'))
  if (!vnum) return json({ ok: false, error: 'vnum is required' }, 400, 0)
  const marketKey = params.get('market_key') || ''
  const realm = params.get('realm') || ''
  const where = ['vnum=?']
  const bind = [vnum]
  if (marketKey) { where.push('market_key=?'); bind.push(marketKey) }
  if (realm) { where.push('realm_key=?'); bind.push(realm) }
  const offerLimit = number(params.get('offer_limit'), 50, 100)
  const offerOffset = number(params.get('offer_offset'), 0, 100_000)
  const [variantsResult, countResult, offersResult] = await db.batch([
    db.prepare('SELECT payload_json FROM public_market_stats WHERE vnum=? ORDER BY listings DESC, median_unit_price ASC').bind(vnum),
    db.prepare(`SELECT COUNT(*) total FROM public_listings WHERE ${where.join(' AND ')}`).bind(...bind),
    db.prepare(`SELECT payload_json FROM public_listings WHERE ${where.join(' AND ')} ORDER BY unit_price ASC LIMIT ? OFFSET ?`).bind(...bind, offerLimit, offerOffset),
  ])
  const variants = parseRows(variantsResult)
  const offers = parseRows(offersResult)
  const selected = variants.find((row) => !marketKey || row.market_key === marketKey) || variants[0] || offers[0] || {}
  const allBonuses = offers.flatMap((offer) => offer.bonuses || [])
  const allSockets = offers.flatMap((offer) => offer.sockets || [])
  const frequency = (values, label) => Object.values(values.reduce((out, value) => {
    const name = label(value)
    if (name) out[name] = { name, count: (out[name]?.count || 0) + 1 }
    return out
  }, {})).sort((a, b) => b.count - a.count).slice(0, 20)
  const base = {
    ...selected, vnum, variants, active_offer_count: countResult.results[0]?.total || 0,
    cheapest_offer: offers[0] || null,
    common_bonuses: frequency(allBonuses, (bonus) => `${bonus.name || `Bonus #${bonus.type}`} ${bonus.value || ''}`.trim()),
    common_sockets: frequency(allSockets, (socket) => socket.name || (socket.vnum ? `VNUM ${socket.vnum}` : '')),
  }
  return json({ item: base, offers, offer_total: base.active_offer_count, offer_limit: offerLimit, offer_offset: offerOffset, history: [] }, 200, 30)
}

async function merchants(db, url) {
  const q = (url.searchParams.get('q') || '').trim().toLocaleLowerCase()
  const limit = number(url.searchParams.get('limit'), 200, 1000)
  const result = q
    ? await db.prepare('SELECT payload_json FROM public_merchants WHERE owner_search LIKE ? ORDER BY observed_at DESC LIMIT ?').bind(`%${q}%`, limit).all()
    : await db.prepare('SELECT payload_json FROM public_merchants ORDER BY observed_at DESC LIMIT ?').bind(limit).all()
  return parseRows(result)
}

async function merchant(db, url) {
  const id = number(url.searchParams.get('merchant_id'))
  const merchantRow = await db.prepare('SELECT payload_json FROM public_merchants WHERE id=?').bind(id).first()
  if (!merchantRow) return json({ ok: false, error: 'merchant not found' }, 404, 0)
  const merchant = JSON.parse(merchantRow.payload_json)
  const items = parseRows(await db.prepare('SELECT payload_json FROM public_listings WHERE merchant_id=? ORDER BY slot').bind(id).all())
  const stateId = items[0]?.state_id || merchant.state_id || 0
  const selected = { id: stateId, merchant_id: id, item_count: items.length, total_price: items.reduce((sum, item) => sum + Number(item.price || 0), 0) }
  const timeline = [{ id: stateId, state_id: stateId, shop_vid: merchant.shop_vid, shop_name: merchant.shop_name, x: merchant.x, y: merchant.y, observed_at: merchant.observed_at, item_count: items.length, total_price: selected.total_price }]
  return json({ merchant, selected_state: selected, timeline, items }, 200, 30)
}

async function route(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'GET') return json({ ok: false, error: 'read-only API' }, 405, 0)
  const url = new URL(request.url)
  if (url.pathname === '/' || url.pathname === '/api/health' || url.pathname === '/health') {
    return json({ ok: true, service: 'metin2-market-api', mode: 'read-only', as_of: await meta(env.DB, 'as_of', '') }, 200, 10)
  }
  if (url.pathname === '/api/market-filters') return json({ ok: true, ...await meta(env.DB, 'facets', {}) }, 200, 300)
  if (url.pathname === '/api/market-search') return json(await marketSearch(env.DB, url), 200, 30)
  if (url.pathname === '/api/stats') return json(await stats(env.DB, url), 200, 60)
  if (url.pathname === '/api/flipper') return json(await flips(env.DB, url, 'local'), 200, 30)
  if (url.pathname === '/api/flipper-cross') return json(await flips(env.DB, url, 'cross_realm'), 200, 30)
  if (url.pathname === '/api/dashboard-summary') return json(await meta(env.DB, 'summary', {}), 200, 60)
  if (url.pathname === '/api/item') return item(env.DB, url)
  if (url.pathname === '/api/merchants') return json(await merchants(env.DB, url), 200, 30)
  if (url.pathname === '/api/merchant') return merchant(env.DB, url)
  return json({ ok: false, error: 'not found' }, 404, 0)
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const cacheable = request.method === 'GET' && url.pathname.startsWith('/api/')
    if (!cacheable) return route(request, env)
    const cache = caches.default
    const hit = await cache.match(request)
    if (hit) return hit
    const response = await route(request, env)
    if (response.ok) ctx.waitUntil(cache.put(request, response.clone()))
    return response
  },
}


// -------- CONFIG --------
const GOLD_API_URL = 'https://goldapi-my1rlotopzv3-io'; // set your exact endpoint

// FX (browser fetch) — robust to any base the provider returns
const FX_API_URL = 'https://api.exchangerate.host/latest';

// Fallback (approx)
const FX_FALLBACK = {
  base: 'USD',
  rates: {
    USD: 1,
    AED: 3.6725,
    INR: 84.0,
    EUR: 0.93,
    GBP: 0.79,
    CNY: 7.10,
    SAR: 3.75,
    AUD: 1.51,
    CAD: 1.37,
    PKR: 279.0
  }
};
let usingFxFallback = false;

// Constants
const OZ_TO_GRAM = 31.1034768;

// Cached data
let gold = null;  // raw payload from GOLD_API_URL
let fx = null;    // { base: 'XXX', rates: { USD:1, INR:84, ... } }

// Utils
const fmt = (n, c='USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n); }
  catch { return (c + ' ' + Number(n||0).toFixed(2)); }
};

const lastUpdateText = (tsSec) => {
  const now = Date.now();
  const t = (tsSec || (Date.now()/1000)) * 1000;
  const diffMin = Math.max(0, Math.round((now - t)/60000));
  return diffMin <= 1 ? 'just now' : `${diffMin} minutes ago`;
};

// Convert an amount denominated in USD to target currency using an arbitrary-base FX table
function toCurrency(amountUSD, ccy) {
  if (!fx || !fx.rates) return amountUSD;
  if (ccy === 'USD') return amountUSD;

  const r = fx.rates;
  // If USD is the base (or treated as base with 1), multiply directly
  if (fx.base === 'USD' || r.USD === 1) return amountUSD * (r[ccy] ?? 1);

  // Generic: target = amountUSD * (rate[target] / rate[USD])
  if (!r.USD || !r[ccy]) return amountUSD;
  return amountUSD * (r[ccy] / r.USD);
}

async function fetchGold() {
  try {
    const res = await fetch(GOLD_API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Gold API error');
    gold = await res.json();
  } catch (e) {
    console.error('Gold fetch failed; using fallback', e);
    // Fallback (USD) — keep keys same as your worker
    gold = {
      timestamp: 1762160856,
      price: 4022.36,     // /oz (USD)
      ch: 19.96,          // absolute change
      chp: 0.5,           // percent change
      open_price: 4002.4,
      low_price: 3962.625,
      high_price: 4028.04,
      price_gram_24k: 129.3219,
      price_gram_22k: 118.5451,
      price_gram_21k: 113.1566,
      price_gram_20k: 107.7682,
      price_gram_18k: 96.9914,
      price_gram_16k: 86.2146,
      price_gram_14k: 75.4378,
      price_gram_10k: 53.8841
    };
  }
}

async function fetchFx() {
  try {
    const symbols = 'USD,AED,INR,EUR,GBP,CNY,SAR,AUD,CAD,PKR';
    const res = await fetch(`${FX_API_URL}?symbols=${symbols}&base=USD`, { cache: 'no-store' });
    if (!res.ok) throw new Error('FX API error');
    const data = await res.json();
    if (!data || !data.rates || Object.keys(data.rates).length === 0) throw new Error('Empty FX');
    fx = { base: data.base || 'USD', rates: data.rates };
    usingFxFallback = false;
  } catch (e) {
    console.warn('FX fetch failed; using fallback', e);
    fx = { ...FX_FALLBACK };
    usingFxFallback = true;
  }
}

function pricePerGramForKaratUSD(karat) {
  const key = `price_gram_${karat}k`;
  if (gold && gold[key] != null) return gold[key]; // USD/g
  const perGram24 = (gold?.price || 0) / OZ_TO_GRAM; // USD/g
  return karat === 24 ? perGram24 : perGram24 * (karat / 24);
}

function unitToGrams(weight, unit) {
  if (unit === 'g')  return weight;
  if (unit === 'kg') return weight * 1000;
  if (unit === 'oz') return weight * OZ_TO_GRAM;
  return weight;
}

function sentimentFromChange() {
  if (!gold) return '—';
  if (gold.ch > 0) return 'Bullish';
  if (gold.ch < 0) return 'Bearish';
  return 'Neutral';
}

// Set a green/red/neutral badge using utility classes (no custom CSS needed)
function setDeltaPill(el, chp) {
  if (!el) return;
  const up = Number(chp) > 0, down = Number(chp) < 0;
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  if (up) {
    el.className = base + ' text-green-700 bg-green-50';
    el.textContent = `▲ ${Number(chp).toFixed(2)}%`;
  } else if (down) {
    el.className = base + ' text-red-700 bg-red-50';
    el.textContent = `▼ ${Number(chp).toFixed(2)}%`;
  } else {
    el.className = 'text-xs text-gray-500';
    el.textContent = '● 0.00%';
  }
}

function updateUI() {
  const ccySel = document.getElementById('currency');
  const ccy = ccySel ? ccySel.value : 'USD';

  if (!gold || !fx) return;

  // Numbers (converted from USD)
  const g24 = toCurrency(gold.price_gram_24k, ccy);
  const g22 = toCurrency(gold.price_gram_22k, ccy);
  const g18 = toCurrency(gold.price_gram_18k, ccy);
  const g14 = toCurrency(gold.price_gram_14k, ccy);
  const spot = toCurrency(gold.price, ccy);
  const open = toCurrency(gold.open_price, ccy);
  const high = toCurrency(gold.high_price, ccy);
  const low  = toCurrency(gold.low_price, ccy);

  // Hero stats
  const el24 = document.getElementById('stat-24k');
  const el22 = document.getElementById('stat-22k');
  const elSpot = document.getElementById('stat-spot');
  if (el24)  el24.textContent  = fmt(g24, ccy) + ' / g';
  if (el22)  el22.textContent  = fmt(g22, ccy) + ' / g';
  if (elSpot) elSpot.textContent = fmt(spot, ccy) + ' / oz';

  setDeltaPill(document.getElementById('stat-spot-ch'), gold.chp);

  // Live cards
  const map = [
    ['card-24k', g24], ['card-22k', g22], ['card-18k', g18], ['card-14k', g14]
  ];
  map.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(val, ccy) + ' / g';
  });
  ['card-24k-ch','card-22k-ch','card-18k-ch','card-14k-ch'].forEach(id => {
    setDeltaPill(document.getElementById(id), gold.chp);
  });

  // Market stats
  const elOpen = document.getElementById('stat-open');
  const elHigh = document.getElementById('stat-high');
  const elLow  = document.getElementById('stat-low');
  if (elOpen) elOpen.textContent = fmt(open, ccy) + ' / oz';
  if (elHigh) elHigh.textContent = fmt(high, ccy) + ' / oz';
  if (elLow)  elLow.textContent  = fmt(low,  ccy) + ' / oz';

  const elSent = document.getElementById('sentiment');
  if (elSent) elSent.textContent = sentimentFromChange();

  // Update last update
  const elLast = document.getElementById('last-update');
  if (elLast) elLast.textContent = lastUpdateText(gold.timestamp);

  // FX note
  const fxNoteEl = document.getElementById('fx-note');
  if (fxNoteEl) fxNoteEl.textContent = usingFxFallback
    ? 'Converted using fallback FX rates (approx).'
    : `Converted from ${fx.base} via live FX.`;
}

function handleCalculator() {
  const btn = document.getElementById('btn-calc');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const karat = parseInt(document.getElementById('calc-karat').value, 10);
    const weight = parseFloat(document.getElementById('calc-weight').value || '0');
    const unit = document.getElementById('calc-unit').value;
    const ccy = document.getElementById('calc-currency').value;

    if (!weight || weight <= 0) {
      document.getElementById('calc-result').textContent = 'Enter a valid weight.';
      return;
    }
    const grams = unitToGrams(weight, unit);
    const perGramUSD = pricePerGramForKaratUSD(karat);
    const totalUSD = grams * perGramUSD;

    const total = toCurrency(totalUSD, ccy);
    const perGramLocal = toCurrency(perGramUSD, ccy);

    document.getElementById('calc-result').textContent =
      `≈ ${fmt(total, ccy)} (${grams.toFixed(3)} g × ${fmt(perGramLocal, ccy)}/g)`;
  });
}

async function init() {
  await Promise.all([fetchGold(), fetchFx()]);
  updateUI();
  handleCalculator();

  const cur = document.getElementById('currency');
  if (cur) cur.addEventListener('change', updateUI);

  // Auto-refresh every 60s
  setInterval(async () => {
    await fetchGold();
    updateUI();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);

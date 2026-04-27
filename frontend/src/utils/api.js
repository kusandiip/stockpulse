import axios from 'axios'

const BASE = '/api'

export const api = {
  getMarketOverview:   ()            => axios.get(`${BASE}/market/overview`).then(r=>r.data),
  getWatchlist:        ()            => axios.get(`${BASE}/stocks/watchlist`).then(r=>r.data),
  searchStocks:        (q)           => axios.get(`${BASE}/stocks/search`,{params:{q}}).then(r=>r.data),
  getStockHistory:     (s,p,i)       => axios.get(`${BASE}/stocks/${encodeURIComponent(s)}/history`,{params:{period:p,interval:i}}).then(r=>r.data),
  getStockInfo:        (s)           => axios.get(`${BASE}/stocks/${encodeURIComponent(s)}/info`).then(r=>r.data),
  getCorrelation:      (syms)        => axios.get(`${BASE}/analysis/correlation`,{params:{symbols:syms}}).then(r=>r.data),
  backtestPortfolio:   (s,w,p)       => axios.get(`${BASE}/portfolio/backtest`,{params:{symbols:s,weights:w,period:p}}).then(r=>r.data),
  getScreener:         (params)      => axios.get(`${BASE}/screener`,{params}).then(r=>r.data),
  getHeatmap:          ()            => axios.get(`${BASE}/heatmap`).then(r=>r.data),
  getPipelineStatus:   ()            => axios.get(`${BASE}/pipeline/status`).then(r=>r.data),
}

export const fmt = {
  price:   (n) => n==null ? 'N/A' : `₹${Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  pct:     (n) => n==null ? 'N/A' : `${n>=0?'+':''}${Number(n).toFixed(2)}%`,
  vol:     (n) => { if(!n) return 'N/A'; if(n>=1e7) return `${(n/1e7).toFixed(2)}Cr`; if(n>=1e5) return `${(n/1e5).toFixed(2)}L`; return n.toLocaleString() },
  cap:     (n) => { if(!n) return 'N/A'; if(n>=1e12) return `₹${(n/1e12).toFixed(2)}T`; if(n>=1e9) return `₹${(n/1e9).toFixed(2)}B`; return `₹${(n/1e7).toFixed(0)}Cr` },
  compact: (n) => n==null ? 'N/A' : Number(n).toFixed(2),
}

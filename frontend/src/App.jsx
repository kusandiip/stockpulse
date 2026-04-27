import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import StockDetail from './pages/StockDetail'
import Screener from './pages/Screener'
import { Heatmap } from './pages/Heatmap'
import Correlation from './pages/Correlation'
import Backtest from './pages/Backtest'
import Pipeline from './pages/Pipeline'
import AIChat from './components/AIChat'
import { useLivePrices } from './hooks/useLivePrices'

export default function App() {
  const [page,          setPage]         = useState('dashboard')
  const [selectedStock, setSelectedStock] = useState('RELIANCE.NS')
  const { prices, connected, marketOpen } = useLivePrices()
  const [marketState, setMarketState] = useState(null)

  // Poll /api/market/state every 60s for honest banner state
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const r = await fetch('/api/market/state')
        if (!r.ok) return
        const data = await r.json()
        if (alive) setMarketState(data)
      } catch {}
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const navigate = (p, stock) => {
    if (stock) setSelectedStock(stock)
    setPage(p)
  }

  // Use server-side market state when available, fall back to WS-derived flag
  const isOpen = marketState ? marketState.open : marketOpen

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg0)' }}>
      <Sidebar page={page} setPage={setPage} connected={connected} marketOpen={isOpen}/>

      <main style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }} className="grid-bg">
        {/* Prominent market status banner */}
        {marketState && !marketState.open && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(255,165,0,.10) 0%, rgba(255,69,96,.06) 100%)',
            borderBottom: '1px solid rgba(255,165,0,.30)',
            padding: '12px 24px',
            color: '#ffb347',
            display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'JetBrains Mono,monospace',
            flexShrink: 0,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 10px', borderRadius: 4, background: 'rgba(255,165,0,.18)',
              border: '1px solid rgba(255,165,0,.40)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffb347', boxShadow: '0 0 8px #ffb347' }}/>
              MARKETS CLOSED
            </span>
            <span style={{ color:'#e8ecf2', fontSize: 13, fontWeight: 500 }}>
              All prices show <strong>last market close</strong>. Numbers will not move until markets reopen.
            </span>
            <span style={{ marginLeft: 'auto', color:'#7a8294', fontSize: 11 }}>
              NSE 09:15–15:30 IST · NYSE 19:00–01:30 IST (next day)
            </span>
          </div>
        )}
        {marketState && marketState.open && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(0,255,136,.06) 0%, rgba(0,229,255,.04) 100%)',
            borderBottom: '1px solid rgba(0,200,150,.30)',
            padding: '12px 24px',
            color: '#00ff88',
            display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'JetBrains Mono,monospace',
            flexShrink: 0,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 10px', borderRadius: 4, background: 'rgba(0,255,136,.16)',
              border: '1px solid rgba(0,255,136,.40)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#00ff88',
                boxShadow: '0 0 8px #00ff88', animation: 'livePulse 1.6s ease-in-out infinite',
              }}/>
              {marketState.label || 'LIVE'}
            </span>
            <span style={{ color:'#e8ecf2', fontSize: 13, fontWeight: 500 }}>
              Live prices streaming &middot; pipeline running every 15 min
            </span>
            {marketState.exchange && (
              <span style={{ marginLeft: 'auto', color:'#7a8294', fontSize: 11 }}>
                ACTIVE EXCHANGE: {marketState.exchange}
              </span>
            )}
          </div>
        )}

        {/* Pages */}
        <div style={{ flex:1 }}>
          {page==='dashboard'   && <Dashboard   prices={prices} navigate={navigate}/>}
          {page==='stock'       && <StockDetail  symbol={selectedStock} prices={prices}/>}
          {page==='screener'    && <Screener/>}
          {page==='heatmap'     && <Heatmap/>}
          {page==='correlation' && <Correlation/>}
          {page==='backtest'    && <Backtest/>}
          {page==='pipeline'    && <Pipeline/>}
        </div>
      </main>

      <AIChat currentSymbol={page==='stock' ? selectedStock : null}/>
    </div>
  )
}

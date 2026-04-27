import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { Filter, TrendingUp, TrendingDown, RefreshCw, Zap, AlertTriangle, Activity } from 'lucide-react'

const SECTORS = ['All','IT','Banking','FMCG','Energy','Pharma','Auto','Finance','Telecom','Metal','Cement','Utilities','Consumer','Infrastructure','Mining','Conglomerate','Tech','Semiconductors','Media']
const SORT_OPTIONS = [{ value:'change_pct', label:'Daily Change' },{ value:'rsi', label:'RSI' },{ value:'vol_ratio', label:'Volume Spike' },{ value:'price', label:'Price' }]
const PRESETS = [
  { label:'🔥 Oversold Bounce', min_rsi:0,  max_rsi:35,  min_change:-100, max_change:100, desc:'RSI < 35 — potential reversal' },
  { label:'🚀 Momentum',        min_rsi:55, max_rsi:75,  min_change:1,    max_change:100, desc:'Strong RSI + positive move' },
  { label:'📉 Overbought',      min_rsi:70, max_rsi:100, min_change:-100, max_change:100, desc:'RSI > 70 — watch for reversal' },
  { label:'💥 Big Movers',      min_rsi:0,  max_rsi:100, min_change:2,    max_change:100, desc:'>2% move today' },
]

function SignalBadge({ signal }) {
  const s = { Overbought:['var(--red2)','var(--red)','var(--red3)'], Oversold:['var(--green2)','var(--green)','var(--green3)'], Neutral:['var(--blue2)','var(--blue)','var(--blue3)'] }[signal] || ['var(--blue2)','var(--blue)','var(--blue3)']
  return <span style={{ padding:'2px 9px', borderRadius:10, fontSize:10, fontWeight:700, fontFamily:'JetBrains Mono,monospace', background:s[0], color:s[1], border:`1px solid ${s[2]}` }}>{signal.toUpperCase()}</span>
}

export default function Screener() {
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [preset,   setPreset]   = useState(null)
  const [filters,  setFilters]  = useState({ min_rsi:0, max_rsi:100, min_change:-20, max_change:20, sector:'All', sort_by:'change_pct' })

  const run = async (f=filters) => {
    setLoading(true)
    try { setResults(await api.getScreener(f)) }
    catch(e){ console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(()=>{ run() },[])

  const applyPreset = (p, i) => {
    const f = { ...filters, min_rsi:p.min_rsi, max_rsi:p.max_rsi, min_change:p.min_change, max_change:p.max_change }
    setFilters(f); setPreset(i); run(f)
  }
  const set = (k,v) => setFilters(p=>({...p,[k]:v}))

  return (
    <div style={{ padding:'26px 28px' }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:27, color:'var(--t1)', letterSpacing:'-.025em', margin:0 }}>Stock Screener</h1>
        <p style={{ color:'var(--t2)', marginTop:5, fontSize:13 }}>Filter 40 NSE & US stocks by RSI, momentum, volume spike and sector</p>
      </div>

      {/* Presets */}
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {PRESETS.map((p,i)=>(
          <button key={i} onClick={()=>applyPreset(p,i)} style={{ padding:'7px 14px', borderRadius:10, cursor:'pointer', fontSize:12.5, fontFamily:'Inter,sans-serif', fontWeight:600, border:'1px solid', background:preset===i?'var(--blue2)':'var(--bg3)', borderColor:preset===i?'var(--blue3)':'var(--b1)', color:preset===i?'var(--blue)':'var(--t2)', transition:'all .14s' }}
            title={p.desc}>{p.label}</button>
        ))}
        {preset!==null && <button onClick={()=>{ setPreset(null); run() }} style={{ padding:'7px 12px', borderRadius:10, cursor:'pointer', fontSize:12, background:'transparent', border:'1px solid var(--b1)', color:'var(--t3)' }}>✕ Clear</button>}
      </div>

      {/* Filter panel */}
      <div className="card" style={{ padding:'18px 20px', marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, alignItems:'end' }}>
          {[{label:'MIN RSI',key:'min_rsi'},{label:'MAX RSI',key:'max_rsi'},{label:'MIN CHG %',key:'min_change'},{label:'MAX CHG %',key:'max_change'}].map(f=>(
            <div key={f.key}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.08em', marginBottom:5 }}>{f.label}</div>
              <input type="number" value={filters[f.key]} onChange={e=>set(f.key,Number(e.target.value))} className="sp-input" style={{ width:'100%', fontSize:13, fontFamily:'JetBrains Mono,monospace', fontWeight:700 }}/>
            </div>
          ))}
          <div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.08em', marginBottom:5 }}>SECTOR</div>
            <select value={filters.sector} onChange={e=>set('sector',e.target.value)} className="sp-input" style={{ width:'100%', fontSize:12 }}>
              {SECTORS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.08em', marginBottom:5 }}>SORT BY</div>
            <select value={filters.sort_by} onChange={e=>set('sort_by',e.target.value)} className="sp-input" style={{ width:'100%', fontSize:12 }}>
              {SORT_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:14, display:'flex', gap:12, alignItems:'center' }}>
          <button onClick={()=>run()} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 20px', borderRadius:10, background:'linear-gradient(135deg,var(--blue),var(--purple))', border:'none', color:'white', fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            <Filter size={13}/>{loading?'Scanning…':'Screen Stocks'}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--t3)' }}>
            {loading?<RefreshCw size={12} className="spin"/>:<Activity size={12}/>}
            {loading?'Fetching live data…':`${results.length} stocks matched`}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card" style={{ overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign:'left', paddingLeft:18 }}>#  SYMBOL</th>
              <th>SECTOR</th>
              <th>PRICE</th>
              <th>CHANGE</th>
              <th>RSI</th>
              <th>VOL SPIKE</th>
              <th>SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {results.length===0 && !loading && (
              <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>No stocks match your filters. Try adjusting the criteria.</td></tr>
            )}
            {results.map((s,i)=>(
              <tr key={s.symbol}>
                <td style={{ paddingLeft:18 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--t3)', minWidth:18 }}>{i+1}</span>
                    <div>
                      <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:12.5, color:'var(--t1)' }}>{s.symbol.replace('.NS','')}</div>
                      <div style={{ fontSize:10.5, color:'var(--t3)' }}>{s.name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'var(--bg4)', color:'var(--t2)' }}>{s.sector}</span>
                </td>
                <td style={{ textAlign:'right' }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:13 }}>₹{s.price}</span>
                </td>
                <td style={{ textAlign:'right' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color:s.change_pct>=0?'var(--green)':'var(--red)' }}>
                    {s.change_pct>=0?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{s.change_pct>=0?'+':''}{s.change_pct}%
                  </span>
                </td>
                <td style={{ textAlign:'right', minWidth:120 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                    <div style={{ width:44, height:4, borderRadius:2, background:'var(--bg4)' }}>
                      <div style={{ height:'100%', width:`${s.rsi}%`, borderRadius:2, background:s.rsi>70?'var(--red)':s.rsi<30?'var(--green)':'var(--blue)', transition:'width .4s' }}/>
                    </div>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color:s.rsi>70?'var(--red)':s.rsi<30?'var(--green)':'var(--t2)', minWidth:28 }}>{s.rsi}</span>
                  </div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:s.vol_ratio>2?'var(--gold)':'var(--t3)', fontWeight:s.vol_ratio>2?700:400 }}>
                    {s.vol_ratio>2?'⚡ ':''}{s.vol_ratio}x
                  </span>
                </td>
                <td style={{ textAlign:'center', paddingRight:16 }}><SignalBadge signal={s.signal}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

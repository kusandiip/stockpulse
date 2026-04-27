import { useEffect, useState } from 'react'
import { api } from '../utils/api'

const DEFAULT = 'RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,ICICIBANK.NS,WIPRO.NS,SBIN.NS'

function getColor(v) {
  if(v>=.8)  return {bg:'rgba(0,200,150,.65)',  text:'#fff'}
  if(v>=.6)  return {bg:'rgba(0,200,150,.38)',  text:'#00c896'}
  if(v>=.4)  return {bg:'rgba(0,200,150,.18)',  text:'#00a87e'}
  if(v>=.2)  return {bg:'rgba(59,130,246,.1)',  text:'var(--t2)'}
  if(v>=0)   return {bg:'rgba(255,255,255,.03)',text:'var(--t3)'}
  if(v>=-.2) return {bg:'rgba(255,69,96,.1)',   text:'#ff9eb0'}
  if(v>=-.5) return {bg:'rgba(255,69,96,.28)',  text:'var(--red)'}
  return          {bg:'rgba(255,69,96,.55)',   text:'#fff'}
}

export default function Correlation() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [symbols, setSymbols] = useState(DEFAULT)

  const load = async () => {
    setLoading(true)
    try { setData(await api.getCorrelation(symbols)) }
    catch(e){ console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  const sn = s => s.replace('.NS','')

  return (
    <div style={{ padding:'26px 28px' }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:27, color:'var(--t1)', letterSpacing:'-.025em', margin:0 }}>Correlation Matrix</h1>
        <p style={{ color:'var(--t2)', marginTop:5, fontSize:13 }}>3-month price correlation · green = strong positive · red = negative correlation</p>
      </div>

      <div className="card" style={{ padding:'18px 20px', marginBottom:20, display:'flex', gap:12, alignItems:'flex-end' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.08em', marginBottom:6 }}>SYMBOLS (comma separated, max 8)</div>
          <input value={symbols} onChange={e=>setSymbols(e.target.value)} className="sp-input" style={{ width:'100%', fontFamily:'JetBrains Mono,monospace', fontSize:12 }}/>
        </div>
        <button onClick={load} style={{ padding:'9px 22px', borderRadius:10, background:'linear-gradient(135deg,var(--blue),var(--purple))', border:'none', color:'white', fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
          Analyze
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--t3)' }}>Computing correlations…</div>
      ) : data && !data.error ? (
        <div className="card" style={{ padding:28, overflowX:'auto' }}>
          <table style={{ borderCollapse:'separate', borderSpacing:5, margin:'0 auto' }}>
            <thead>
              <tr>
                <th style={{ width:90 }}/>
                {data.symbols.map(s=>(
                  <th key={s} style={{ padding:'4px 8px', fontSize:10.5, color:'var(--t2)', fontFamily:'JetBrains Mono,monospace', fontWeight:700, writingMode:'vertical-lr', transform:'rotate(180deg)', textAlign:'left', height:80 }}>{sn(s)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.symbols.map((rs,ri)=>(
                <tr key={rs}>
                  <td style={{ padding:'4px 12px 4px 0', fontSize:10.5, color:'var(--t2)', fontFamily:'JetBrains Mono,monospace', fontWeight:700, textAlign:'right', whiteSpace:'nowrap' }}>{sn(rs)}</td>
                  {data.matrix[ri].map((val,ci)=>{
                    const {bg,text}=getColor(val)
                    return (
                      <td key={ci} style={{ width:58, height:48, textAlign:'center', borderRadius:7, background:bg, fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:12, color:text, cursor:'default', transition:'transform .15s' }}
                        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.12)'}
                        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                        title={`${sn(rs)} × ${sn(data.symbols[ci])}: ${val}`}>
                        {val.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{ display:'flex', gap:14, marginTop:24, justifyContent:'center', flexWrap:'wrap' }}>
            {[{l:'Strong +',p:.9},{l:'Moderate +',p:.5},{l:'Weak',p:.1},{l:'Moderate −',p:-.4},{l:'Strong −',p:-.9}].map(item=>{
              const c=getColor(item.p)
              return (
                <div key={item.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:16,height:14,borderRadius:3,background:c.bg }}/>
                  <span style={{ fontSize:11.5, color:'var(--t2)' }}>{item.l}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--red)', fontSize:13 }}>
          Failed to compute. Try fewer symbols or shorter symbol names.
        </div>
      )}

      <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[
          {icon:'🎯', t:'Diversification', d:'Low correlation reduces portfolio risk. Target correlations below 0.4 across holdings.'},
          {icon:'📊', t:'Sector Clustering', d:'Same-sector stocks move together. Spread across sectors for resilience.'},
          {icon:'⚖️', t:'Hedging Pairs', d:'Negatively correlated assets can naturally offset each other\'s volatility.'},
        ].map(item=>(
          <div key={item.t} className="card" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:22, marginBottom:8 }}>{item.icon}</div>
            <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:6 }}>{item.t}</div>
            <p style={{ fontSize:12.5, color:'var(--t2)', margin:0, lineHeight:1.65 }}>{item.d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

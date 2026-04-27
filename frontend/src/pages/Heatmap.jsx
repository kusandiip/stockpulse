// ── Heatmap ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

function getColor(p) {
  if(p>=3)    return {bg:'rgba(0,200,150,.7)',  text:'#fff',     border:'rgba(0,200,150,.9)'}
  if(p>=1.5)  return {bg:'rgba(0,200,150,.42)', text:'#fff',     border:'rgba(0,200,150,.6)'}
  if(p>=0.5)  return {bg:'rgba(0,200,150,.2)',  text:'#00c896',  border:'rgba(0,200,150,.32)'}
  if(p>=0)    return {bg:'rgba(0,200,150,.07)', text:'#00a87e',  border:'rgba(0,200,150,.14)'}
  if(p>=-0.5) return {bg:'rgba(255,69,96,.07)', text:'#ff6b80',  border:'rgba(255,69,96,.14)'}
  if(p>=-1.5) return {bg:'rgba(255,69,96,.2)',  text:'#fff',     border:'rgba(255,69,96,.32)'}
  if(p>=-3)   return {bg:'rgba(255,69,96,.42)', text:'#fff',     border:'rgba(255,69,96,.6)'}
  return            {bg:'rgba(255,69,96,.7)',   text:'#fff',     border:'rgba(255,69,96,.9)'}
}

export function Heatmap() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState(null)

  const load = async () => {
    setLoading(true)
    try { setData(await api.getHeatmap()); setUpdated(new Date()) }
    catch(e){ console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  const gainers = data.filter(s=>s.avg_change_pct>=0)
  const losers  = data.filter(s=>s.avg_change_pct<0)

  return (
    <div style={{ padding:'26px 28px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:27, color:'var(--t1)', letterSpacing:'-.025em', margin:0 }}>Sector Heatmap</h1>
          <p style={{ color:'var(--t2)', marginTop:5, fontSize:13 }}>Real-time sector performance · hover tiles for details</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {updated && <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10.5, color:'var(--t3)' }}>Updated {updated.toLocaleTimeString()}</span>}
          <button onClick={load} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg3)', border:'1px solid var(--b2)', borderRadius:9, padding:'7px 13px', color:'var(--t2)', cursor:'pointer', fontSize:12 }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue3)';e.currentTarget.style.color='var(--blue)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--b2)';e.currentTarget.style.color='var(--t2)'}}>
            <RefreshCw size={12} className={loading?'spin':''}/> Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:8, marginBottom:22, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'var(--t3)', marginRight:4 }}>Scale:</span>
        {[{l:'>+3%',p:4},{l:'+1.5%',p:2},{l:'+0.5%',p:1},{l:'~0',p:.1},{l:'-0.5%',p:-1},{l:'-1.5%',p:-2},{l:'<-3%',p:-4}].map(item=>{
          const c=getColor(item.p)
          return (
            <div key={item.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:14,height:14,borderRadius:3,background:c.bg,border:`1px solid ${c.border}` }}/>
              <span style={{ fontSize:11, color:'var(--t2)' }}>{item.l}</span>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--t3)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom:12 }}/><br/>Fetching sector data…
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:28 }}>
          {[{title:'Gaining Sectors', color:'var(--green)', icon:TrendingUp, items:gainers}, {title:'Losing Sectors', color:'var(--red)', icon:TrendingDown, items:losers}].map(({title,color,icon:Icon,items})=>(
            <div key={title}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15, color }}>
                <Icon size={15}/>{title}<span style={{ fontSize:11, color:'var(--t3)', fontWeight:400 }}>({items.length})</span>
              </div>
              {items.map(sector => {
                const c = getColor(sector.avg_change_pct)
                return (
                  <div key={sector.sector} style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px', borderRadius:10, background:c.bg, border:`1px solid ${c.border}`, marginBottom:8 }}>
                      <span style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:14, color:c.text }}>{sector.sector}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:c.text, opacity:.7 }}>{sector.count} stocks</span>
                        <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:800, fontSize:15, color:c.text }}>{sector.avg_change_pct>=0?'+':''}{sector.avg_change_pct}%</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {sector.stocks.map(s=>{
                        const sc=getColor(s.change_pct)
                        return (
                          <div key={s.symbol} title={`${s.name}\n₹${s.price}  ${s.change_pct>=0?'+':''}${s.change_pct}%`}
                            style={{ padding:'7px 10px', borderRadius:8, background:sc.bg, border:`1px solid ${sc.border}`, cursor:'default', transition:'transform .15s', minWidth:80 }}
                            onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.08)'; e.currentTarget.style.zIndex='10' }}
                            onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.zIndex='1' }}>
                            <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:800, fontSize:10.5, color:sc.text }}>{s.symbol}</div>
                            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11.5, fontWeight:700, color:sc.text, marginTop:2 }}>{s.change_pct>=0?'+':''}{s.change_pct}%</div>
                            <div style={{ fontSize:9.5, color:sc.text, opacity:.75, marginTop:1 }}>₹{s.price}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

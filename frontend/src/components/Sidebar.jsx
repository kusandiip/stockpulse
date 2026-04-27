import { LayoutDashboard, TrendingUp, GitBranch, BarChart2, Activity, SlidersHorizontal, Map, ChevronRight, Wifi, WifiOff, Circle, Database } from 'lucide-react'

const NAV = [
  { id:'dashboard',   label:'Dashboard',      icon:LayoutDashboard },
  { id:'stock',       label:'Chart Analysis', icon:TrendingUp },
  { id:'screener',    label:'Screener',        icon:SlidersHorizontal, tag:'PRO' },
  { id:'heatmap',     label:'Sector Heatmap',  icon:Map },
  { id:'correlation', label:'Correlation',     icon:GitBranch },
  { id:'backtest',    label:'Backtester',      icon:BarChart2 },
  { id:'pipeline',    label:'Data Pipeline',   icon:Database, tag:'DE' },
]

export default function Sidebar({ page, setPage, connected, marketOpen }) {
  return (
    <aside style={{ width:224, background:'var(--bg1)', borderRight:'1px solid var(--b1)', display:'flex', flexDirection:'column', flexShrink:0 }}>

      {/* Brand */}
      <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--b0)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 14px rgba(59,130,246,.3)' }}>
            <Activity size={17} color="white" strokeWidth={2.5}/>
          </div>
          <div>
            <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:16, color:'var(--t1)', letterSpacing:'-.02em' }}>StockPulse</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.1em' }}>ANALYTICS v3.0</div>
          </div>
        </div>
      </div>

      {/* Connection + Market status */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--b0)', display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:8, background:connected?'var(--green2)':'var(--red2)', border:`1px solid ${connected?'var(--green3)':'var(--red3)'}` }}>
          {connected ? <Wifi size={11} color="var(--green)"/> : <WifiOff size={11} color="var(--red)"/>}
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, fontWeight:700, color:connected?'var(--green)':'var(--red)', letterSpacing:'.05em' }}>
            {connected ? 'LIVE FEED' : 'RECONNECTING'}
          </span>
          {connected && <div style={{ width:5,height:5,borderRadius:'50%',background:'var(--green)',marginLeft:'auto' }} className="live-dot"/>}
        </div>

        {connected && marketOpen !== null && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:7, background:marketOpen?'rgba(0,200,150,.05)':'rgba(255,69,96,.05)', border:`1px solid ${marketOpen?'rgba(0,200,150,.14)':'rgba(255,69,96,.14)'}` }}>
            <Circle size={6} fill={marketOpen?'var(--green)':'var(--red)'} color={marketOpen?'var(--green)':'var(--red)'} className={marketOpen?'live-dot':''}/>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, fontWeight:700, color:marketOpen?'var(--green)':'var(--red)', letterSpacing:'.04em' }}>
              {marketOpen ? 'NSE OPEN' : 'NSE CLOSED'}
            </span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8.5, color:'var(--t3)', marginLeft:'auto' }}>
              {marketOpen ? '● LIVE' : 'LAST CLOSE'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8.5, color:'var(--t3)', fontWeight:700, letterSpacing:'.12em', padding:'4px 10px 8px' }}>NAVIGATION</div>
        {NAV.map(({ id, label, icon:Icon, tag }) => {
          const active = page === id
          return (
            <button key={id} onClick={()=>setPage(id)} style={{
              display:'flex', alignItems:'center', gap:9,
              width:'100%', padding:'9px 10px', borderRadius:9,
              border:'none', cursor:'pointer', marginBottom:1,
              background: active ? 'var(--blue2)' : 'transparent',
              color: active ? 'var(--blue)' : 'var(--t2)',
              fontFamily:'Inter,sans-serif', fontSize:13,
              fontWeight: active ? 600 : 400,
              transition:'all .14s', textAlign:'left',
            }}
            onMouseEnter={e=>{ if(!active){e.currentTarget.style.background='var(--b0)';e.currentTarget.style.color='var(--t1)'} }}
            onMouseLeave={e=>{ if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--t2)'} }}
            >
              <Icon size={14} strokeWidth={active?2.2:1.7}/>
              <span style={{ flex:1 }}>{label}</span>
              {tag && (
                <span className={`badge ${tag==='DE'?'badge-purple':'badge-gold'}`} style={{ fontSize:8 }}>{tag}</span>
              )}
              {active && <ChevronRight size={12} strokeWidth={2.5}/>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:'12px 14px', borderTop:'1px solid var(--b1)', background:'rgba(0,0,0,.15)' }}>
        <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8.5, color:'var(--t3)', letterSpacing:'.1em', marginBottom:8, fontWeight:700 }}>COVERAGE</div>
        {[['NSE Large Cap','30'],['US Stocks','10'],['Indices','4'],['Sectors','14']].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:10.5, color:'var(--t3)' }}>{k}</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--blue)', fontWeight:700 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--b0)', fontSize:10, color:'var(--t3)', lineHeight:1.6 }}>
          Yahoo Finance · NSE India<br/>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9 }}>~15 min delayed · Pipeline: 15 min</span>
        </div>
      </div>
    </aside>
  )
}

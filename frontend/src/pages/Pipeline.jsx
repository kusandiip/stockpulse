import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Database, RefreshCw, CheckCircle, XCircle, Clock, Activity, Layers, ArrowRight, Cpu } from 'lucide-react'

const PIPELINE_STEPS = [
  { id:'extract',   label:'Extract',   icon:'📥', desc:'yfinance fetches OHLCV + fundamentals from Yahoo Finance API for 40 stocks', tech:'yfinance · Yahoo Finance API' },
  { id:'transform', label:'Transform', icon:'⚙️',  desc:'Calculates RSI, MACD, Moving Averages, detects chart patterns, normalizes prices', tech:'pandas · numpy · Python' },
  { id:'load',      label:'Load',      icon:'💾', desc:'Persists snapshots to SQLite (swappable to PostgreSQL) with full audit log', tech:'SQLAlchemy · SQLite / PostgreSQL' },
  { id:'serve',     label:'Serve',     icon:'🚀', desc:'FastAPI streams data to React frontend via REST & WebSocket', tech:'FastAPI · WebSocket · REST API' },
]

const ARCH = [
  { layer:'Data Sources',    items:['Yahoo Finance API','NSE India Archives','Alpha Vantage (optional)'], color:'var(--purple)' },
  { layer:'Ingestion',       items:['yfinance library','APScheduler (15 min)','On-demand API calls'], color:'var(--blue)' },
  { layer:'Processing',      items:['pandas DataFrame','numpy calculations','Pattern detection algo'], color:'var(--gold)' },
  { layer:'Storage',         items:['SQLite (local)','PostgreSQL (prod)','StockSnapshot model'], color:'var(--green)' },
  { layer:'API Layer',       items:['FastAPI REST endpoints','WebSocket live feed','Streaming AI chat'], color:'var(--cyan)' },
  { layer:'Frontend',        items:['React + Recharts','Live price updates','Interactive analytics'], color:'var(--red)' },
]

function StatusBadge({ status }) {
  const s = { success:['var(--green2)','var(--green)','var(--green3)','✓'], failed:['var(--red2)','var(--red)','var(--red3)','✗'] }[status] || ['var(--blue2)','var(--blue)','var(--blue3)','?']
  return <span style={{ padding:'2px 9px', borderRadius:10, fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono,monospace', background:s[0], color:s[1], border:`1px solid ${s[2]}` }}>{s[3]} {status.toUpperCase()}</span>
}

export default function Pipeline() {
  const [status,  setStatus]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [active,  setActive]  = useState(0)

  const load = async () => {
    setLoading(true)
    try { setStatus(await api.getPipelineStatus()) }
    catch(e){ console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  // Animate pipeline steps
  useEffect(()=>{ const t=setInterval(()=>setActive(a=>(a+1)%4),1800); return()=>clearInterval(t) },[])

  return (
    <div style={{ padding:'26px 28px' }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:27, color:'var(--t1)', letterSpacing:'-.025em', margin:0 }}>Data Pipeline</h1>
          <span className="badge badge-purple">DATA ENGINEERING</span>
        </div>
        <p style={{ color:'var(--t2)', fontSize:13 }}>ETL pipeline — Extract → Transform → Load → Serve · Runs every 15 minutes automatically</p>
      </div>

      {/* Live pipeline animation */}
      <div className="card" style={{ padding:'24px', marginBottom:20 }}>
        <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
          <Activity size={16} color="var(--green)"/> ETL Pipeline Flow
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, fontSize:12, color:status?.scheduler_running?'var(--green)':'var(--red)' }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:status?.scheduler_running?'var(--green)':'var(--red)' }} className={status?.scheduler_running?'live-dot':''}/>
            {status?.scheduler_running?'Scheduler RUNNING':'Scheduler OFF'}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {PIPELINE_STEPS.map((step,i)=>(
            <div key={step.id} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ flex:1, padding:'16px', borderRadius:12, border:`2px solid ${active===i?'var(--blue3)':'var(--b1)'}`, background:active===i?'var(--blue2)':'var(--bg3)', transition:'all .4s', cursor:'default' }}>
                <div style={{ fontSize:22, marginBottom:8 }}>{step.icon}</div>
                <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, color:active===i?'var(--blue)':'var(--t1)', marginBottom:5 }}>{step.label}</div>
                <div style={{ fontSize:11.5, color:'var(--t2)', lineHeight:1.55, marginBottom:8 }}>{step.desc}</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:active===i?'var(--blue)':'var(--t3)', padding:'3px 8px', borderRadius:6, background:'rgba(0,0,0,.2)', display:'inline-block' }}>{step.tech}</div>
              </div>
              {i<PIPELINE_STEPS.length-1 && (
                <div style={{ padding:'0 8px', color:active===i?'var(--blue)':'var(--t4)', transition:'color .4s' }}>
                  <ArrowRight size={18} strokeWidth={2.5}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats + Run history */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Stats */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Cpu size={15}/> Pipeline Stats
            <button onClick={load} style={{ marginLeft:'auto', background:'none', border:'1px solid var(--b1)', borderRadius:7, padding:'4px 10px', color:'var(--t2)', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
              <RefreshCw size={11} className={loading?'spin':''}/> Refresh
            </button>
          </div>
          {loading ? <div style={{ color:'var(--t3)', fontSize:13 }}>Loading…</div> : status && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { label:'Total Runs', value:status.pipeline_runs?.length ?? 0, color:'var(--blue)' },
                { label:'Stocks/Run', value:status.pipeline_runs?.[0]?.stocks ?? 0, color:'var(--green)' },
                { label:'Avg Duration', value:`${status.pipeline_runs?.[0]?.duration_sec ?? 0}s`, color:'var(--gold)' },
                { label:'Schedule', value:'15 min', color:'var(--purple)' },
              ].map(item=>(
                <div key={item.label} style={{ padding:'12px 14px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--b1)' }}>
                  <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.07em', marginBottom:5 }}>{item.label}</div>
                  <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:22, color:item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
          {status?.last_snapshot_at && (
            <div style={{ marginTop:12, padding:'10px 12px', borderRadius:9, background:'var(--bg3)', border:'1px solid var(--b1)' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:'var(--t3)', marginBottom:3 }}>LAST SNAPSHOT</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'var(--t2)' }}>{status.last_snapshot_at}</div>
            </div>
          )}
        </div>

        {/* Run history */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Clock size={15}/> Run History (Last 10)
          </div>
          {loading ? <div style={{ color:'var(--t3)', fontSize:13 }}>Loading…</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto' }}>
              {(status?.pipeline_runs || []).map(run=>(
                <div key={run.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, background:'var(--bg3)', border:'1px solid var(--b1)' }}>
                  {run.status==='success' ? <CheckCircle size={13} color="var(--green)"/> : <XCircle size={13} color="var(--red)"/>}
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'var(--t3)' }}>{run.run_at?.slice(0,19)}</div>
                    <div style={{ fontSize:11, color:'var(--t2)', marginTop:2 }}>{run.stocks} stocks · {run.duration_sec}s</div>
                  </div>
                  <StatusBadge status={run.status}/>
                </div>
              ))}
              {(!status?.pipeline_runs || status.pipeline_runs.length===0) && (
                <div style={{ color:'var(--t3)', fontSize:12, textAlign:'center', padding:'20px 0' }}>No runs yet — pipeline starts on server boot</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="card" style={{ padding:'22px' }}>
        <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15, marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
          <Layers size={15}/> System Architecture
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
          {ARCH.map((layer,i)=>(
            <div key={layer.layer} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
              <div style={{ width:'100%', padding:'12px 10px', borderRadius:10, background:`${layer.color}10`, border:`1px solid ${layer.color}28`, textAlign:'center' }}>
                <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:11.5, color:layer.color, marginBottom:8 }}>{layer.layer}</div>
                {layer.items.map(item=>(
                  <div key={item} style={{ fontSize:10.5, color:'var(--t2)', padding:'3px 0', lineHeight:1.4 }}>{item}</div>
                ))}
              </div>
              {i<ARCH.length-1 && (
                <div style={{ fontSize:16, color:'var(--t4)', margin:'4px 0', alignSelf:'center' }}>→</div>
              )}
            </div>
          ))}
        </div>

        {/* Tech stack tags */}
        <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--b1)', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--t3)', marginRight:4 }}>Tech Stack:</span>
          {['FastAPI','Python 3.12','SQLAlchemy','APScheduler','React 18','Recharts','WebSocket','yfinance','pandas','numpy','Groq AI','SQLite→PostgreSQL'].map(t=>(
            <span key={t} className="badge badge-blue" style={{ fontSize:10 }}>{t}</span>
          ))}
        </div>

        {/* Production note */}
        <div style={{ marginTop:14, padding:'12px 14px', borderRadius:9, background:'rgba(245,158,11,.05)', border:'1px solid var(--gold3)' }}>
          <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:12, color:'var(--gold)', marginBottom:5 }}>🚀 Production Scale-Up Path</div>
          <p style={{ fontSize:12, color:'var(--t2)', margin:0, lineHeight:1.65 }}>
            Replace SQLite → <strong style={{color:'var(--t1)'}}>PostgreSQL + TimescaleDB</strong> for time-series optimization.
            Replace APScheduler → <strong style={{color:'var(--t1)'}}>Apache Kafka</strong> for real streaming.
            Add <strong style={{color:'var(--t1)'}}>Apache Spark</strong> for 5TB+ historical processing.
            Deploy on <strong style={{color:'var(--t1)'}}>Railway / AWS ECS</strong> with auto-scaling.
          </p>
        </div>
      </div>
    </div>
  )
}

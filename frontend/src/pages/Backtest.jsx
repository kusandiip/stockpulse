import { useState } from 'react'
import { api } from '../utils/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Plus, Trash2, Play, TrendingUp, TrendingDown, AlertTriangle, Zap, RefreshCw } from 'lucide-react'

const STOCKS = [
  {symbol:'RELIANCE.NS',name:'Reliance Industries'},{symbol:'TCS.NS',name:'Tata Consultancy Services'},
  {symbol:'INFY.NS',name:'Infosys'},{symbol:'HDFCBANK.NS',name:'HDFC Bank'},{symbol:'ICICIBANK.NS',name:'ICICI Bank'},
  {symbol:'WIPRO.NS',name:'Wipro'},{symbol:'SBIN.NS',name:'State Bank of India'},{symbol:'BAJFINANCE.NS',name:'Bajaj Finance'},
  {symbol:'BHARTIARTL.NS',name:'Bharti Airtel'},{symbol:'HINDUNILVR.NS',name:'Hindustan Unilever'},
  {symbol:'HCLTECH.NS',name:'HCL Technologies'},{symbol:'MARUTI.NS',name:'Maruti Suzuki'},
  {symbol:'TITAN.NS',name:'Titan Company'},{symbol:'SUNPHARMA.NS',name:'Sun Pharmaceutical'},
  {symbol:'AXISBANK.NS',name:'Axis Bank'},{symbol:'ITC.NS',name:'ITC Limited'},
  {symbol:'TATAMOTORS.NS',name:'Tata Motors'},{symbol:'ADANIENT.NS',name:'Adani Enterprises'},
  {symbol:'AAPL',name:'Apple Inc.'},{symbol:'GOOGL',name:'Alphabet Inc.'},
  {symbol:'MSFT',name:'Microsoft'},{symbol:'TSLA',name:'Tesla'},
  {symbol:'NVDA',name:'NVIDIA'},{symbol:'META',name:'Meta Platforms'},
]
const PERIODS = ['6mo','1y','2y','5y']
const COLORS  = ['#3b82f6','#00c896','#f59e0b','#ff4560','#8b5cf6','#06b6d4']

function KPI({ icon:Icon, label, value, color, sub }) {
  return (
    <div style={{ padding:'18px 20px', borderRadius:12, background:'var(--bg3)', border:'1px solid var(--b1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={14} color={color}/>
        </div>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:'var(--t3)', fontWeight:700, letterSpacing:'.07em' }}>{label}</span>
      </div>
      <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:26, color, letterSpacing:'-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function ChartTip({ active, payload }) {
  if(!active||!payload?.length) return null
  const d=payload[0]?.payload
  return (
    <div style={{ background:'rgba(7,8,15,.97)', border:'1px solid var(--blue3)', borderRadius:9, padding:'9px 13px' }}>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'var(--t3)', marginBottom:3 }}>{d?.date}</div>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:14, color:d?.value>=100?'var(--green)':'var(--red)' }}>{d?.value?.toFixed(2)}%</div>
      <div style={{ fontSize:10.5, color:'var(--t2)' }}>{d?.value>=100?'+':''}{(d?.value-100)?.toFixed(2)}% return</div>
    </div>
  )
}

export default function Backtest() {
  const [holdings, setHoldings] = useState([{symbol:'RELIANCE.NS',weight:40},{symbol:'TCS.NS',weight:30},{symbol:'INFY.NS',weight:30}])
  const [period,   setPeriod]   = useState('1y')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const total   = holdings.reduce((s,h)=>s+Number(h.weight),0)
  const isValid = Math.abs(total-100)<1 && holdings.length>=1

  const add    = () => { const u=STOCKS.find(s=>!holdings.some(h=>h.symbol===s.symbol)); if(u) setHoldings(p=>[...p,{symbol:u.symbol,weight:0}]) }
  const remove = i => setHoldings(p=>p.filter((_,idx)=>idx!==i))
  const update = (i,k,v) => setHoldings(p=>p.map((h,idx)=>idx===i?{...h,[k]:v}:h))
  const equal  = () => { const w=Math.floor(100/holdings.length); const r=100-w*holdings.length; setHoldings(p=>p.map((h,i)=>({...h,weight:i===0?w+r:w}))) }

  const run = async () => {
    if(!isValid) return
    setLoading(true); setError(null); setResult(null)
    try {
      const symbols = holdings.map(h=>h.symbol).join(',')
      const tot = holdings.reduce((s,h)=>s+Number(h.weight),0)
      const weights = holdings.map(h=>(Number(h.weight)/tot).toFixed(6)).join(',')
      const data = await api.backtestPortfolio(symbols, weights, period)
      if(data.error) throw new Error(data.error)
      setResult(data)
    } catch(e) {
      setError(e.response?.data?.detail || e.message || 'Backtest failed. Try fewer stocks.')
    } finally { setLoading(false) }
  }

  const pos = result?.total_return_pct >= 0

  return (
    <div style={{ padding:'26px 28px' }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:27, color:'var(--t1)', letterSpacing:'-.025em', margin:0 }}>Portfolio Backtester</h1>
        <p style={{ color:'var(--t2)', marginTop:5, fontSize:13 }}>Test your allocation against real historical NSE & US data</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:22 }}>
        {/* Left */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15, marginBottom:16 }}>Portfolio Composition</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
              {holdings.map((h,i)=>(
                <div key={i} style={{ display:'flex', gap:7, alignItems:'center', padding:'9px 11px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--b1)' }}>
                  <select value={h.symbol} onChange={e=>update(i,'symbol',e.target.value)} className="sp-input" style={{ flex:1, fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'5px 8px' }}>
                    {STOCKS.map(s=><option key={s.symbol} value={s.symbol}>{s.symbol.replace('.NS','')} — {s.name}</option>)}
                  </select>
                  <input type="number" min="0" max="100" value={h.weight} onChange={e=>update(i,'weight',Number(e.target.value))} className="sp-input" style={{ width:50, fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, textAlign:'center', padding:'5px 7px' }}/>
                  <span style={{ fontSize:12, color:'var(--t3)' }}>%</span>
                  <button onClick={()=>remove(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t3)', padding:3, borderRadius:4, display:'flex', alignItems:'center' }}><Trash2 size={13}/></button>
                </div>
              ))}
            </div>

            <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center', background:isValid?'rgba(0,200,150,.06)':'rgba(255,69,96,.06)', border:`1px solid ${isValid?'var(--green3)':'var(--red3)'}` }}>
              <span style={{ fontSize:12, color:'var(--t2)' }}>Total Weight</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:800, fontSize:15, color:isValid?'var(--green)':'var(--red)' }}>{total}%</span>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <button onClick={add} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'8px', borderRadius:8, cursor:'pointer', background:'var(--bg4)', border:'1px solid var(--b2)', color:'var(--t2)', fontSize:12, fontWeight:600 }}><Plus size={13}/> Add Stock</button>
              <button onClick={equal} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'8px', borderRadius:8, cursor:'pointer', background:'var(--gold2)', border:'1px solid var(--gold3)', color:'var(--gold)', fontSize:12, fontWeight:600 }}><Zap size={13}/> Equal Weights</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.1em', marginBottom:7 }}>BACKTEST PERIOD</div>
              <div style={{ display:'flex', gap:6 }}>
                {PERIODS.map(p=>(
                  <button key={p} onClick={()=>setPeriod(p)} style={{ flex:1, padding:'7px 4px', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'JetBrains Mono,monospace', fontWeight:600, border:'1px solid', background:period===p?'var(--blue2)':'transparent', borderColor:period===p?'var(--blue3)':'var(--b1)', color:period===p?'var(--blue)':'var(--t3)' }}>{p}</button>
                ))}
              </div>
            </div>

            <button onClick={run} disabled={!isValid||loading} style={{ width:'100%', padding:'12px', borderRadius:12, cursor:isValid&&!loading?'pointer':'not-allowed', background:isValid?'linear-gradient(135deg,var(--blue),var(--purple))':'var(--bg4)', border:'none', color:isValid?'white':'var(--t3)', fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:loading?.78:1, transition:'all .2s' }}>
              {loading?<RefreshCw size={15} className="spin"/>:<Play size={15}/>}
              {loading?'Running Simulation…':'Run Backtest'}
            </button>
            {!isValid && <div style={{ marginTop:8, fontSize:11, color:'var(--gold)', display:'flex', alignItems:'center', gap:5 }}><AlertTriangle size={11}/> Weights must sum to 100%</div>}
          </div>

          {/* Allocation bars */}
          {isValid && (
            <div className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:13, marginBottom:12 }}>Allocation</div>
              {holdings.map((h,i)=>(
                <div key={i} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--t2)' }}>{h.symbol.replace('.NS','')}</span>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:COLORS[i%COLORS.length], fontWeight:700 }}>{h.weight}%</span>
                  </div>
                  <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,.05)' }}>
                    <div style={{ height:'100%', borderRadius:2, width:`${h.weight}%`, background:COLORS[i%COLORS.length], transition:'width .3s' }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — results */}
        <div>
          {error && <div style={{ padding:'14px 18px', borderRadius:12, marginBottom:16, background:'var(--red2)', border:'1px solid var(--red3)', color:'var(--red)', fontSize:13, display:'flex', gap:8 }}><AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }}/>{error}</div>}

          {!result && !loading && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:420, textAlign:'center', color:'var(--t3)', padding:40 }}>
              <div style={{ fontSize:58, marginBottom:16 }}>📈</div>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:18, fontWeight:700, color:'var(--t2)', marginBottom:8 }}>Build your portfolio</div>
              <div style={{ fontSize:13, maxWidth:300, lineHeight:1.65 }}>Select stocks, set weights, choose a period and click Run Backtest</div>
            </div>
          )}

          {loading && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:420, gap:14, color:'var(--t2)' }}>
              <div style={{ width:48, height:48, border:'3px solid var(--bg4)', borderTopColor:'var(--blue)', borderRadius:'50%' }} className="spin"/>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:16 }}>Running historical simulation…</div>
              <div style={{ fontSize:12, color:'var(--t3)' }}>Fetching {holdings.length} stocks · {period} historical data</div>
            </div>
          )}

          {result && (
            <div className="anim-fade-up">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:18 }}>
                <KPI icon={pos?TrendingUp:TrendingDown} label="TOTAL RETURN" value={`${pos?'+':''}${result.total_return_pct}%`} color={pos?'var(--green)':'var(--red)'} sub={`Over ${period}`}/>
                <KPI icon={Zap} label="SHARPE RATIO" value={result.sharpe_ratio.toFixed(3)} color={result.sharpe_ratio>=1?'var(--green)':result.sharpe_ratio>=0?'var(--gold)':'var(--red)'} sub={result.sharpe_ratio>=1?'Excellent risk-adjusted':result.sharpe_ratio>=0?'Acceptable':'Below benchmark'}/>
                <KPI icon={AlertTriangle} label="VOLATILITY (ANN.)" value={`${result.volatility_pct.toFixed(2)}%`} color="var(--gold)" sub="Annualized std deviation"/>
                <KPI icon={TrendingDown} label="MAX DRAWDOWN" value={`${result.max_drawdown_pct.toFixed(2)}%`} color="var(--red)" sub="Peak-to-trough decline"/>
              </div>

              <div className="card" style={{ padding:'18px 16px', marginBottom:14 }}>
                <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:3 }}>Equity Curve</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginBottom:14 }}>Normalized · 100 = initial investment</div>
                <ResponsiveContainer width="100%" height={248}>
                  <AreaChart data={result.timeline} margin={{ top:8, right:12, bottom:4, left:4 }}>
                    <defs>
                      <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={pos?'#00c896':'#ff4560'} stopOpacity={.28}/>
                        <stop offset="95%" stopColor={pos?'#00c896':'#ff4560'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fill:'var(--t3)', fontSize:9.5, fontFamily:'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} interval={Math.floor(result.timeline.length/7)} tickFormatter={t=>t?.slice(5)}/>
                    <YAxis tick={{ fill:'var(--t3)', fontSize:9.5, fontFamily:'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={v=>`${v.toFixed(0)}%`} width={46}/>
                    <Tooltip content={<ChartTip/>}/>
                    <ReferenceLine y={100} stroke="rgba(255,255,255,.12)" strokeDasharray="4 4"/>
                    <Area type="monotone" dataKey="value" stroke={pos?'var(--green)':'var(--red)'} strokeWidth={2.5} fill="url(#eg)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="card" style={{ padding:'16px 18px' }}>
                <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:8 }}>Summary</div>
                <p style={{ fontSize:13, color:'var(--t2)', lineHeight:1.75, margin:0 }}>
                  Portfolio returned <span style={{ color:pos?'var(--green)':'var(--red)', fontWeight:700 }}>{pos?'+':''}{result.total_return_pct}%</span> over <strong style={{ color:'var(--t1)' }}>{period}</strong> with annualized volatility of <span style={{ color:'var(--gold)', fontWeight:700 }}>{result.volatility_pct.toFixed(2)}%</span>. Sharpe ratio of <span style={{ color:'var(--t1)', fontWeight:700 }}>{result.sharpe_ratio.toFixed(3)}</span> indicates <strong>{result.sharpe_ratio>=1?'strong':result.sharpe_ratio>=0.5?'moderate':'poor'}</strong> risk-adjusted returns. Maximum drawdown was <span style={{ color:'var(--red)', fontWeight:700 }}>{result.max_drawdown_pct.toFixed(2)}%</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

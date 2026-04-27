import { useEffect, useState } from 'react'
import { api, fmt } from '../utils/api'
import { TrendingUp, TrendingDown, Info, RefreshCw } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

const PERIODS = [
  { label:'1W', period:'5d',  interval:'1d' },
  { label:'1M', period:'1mo', interval:'1d' },
  { label:'3M', period:'3mo', interval:'1d' },
  { label:'6M', period:'6mo', interval:'1wk' },
  { label:'1Y', period:'1y',  interval:'1wk' },
]

const SYMBOLS = [
  'RELIANCE.NS','TCS.NS','INFY.NS','HDFCBANK.NS','ICICIBANK.NS','WIPRO.NS',
  'HCLTECH.NS','SBIN.NS','BAJFINANCE.NS','BHARTIARTL.NS','HINDUNILVR.NS',
  'MARUTI.NS','TITAN.NS','SUNPHARMA.NS','AXISBANK.NS','ITC.NS','NTPC.NS',
  'ONGC.NS','TATAMOTORS.NS','TATASTEEL.NS','ADANIENT.NS','NESTLEIND.NS',
  'KOTAKBANK.NS','TECHM.NS','ULTRACEMCO.NS','LTIM.NS','POWERGRID.NS',
  'ADANIPORTS.NS','COALINDIA.NS','ASIANPAINT.NS',
  'AAPL','GOOGL','MSFT','TSLA','AMZN','META','NVDA','NFLX','AMD','INTC',
]

function CandleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const pos = d.close >= d.open
  return (
    <div style={{ background:'rgba(7,8,15,.97)', border:'1px solid var(--blue3)', borderRadius:10, padding:'10px 14px', minWidth:170, boxShadow:'0 8px 32px rgba(0,0,0,.6)' }}>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'var(--t3)', marginBottom:8 }}>{d.time}</div>
      {[['O',d.open],['H',d.high],['L',d.low],['C',d.close]].map(([k,v])=>(
        <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:3 }}>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'var(--t3)' }}>{k}</span>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color: k==='C'?(pos?'var(--green)':'var(--red)'):'var(--t1)' }}>₹{v?.toFixed(2)}</span>
        </div>
      ))}
      <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid var(--b1)', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'var(--t3)' }}>VOL</span>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'var(--t2)' }}>{fmt.vol(d.volume)}</span>
      </div>
    </div>
  )
}

function PatternCard({ p }) {
  const isBull = p.signal?.toLowerCase().includes('bull')
  return (
    <div style={{ padding:'12px 14px', borderRadius:10, marginBottom:8, background:isBull?'rgba(0,200,150,.05)':'rgba(255,69,96,.05)', border:`1px solid ${isBull?'var(--green3)':'var(--red3)'}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontWeight:700, fontSize:13, color:'var(--t1)' }}>{p.type}</span>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:isBull?'var(--green2)':'var(--red2)', color:isBull?'var(--green)':'var(--red)', border:`1px solid ${isBull?'var(--green3)':'var(--red3)'}` }}>{p.signal}</span>
      </div>
      <div style={{ fontSize:11.5, color:'var(--t2)', marginBottom:8, lineHeight:1.5 }}>{p.description}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:4, borderRadius:2, background:'var(--bg5)' }}>
          <div style={{ height:'100%', width:`${p.confidence}%`, borderRadius:2, background:isBull?'var(--green)':'var(--red)', transition:'width .4s' }}/>
        </div>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10.5, color:'var(--t2)' }}>{p.confidence}%</span>
      </div>
    </div>
  )
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ padding:'11px 13px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--b1)' }}>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.08em', marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:15, fontWeight:700, color:color||'var(--t1)' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

export default function StockDetail({ symbol: initSym, prices }) {
  const [symbol,    setSymbol]    = useState(initSym)
  const [periodIdx, setPeriodIdx] = useState(1)
  const [data,      setData]      = useState(null)
  const [info,      setInfo]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [showMA,    setShowMA]    = useState({ ma20:true, ma50:false })

  const period = PERIODS[periodIdx]

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getStockHistory(symbol, period.period, period.interval),
      api.getStockInfo(symbol),
    ]).then(([hist, inf]) => { setData(hist); setInfo(inf) })
      .finally(() => setLoading(false))
  }, [symbol, periodIdx])

  const live     = prices[symbol]
  const lastClose = data?.candles?.[data.candles.length - 1]
  const curPrice = live?.price ?? lastClose?.close
  const ma       = data?.indicators?.moving_averages
  const rsi      = data?.indicators?.rsi

  // Prepare chart data — combine OHLC for recharts ComposedChart candlestick trick
  const chartData = data?.candles?.map(c => ({
    ...c,
    // For the "candle body" bar: [min(open,close), max(open,close)]
    body:    [Math.min(c.open, c.close), Math.max(c.open, c.close)],
    // For the "wick" line: [low, high]
    wickLow:  c.low,
    wickHigh: c.high,
    color:   c.close >= c.open ? 'var(--green)' : 'var(--red)',
    isUp:    c.close >= c.open,
  })) || []

  return (
    <div style={{ padding:'24px 28px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <select value={symbol} onChange={e=>setSymbol(e.target.value)} className="sp-input" style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:13 }}>
            {SYMBOLS.map(s=><option key={s} value={s}>{s.replace('.NS','')} — {s.replace('.NS','')}</option>)}
          </select>
          {info && (
            <div>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:18, color:'var(--t1)' }}>{info.name}</div>
              <div style={{ fontSize:12, color:'var(--t2)', marginTop:2 }}>{info.sector} · {info.industry}</div>
            </div>
          )}
        </div>
        <div style={{ textAlign:'right' }}>
          {curPrice && (
            <>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:32, color:'var(--t1)', letterSpacing:'-.03em', lineHeight:1 }}>
                ₹{curPrice.toFixed(2)}
              </div>
              {live && (
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, marginTop:4, color:live.change_pct>=0?'var(--green)':'var(--red)' }}>
                  {live.change_pct>=0?'▲':'▼'} {Math.abs(live.change_pct*100).toFixed(3)}%
                  <span style={{ fontSize:9.5, marginLeft:6, opacity:.6, color:'var(--t2)' }}>{live.change_pct!==0?'LIVE':'CLOSED'}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:18 }}>
        {/* Left — charts */}
        <div>
          {/* Period + MA toggles */}
          <div style={{ display:'flex', gap:6, marginBottom:14, alignItems:'center' }}>
            {PERIODS.map((p,i)=>(
              <button key={p.label} onClick={()=>setPeriodIdx(i)} style={{ padding:'5px 13px', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'JetBrains Mono,monospace', fontWeight:600, border:'1px solid', background:i===periodIdx?'var(--blue2)':'transparent', borderColor:i===periodIdx?'var(--blue3)':'var(--b1)', color:i===periodIdx?'var(--blue)':'var(--t3)', transition:'all .12s' }}>
                {p.label}
              </button>
            ))}
            <div style={{ flex:1 }}/>
            {['ma20','ma50'].map(k=>(
              <button key={k} onClick={()=>setShowMA(p=>({...p,[k]:!p[k]}))} style={{ padding:'5px 11px', borderRadius:8, cursor:'pointer', fontSize:11, fontFamily:'JetBrains Mono,monospace', fontWeight:700, border:'1px solid', background:showMA[k]?'rgba(245,158,11,.12)':'transparent', borderColor:showMA[k]?'var(--gold3)':'var(--b1)', color:showMA[k]?'var(--gold)':'var(--t3)', transition:'all .12s' }}>
                {k.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Candlestick chart */}
          <div className="card" style={{ padding:'16px 8px 8px', marginBottom:12 }}>
            {loading ? (
              <div style={{ height:320, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)', flexDirection:'column', gap:12 }}>
                <div style={{ width:32,height:32,border:'2px solid var(--bg4)',borderTopColor:'var(--blue)',borderRadius:'50%' }} className="spin"/>
                <span style={{ fontSize:12 }}>Loading chart…</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top:8, right:16, bottom:4, left:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="time" tick={{ fill:'var(--t3)', fontSize:9.5, fontFamily:'JetBrains Mono,monospace' }} tickLine={false} axisLine={false}
                    interval={Math.floor(chartData.length/7)} tickFormatter={t=>t?.slice(5)}/>
                  <YAxis domain={['auto','auto']} tick={{ fill:'var(--t3)', fontSize:9.5, fontFamily:'JetBrains Mono,monospace' }} tickLine={false} axisLine={false} tickFormatter={v=>v.toFixed(0)} width={58} orientation="right"/>
                  <Tooltip content={<CandleTooltip/>}/>

                  {/* Wick lines — high to low */}
                  <Line type="monotone" dataKey="wickHigh" stroke="transparent" dot={false} legendType="none"/>
                  <Line type="monotone" dataKey="wickLow"  stroke="transparent" dot={false} legendType="none"/>

                  {/* Candle body bars */}
                  <Bar dataKey="body" radius={[2,2,2,2]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.isUp ? 'var(--green)' : 'var(--red)'} fillOpacity={0.85}/>
                    ))}
                  </Bar>

                  {/* Price line overlay */}
                  <Line type="monotone" dataKey="close" stroke="rgba(59,130,246,0.6)" strokeWidth={1.5} dot={false} strokeDasharray="0"/>

                  {/* Moving averages */}
                  {showMA.ma20 && ma?.ma20 && <ReferenceLine y={ma.ma20} stroke="var(--gold)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value:`MA20 ₹${ma.ma20}`, fill:'var(--gold)', fontSize:9, fontFamily:'JetBrains Mono,monospace', position:'insideTopLeft' }}/>}
                  {showMA.ma50 && ma?.ma50 && <ReferenceLine y={ma.ma50} stroke="var(--purple)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value:`MA50 ₹${ma.ma50}`, fill:'var(--purple)', fontSize:9, fontFamily:'JetBrains Mono,monospace', position:'insideTopLeft' }}/>}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Volume chart */}
          {!loading && chartData.length > 0 && (
            <div className="card" style={{ padding:'10px 8px 6px', marginBottom:12 }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.1em', fontWeight:700, padding:'0 8px 8px' }}>VOLUME</div>
              <ResponsiveContainer width="100%" height={72}>
                <ComposedChart data={chartData} margin={{ top:0, right:16, bottom:0, left:4 }}>
                  <XAxis hide/><YAxis hide/>
                  <Bar dataKey="volume" radius={[2,2,0,0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isUp ? 'rgba(0,200,150,0.4)' : 'rgba(255,69,96,0.4)'}/>
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RSI gauge */}
          {rsi !== undefined && (
            <div className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:18 }}>
              <div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--t3)', letterSpacing:'.08em', marginBottom:5 }}>RSI (14)</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:800, fontSize:26, color:rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--t1)' }}>{rsi}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ height:8, borderRadius:4, background:'var(--bg4)', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:'30%', right:'30%', top:0, bottom:0, background:'rgba(0,200,150,.1)', borderRadius:4 }}/>
                  <div style={{ position:'absolute', left:`${rsi}%`, top:'50%', transform:'translate(-50%,-50%)', width:14, height:14, borderRadius:'50%', border:'2px solid var(--bg2)', background:rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--blue)', transition:'left .4s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontFamily:'JetBrains Mono,monospace', fontSize:9.5, color:'var(--t3)' }}>
                  <span>0 — Oversold</span><span>30</span><span>70</span><span>Overbought — 100</span>
                </div>
              </div>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:20,
                background:rsi>70?'var(--red2)':rsi<30?'var(--green2)':'var(--blue2)',
                color:rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--blue)',
                border:`1px solid ${rsi>70?'var(--red3)':rsi<30?'var(--green3)':'var(--blue3)'}`,
              }}>
                {rsi>70?'OVERBOUGHT':rsi<30?'OVERSOLD':'NEUTRAL'}
              </span>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Fundamentals */}
          {info && (
            <div className="card" style={{ padding:'15px' }}>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:12 }}>Fundamentals</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <StatBox label="MKT CAP"    value={fmt.cap(info.market_cap)}/>
                <StatBox label="P/E RATIO"  value={info.pe_ratio?.toFixed(2) ?? 'N/A'}/>
                <StatBox label="EPS"        value={info.eps?.toFixed(2) ?? 'N/A'}/>
                <StatBox label="DIV YIELD"  value={info.dividend_yield ? `${(info.dividend_yield*100).toFixed(2)}%` : 'N/A'}/>
                <StatBox label="52W HIGH"   value={`₹${info['52w_high']?.toFixed(0) ?? 'N/A'}`} color="var(--green)"/>
                <StatBox label="52W LOW"    value={`₹${info['52w_low']?.toFixed(0)  ?? 'N/A'}`} color="var(--red)"/>
              </div>
            </div>
          )}

          {/* MACD */}
          {data?.indicators?.macd && (
            <div className="card" style={{ padding:'15px' }}>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:12 }}>MACD</div>
              {[['MACD Line',data.indicators.macd.macd],['Signal',data.indicators.macd.signal],['Histogram',data.indicators.macd.histogram]].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{k}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, color:v>=0?'var(--green)':'var(--red)' }}>
                    {v>0?'+':''}{v}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Patterns */}
          <div className="card" style={{ padding:'15px' }}>
            <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
              Pattern Detection <Info size={13} color="var(--t3)"/>
            </div>
            {data?.patterns?.length > 0
              ? data.patterns.map((p,i)=><PatternCard key={i} p={p}/>)
              : <div style={{ fontSize:12, color:'var(--t3)', textAlign:'center', padding:'16px 0' }}>No patterns detected in current range</div>
            }
          </div>

          {/* About */}
          {info?.description && (
            <div className="card" style={{ padding:'15px' }}>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:14, marginBottom:8 }}>About</div>
              <p style={{ fontSize:12, color:'var(--t2)', lineHeight:1.65, margin:0 }}>{info.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

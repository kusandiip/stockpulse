import { useEffect, useState, useMemo } from 'react'
import { api, fmt } from '../utils/api'
import { TrendingUp, TrendingDown, Search, RefreshCw, Eye } from 'lucide-react'
import { SparklineChart } from '../components/SparklineChart'
import { MarketIndexCard } from '../components/MarketIndexCard'

const SECTOR_FILTERS = ['All','IT','Banking','FMCG','Energy','Pharma','Auto','Finance','Telecom','Metal','Tech','Semiconductors']

function Ticker({ watchlist, prices }) {
  if (!watchlist.length) return null
  const items = [...watchlist, ...watchlist]
  return (
    <div className="ticker-wrap" style={{ background:'rgba(59,130,246,.04)', borderBottom:'1px solid var(--b1)', padding:'7px 0' }}>
      <div className="ticker-inner">
        {items.map((s,i) => {
          const live = prices[s.symbol]
          const price = live?.price ?? s.price
          const pct = live ? live.change_pct*100 : s.change_pct
          const pos = pct >= 0
          return (
            <span key={i} style={{ padding:'0 24px', display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10.5, color:'var(--t3)', fontWeight:600 }}>{s.symbol.replace('.NS','')}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--t1)', fontWeight:700 }}>₹{price.toFixed(2)}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10.5, color:pos?'var(--green)':'var(--red)', fontWeight:700 }}>{pos?'▲':'▼'} {Math.abs(pct).toFixed(2)}%</span>
              <span style={{ color:'var(--b2)', fontSize:10 }}>•</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ prices, navigate }) {
  const [overview,  setOverview]  = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [search,    setSearch]    = useState('')
  const [sector,    setSector]    = useState('All')
  const [sortBy,    setSortBy]    = useState('default')
  const [searchRes, setSearchRes] = useState([])

  const load = async () => {
    try {
      const [ov, wl] = await Promise.all([api.getMarketOverview(), api.getWatchlist()])
      setOverview(ov); setWatchlist(wl)
    } catch(e){ console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(()=>{ load() },[])

  useEffect(()=>{
    if(!search.trim()){ setSearchRes([]); return }
    const t=setTimeout(async()=>setSearchRes(await api.searchStocks(search)),280)
    return()=>clearTimeout(t)
  },[search])

  const filtered = useMemo(()=>{
    let list = watchlist.filter(s =>
      (sector==='All' || s.sector===sector) &&
      (!search || s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
    )
    if(sortBy==='gain')   list=[...list].sort((a,b)=>b.change_pct-a.change_pct)
    if(sortBy==='loss')   list=[...list].sort((a,b)=>a.change_pct-b.change_pct)
    if(sortBy==='rsi')    list=[...list].sort((a,b)=>(b.rsi||50)-(a.rsi||50))
    if(sortBy==='volume') list=[...list].sort((a,b)=>(b.volume||0)-(a.volume||0))
    return list
  },[watchlist,sector,sortBy,search])

  const gainers = watchlist.filter(s=>s.change_pct>0).length
  const losers  = watchlist.filter(s=>s.change_pct<=0).length

  if(loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:14 }}>
      <div style={{ width:40,height:40,border:'3px solid var(--bg4)',borderTopColor:'var(--blue)',borderRadius:'50%' }} className="spin"/>
      <div style={{ color:'var(--t2)', fontSize:15, fontFamily:'Space Grotesk,sans-serif' }}>Fetching market data…</div>
    </div>
  )

  return (
    <div>
      <Ticker watchlist={watchlist} prices={prices}/>
      <div style={{ padding:'26px 28px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22 }}>
          <div>
            <h1 style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:27, color:'var(--t1)', letterSpacing:'-.025em', lineHeight:1 }}>Market Overview</h1>
            <p style={{ marginTop:5, color:'var(--t2)', fontSize:13 }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="badge badge-green">▲ {gainers} Gainers</span>
            <span className="badge badge-red">▼ {losers} Losers</span>
            <button onClick={()=>{setRefreshing(true);load()}} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg3)', border:'1px solid var(--b2)', borderRadius:9, padding:'7px 13px', color:'var(--t2)', cursor:'pointer', fontSize:12.5, fontWeight:500, transition:'all .14s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue3)';e.currentTarget.style.color='var(--blue)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--b2)';e.currentTarget.style.color='var(--t2)'}}>
              <RefreshCw size={12} className={refreshing?'spin':''}/> Refresh
            </button>
          </div>
        </div>

        {/* Index cards — auto-fit grid handles 4 / 6 / more responsively */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
          {overview.filter(i => !i.error).map(idx=><MarketIndexCard key={idx.symbol} data={idx}/>)}
        </div>

        {/* Watchlist */}
        <div className="card" style={{ overflow:'hidden' }}>
          {/* Controls bar */}
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--b1)', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:4 }}>
              <span style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:700, fontSize:15 }}>Watchlist</span>
              <span className="badge badge-blue">{filtered.length} / {watchlist.length}</span>
            </div>

            {/* Sector chips */}
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', flex:1 }}>
              {SECTOR_FILTERS.slice(0,7).map(s=>(
                <button key={s} onClick={()=>setSector(s)} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer', fontFamily:'JetBrains Mono,monospace', fontWeight:600, border:'1px solid', background:sector===s?'var(--blue2)':'transparent', borderColor:sector===s?'var(--blue3)':'var(--b1)', color:sector===s?'var(--blue)':'var(--t3)', transition:'all .12s' }}
                  onMouseEnter={e=>{ if(sector!==s){e.currentTarget.style.borderColor='var(--b2)';e.currentTarget.style.color='var(--t2)'} }}
                  onMouseLeave={e=>{ if(sector!==s){e.currentTarget.style.borderColor='var(--b1)';e.currentTarget.style.color='var(--t3)'} }}
                >{s}</button>
              ))}
            </div>

            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="sp-input" style={{ fontSize:11.5, padding:'5px 9px', cursor:'pointer' }}>
              <option value="default">Default Order</option>
              <option value="gain">Top Gainers</option>
              <option value="loss">Top Losers</option>
              <option value="rsi">RSI High→Low</option>
              <option value="volume">Volume</option>
            </select>

            <div style={{ position:'relative' }}>
              <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t3)' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stocks…" className="sp-input" style={{ paddingLeft:28, width:160, fontSize:12 }}/>
              {searchRes.length>0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'var(--bg3)', border:'1px solid var(--b2)', borderRadius:10, marginTop:4, overflow:'hidden', boxShadow:'0 12px 36px rgba(0,0,0,.5)' }}>
                  {searchRes.slice(0,6).map(r=>(
                    <div key={r.symbol} onClick={()=>{ navigate('stock',r.symbol); setSearch(''); setSearchRes([]) }}
                      style={{ padding:'8px 13px', cursor:'pointer', display:'flex', gap:10, alignItems:'center', borderBottom:'1px solid var(--b0)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--blue2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11.5, color:'var(--blue)', fontWeight:700 }}>{r.symbol.replace('.NS','')}</span>
                      <span style={{ fontSize:12, color:'var(--t2)' }}>{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign:'left', paddingLeft:18 }}>SYMBOL</th>
                  <th>PRICE</th>
                  <th>CHANGE</th>
                  <th>RSI(14)</th>
                  <th>VOLUME</th>
                  <th>7D TREND</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(stock => {
                  const live = prices[stock.symbol]
                  const price = live?.price ?? stock.price
                  const pct = live ? live.change_pct*100 : stock.change_pct
                  const pos = pct >= 0
                  const rsiC = stock.rsi>70?'var(--red)':stock.rsi<30?'var(--green)':'var(--t2)'
                  return (
                    <tr key={stock.symbol} onClick={()=>navigate('stock',stock.symbol)}>
                      <td style={{ paddingLeft:18 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:9, background:'var(--bg4)', border:'1px solid var(--b1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8, fontWeight:700, color:'var(--blue)' }}>{stock.symbol.replace('.NS','').slice(0,5)}</span>
                          </div>
                          <div>
                            <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:12.5, color:'var(--t1)' }}>{stock.symbol.replace('.NS','')}</div>
                            <div style={{ fontSize:10.5, color:'var(--t3)', marginTop:1 }}>{stock.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:13.5, color:'var(--t1)' }}>₹{price.toFixed(2)}</span>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:20, fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, background:pos?'var(--green2)':'var(--red2)', color:pos?'var(--green)':'var(--red)', border:`1px solid ${pos?'var(--green3)':'var(--red3)'}` }}>
                          {pos?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{pos?'+':''}{pct.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                          <div style={{ width:40, height:4, borderRadius:2, background:'var(--bg5)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${Math.min(stock.rsi||50,100)}%`, background:rsiC, borderRadius:2, transition:'width .4s' }}/>
                          </div>
                          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:rsiC, fontWeight:700, minWidth:28 }}>{stock.rsi?.toFixed(0)}</span>
                        </div>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--t3)' }}>{fmt.vol(stock.volume)}</span>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <div style={{ width:80, height:30, marginLeft:'auto' }}><SparklineChart data={stock.sparkline} positive={pos}/></div>
                      </td>
                      <td style={{ textAlign:'center', paddingRight:16 }}>
                        <button onClick={e=>{e.stopPropagation();navigate('stock',stock.symbol)}} style={{ background:'var(--blue2)', border:'1px solid var(--blue3)', borderRadius:7, padding:'4px 10px', color:'var(--blue)', cursor:'pointer', fontSize:11, fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}>
                          <Eye size={10}/> View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

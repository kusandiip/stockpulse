import { TrendingUp, TrendingDown } from 'lucide-react'

export function MarketIndexCard({ data }) {
  const pos = data.positive
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--b1)', borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden', transition:'all .18s', cursor:'default' }}
    onMouseEnter={e=>{ e.currentTarget.style.borderColor=pos?'var(--green3)':'var(--red3)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,.3)' }}
    onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--b1)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}
    >
      <div style={{ position:'absolute', top:-20, right:-20, width:70, height:70, borderRadius:'50%', background:pos?'rgba(0,200,150,.07)':'rgba(255,69,96,.07)', pointerEvents:'none' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <span style={{ fontSize:12, color:'var(--t2)', fontWeight:500 }}>{data.name}</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:20, fontSize:10.5, fontWeight:700, fontFamily:'JetBrains Mono,monospace', background:pos?'var(--green2)':'var(--red2)', border:`1px solid ${pos?'var(--green3)':'var(--red3)'}`, color:pos?'var(--green)':'var(--red)' }}>
          {pos?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{pos?'+':''}{data.change_pct?.toFixed(2)}%
        </span>
      </div>
      <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:800, fontSize:26, color:'var(--t1)', letterSpacing:'-.03em', lineHeight:1 }}>
        {data.price>0 ? data.price.toLocaleString('en-IN',{maximumFractionDigits:2}) : '—'}
      </div>
      <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:pos?'var(--green)':'var(--red)', marginTop:6, fontWeight:600 }}>
        {pos?'+':''}{data.change?.toFixed(2)} pts
      </div>
    </div>
  )
}

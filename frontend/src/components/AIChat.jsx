import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Bot, User, Sparkles, TrendingUp, ChevronDown, RefreshCw, AlertTriangle, ExternalLink, Cpu, Loader } from 'lucide-react'

const SUGGESTED = [
  "What's the current trend for RELIANCE?",
  "Is NIFTY 50 bullish or bearish today?",
  "Which stock has the highest momentum?",
  "Explain RSI readings for TCS",
  "Compare INFY and WIPRO performance",
  "Is the market overbought right now?",
]

function TypingDots() {
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center', padding:'4px 2px' }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--blue)', animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }}/>
      ))}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  )
}

function SetupBanner({ status }) {
  if (!status || status.ready) return null
  return (
    <div style={{ margin:'10px 14px', padding:'14px 16px', borderRadius:12, background:'rgba(245,158,11,.06)', border:'1px solid var(--gold3)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
        <AlertTriangle size={13} color="var(--gold)"/>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--gold)', fontFamily:'Space Grotesk,sans-serif' }}>One-time setup needed</span>
      </div>
      <p style={{ fontSize:12, color:'var(--t2)', margin:'0 0 10px', lineHeight:1.6 }}>
        StockPulse AI uses <strong style={{color:'var(--t1)'}}>Groq</strong> — free LLM API, no credit card needed.
      </p>
      <div style={{ background:'rgba(0,0,0,.35)', borderRadius:8, padding:'8px 12px', fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--green)', marginBottom:10, lineHeight:2 }}>
        <div style={{color:'var(--t3)'}}>1. Get free key:</div>
        <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style={{ color:'var(--blue)', display:'inline-flex', alignItems:'center', gap:4 }}>
          console.groq.com/keys <ExternalLink size={10}/>
        </a>
        <div style={{color:'var(--t3)', marginTop:4}}>2. In terminal:</div>
        <div>export GROQ_API_KEY=gsk_...</div>
        <div style={{color:'var(--t3)'}}>3. Restart backend</div>
      </div>
    </div>
  )
}

function Bubble({ msg }) {
  const isUser  = msg.role === 'user'
  const isError = msg.role === 'error'
  return (
    <div style={{ display:'flex', flexDirection:isUser?'row-reverse':'row', gap:9, marginBottom:14, animation:'fadeUp .25s ease forwards' }}>
      <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center',
        background: isUser?'linear-gradient(135deg,var(--blue),var(--purple))':isError?'var(--red2)':'var(--bg4)',
        border:`1px solid ${isUser?'transparent':isError?'var(--red3)':'var(--b2)'}`,
      }}>
        {isUser?<User size={13} color="white"/>:isError?<AlertTriangle size={12} color="var(--red)"/>:<Bot size={13} color="var(--blue)"/>}
      </div>
      <div style={{
        maxWidth:'80%', padding:'10px 13px',
        borderRadius:isUser?'14px 4px 14px 14px':'4px 14px 14px 14px',
        background:isUser?'linear-gradient(135deg,rgba(59,130,246,.2),rgba(139,92,246,.14))':isError?'var(--red2)':'rgba(255,255,255,.04)',
        border:`1px solid ${isUser?'var(--blue3)':isError?'var(--red3)':'var(--b1)'}`,
        fontSize:13.5, lineHeight:1.65, color:isError?'var(--red)':'var(--t1)',
        whiteSpace:'pre-wrap', wordBreak:'break-word',
      }}>
        {msg.content}
        {msg.streaming && <span style={{ display:'inline-block', width:2, height:'1em', background:'var(--blue)', marginLeft:2, animation:'blink .7s step-end infinite', verticalAlign:'text-bottom' }}/>}
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      </div>
    </div>
  )
}

export default function AIChat({ currentSymbol }) {
  const [open,      setOpen]      = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [status,    setStatus]    = useState(null)
  const [messages,  setMessages]  = useState([{
    role:'assistant',
    content:"Hi! I'm StockPulse AI 📈\n\nI have live access to market data — indices, prices, RSI, MACD, patterns and more. Ask me anything!",
  }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const abortRef  = useRef(null)

  useEffect(()=>{
    if(open && !status) fetch('/api/chat/status').then(r=>r.json()).then(setStatus).catch(()=>{})
  },[open])

  useEffect(()=>{
    if(open && !minimized) bottomRef.current?.scrollIntoView({behavior:'smooth'})
  },[messages, open, minimized])

  useEffect(()=>{
    if(open && !minimized) inputRef.current?.focus()
  },[open, minimized])

  const send = useCallback(async(text)=>{
    const userText = (text ?? input).trim()
    if(!userText || loading) return
    setInput('')
    setLoading(true)
    const userMsg = {role:'user', content:userText}
    setMessages(prev=>[...prev, userMsg])
    const historyForAPI = [...messages, userMsg].map(m=>({role:m.role, content:m.content}))
    try {
      const controller = new AbortController()
      abortRef.current = controller
      const res = await fetch('/api/chat', {
        method:'POST', signal:controller.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:historyForAPI, symbol:currentSymbol||null}),
      })
      if(!res.ok){
        const err = await res.json()
        throw new Error((err.detail||'Request failed').replace(/^NO_KEY: /,''))
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = '', messageAdded = false
      while(true){
        const {done, value} = await reader.read()
        if(done) break
        for(const line of decoder.decode(value).split('\n')){
          if(!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if(data==='[DONE]') break
          try{
            const parsed = JSON.parse(data)
            if(parsed.error){ setMessages(prev=>[...prev,{role:'error',content:parsed.error}]); setLoading(false); return }
            if(parsed.text){
              accumulated += parsed.text
              if(!messageAdded){
                messageAdded = true
                setMessages(prev=>[...prev,{role:'assistant',content:accumulated,streaming:true}])
              } else {
                setMessages(prev=>{ const c=[...prev]; c[c.length-1]={role:'assistant',content:accumulated,streaming:true}; return c })
              }
            }
          } catch(_){}
        }
      }
      setMessages(prev=>{ const c=[...prev]; if(c[c.length-1]?.role==='assistant') c[c.length-1]={...c[c.length-1],streaming:false}; return c })
    } catch(err){
      if(err.name==='AbortError') return
      setMessages(prev=>[...prev,{role:'error',content:err.message}])
      fetch('/api/chat/status').then(r=>r.json()).then(setStatus).catch(()=>{})
    } finally { setLoading(false) }
  },[input, messages, loading, currentSymbol])

  const onKey = e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }
  const reset = ()=>{ abortRef.current?.abort(); setMessages([{role:'assistant',content:"Hi! I'm StockPulse AI 📈\n\nAsk me anything about stocks, trends, RSI, MACD or patterns!"}]); setLoading(false) }
  const providerLabel = status?.provider==='groq'?`Groq · ${status.model}`:status?.provider==='ollama'?`Ollama · ${status.model}`:'AI'

  return (
    <>
      {!open && (
        <button onClick={()=>setOpen(true)} style={{ position:'fixed',bottom:26,right:26,zIndex:1000,width:54,height:54,borderRadius:'50%',background:'linear-gradient(135deg,var(--blue),var(--purple))',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 22px rgba(59,130,246,.45)',animation:'pulseBtn 2.5s ease-in-out infinite' }}>
          <style>{`@keyframes pulseBtn{0%,100%{box-shadow:0 4px 22px rgba(59,130,246,.4)}50%{box-shadow:0 4px 36px rgba(59,130,246,.7)}}`}</style>
          <Sparkles size={21} color="white"/>
        </button>
      )}
      {open && (
        <div style={{ position:'fixed',bottom:22,right:22,zIndex:1000,width:400,height:minimized?'auto':580,borderRadius:20,background:'rgba(7,8,15,.97)',border:'1px solid var(--blue3)',boxShadow:'0 24px 80px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05)',display:'flex',flexDirection:'column',backdropFilter:'blur(20px)',animation:'popIn .22s cubic-bezier(.34,1.56,.64,1)',overflow:'hidden' }}>
          {/* Header */}
          <div onClick={()=>setMinimized(m=>!m)} style={{ display:'flex',alignItems:'center',gap:10,padding:'13px 16px',borderBottom:minimized?'none':'1px solid rgba(255,255,255,.06)',background:'linear-gradient(135deg,rgba(59,130,246,.08),rgba(139,92,246,.06))',cursor:'pointer',flexShrink:0 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:'rgba(59,130,246,.15)',border:'1px solid var(--blue3)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Bot size={16} color="var(--blue)"/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontFamily:'Space Grotesk,sans-serif',fontWeight:700,fontSize:14,color:'var(--t1)' }}>StockPulse AI</div>
              <div style={{ fontSize:11,display:'flex',alignItems:'center',gap:4,color:loading?'var(--gold)':status?.ready?'var(--green)':'var(--gold)' }}>
                <div style={{ width:5,height:5,borderRadius:'50%',background:loading?'var(--gold)':status?.ready?'var(--green)':'var(--gold)',flexShrink:0 }} className={(loading||!status?.ready)?'live-dot':''}/>
                <span style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                  {loading?'Analyzing…':status?.ready?providerLabel:'Setup required'}
                </span>
                {currentSymbol&&!loading&&status?.ready&&<span style={{ color:'var(--t3)',flexShrink:0 }}>· {currentSymbol.replace('.NS','')}</span>}
              </div>
            </div>
            <div style={{ display:'flex',gap:4,flexShrink:0 }}>
              <button onClick={e=>{e.stopPropagation();reset()}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--t3)',padding:4,borderRadius:6,display:'flex' }}><RefreshCw size={13}/></button>
              <button onClick={e=>{e.stopPropagation();setMinimized(m=>!m)}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--t3)',padding:4,borderRadius:6,display:'flex' }}>
                <ChevronDown size={15} style={{ transform:minimized?'rotate(180deg)':'none',transition:'transform .2s' }}/>
              </button>
              <button onClick={e=>{e.stopPropagation();setOpen(false)}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--t3)',padding:4,borderRadius:6,display:'flex' }}><X size={15}/></button>
            </div>
          </div>

          {!minimized && (
            <>
              <SetupBanner status={status}/>
              {currentSymbol&&status?.ready&&(
                <div style={{ margin:'10px 14px 0',padding:'4px 12px',borderRadius:20,fontSize:11,fontFamily:'JetBrains Mono,monospace',background:'var(--blue2)',border:'1px solid var(--blue3)',color:'var(--blue)',fontWeight:600,display:'flex',alignItems:'center',gap:5,width:'fit-content' }}>
                  <TrendingUp size={10}/> Live data: {currentSymbol}
                </div>
              )}
              <div style={{ flex:1,overflowY:'auto',padding:'14px 14px 4px',display:'flex',flexDirection:'column' }}>
                {messages.map((m,i)=><Bubble key={i} msg={m}/>)}
                {loading && !messages.some(m=>m.streaming) && (
                  <div style={{ display:'flex',gap:9,marginBottom:12 }}>
                    <div style={{ width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg4)',border:'1px solid var(--b2)',flexShrink:0 }}>
                      <Bot size={13} color="var(--blue)"/>
                    </div>
                    <div style={{ padding:'10px 14px',borderRadius:'4px 14px 14px 14px',background:'rgba(255,255,255,.04)',border:'1px solid var(--b1)' }}>
                      <TypingDots/>
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>
              {messages.length<=1&&(
                <div style={{ padding:'6px 14px 10px',display:'flex',flexWrap:'wrap',gap:5 }}>
                  {SUGGESTED.map(s=>(
                    <button key={s} onClick={()=>send(s)} style={{ padding:'5px 10px',borderRadius:20,fontSize:11,background:'var(--bg3)',border:'1px solid var(--b1)',color:'var(--t2)',cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .14s',textAlign:'left' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='var(--blue2)';e.currentTarget.style.borderColor='var(--blue3)';e.currentTarget.style.color='var(--blue)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.borderColor='var(--b1)';e.currentTarget.style.color='var(--t2)'}}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ padding:'10px 12px 13px',borderTop:'1px solid rgba(255,255,255,.06)',flexShrink:0 }}>
                <div style={{ display:'flex',gap:7,alignItems:'flex-end',background:'rgba(255,255,255,.04)',border:'1px solid var(--b2)',borderRadius:13,padding:'8px 8px 8px 13px' }}>
                  <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
                    placeholder={status?.ready?"Ask about any stock, trend, or pattern…":"Set up AI provider to chat…"}
                    rows={1}
                    style={{ flex:1,background:'none',border:'none',outline:'none',color:'var(--t1)',fontSize:13,lineHeight:1.5,fontFamily:'Inter,sans-serif',resize:'none',maxHeight:100,overflowY:'auto' }}
                    onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,100)+'px' }}
                  />
                  <button onClick={()=>send()} disabled={!input.trim()||loading} style={{ width:32,height:32,borderRadius:9,flexShrink:0,background:input.trim()&&!loading?'linear-gradient(135deg,var(--blue),var(--purple))':'rgba(255,255,255,.06)',border:'none',cursor:input.trim()&&!loading?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s' }}>
                    {loading?<Loader size={13} color="var(--t3)" className="spin"/>:<Send size={13} color={input.trim()?'white':'var(--t3)'}/>}
                  </button>
                </div>
                <div style={{ fontSize:10,color:'var(--t3)',marginTop:6,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:4 }}>
                  <Cpu size={9}/>{status?.ready?`Powered by ${providerLabel}`:'AI provider not configured'} · Not financial advice
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

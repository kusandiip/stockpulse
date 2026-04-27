import { useState, useEffect, useRef, useCallback } from 'react'

export function useLivePrices() {
  const [prices, setPrices]       = useState({})
  const [connected, setConnected] = useState(false)
  const [marketOpen, setMarketOpen] = useState(null)
  const wsRef    = useRef(null)
  const timerRef = useRef(null)

  const connect = useCallback(() => {
    try {
      // Build WS URL from current page origin so it works in dev (vite proxy)
      // AND in prod (nginx routes /ws/* to backend container).
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${proto}//${window.location.host}/ws/live`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen  = () => { setConnected(true) }
      ws.onclose = () => {
        setConnected(false)
        timerRef.current = setTimeout(connect, 4000)
      }
      ws.onerror = () => ws.close()

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'price_update') {
            setMarketOpen(msg.market_open ?? false)
            setPrices(prev => {
              const next = { ...prev }
              msg.data.forEach(item => {
                next[item.symbol] = { price: item.price, change_pct: item.change_pct, ts: item.timestamp }
              })
              return next
            })
          }
        } catch {}
      }
    } catch {
      setConnected(false)
      timerRef.current = setTimeout(connect, 4000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => { clearTimeout(timerRef.current); wsRef.current?.close() }
  }, [connect])

  return { prices, connected, marketOpen }
}

"""
StockPulse Analytics API v3.0
FastAPI backend - works with Python 3.9+ including 3.14
DB is optional - falls back gracefully if aiosqlite unavailable
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import yfinance as yf
import pandas as pd
import numpy as np
import asyncio, json, random, os, httpx, logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()


# ── yfinance cache (TTL-based) — avoids rate limits + speeds responses ──
class TTLCache:
    """Simple in-memory TTL cache. Thread-safe enough for single-process deploys."""
    def __init__(self, default_ttl: int = 300):
        self._store: dict = {}
        self.default_ttl = default_ttl

    def get(self, key: str):
        item = self._store.get(key)
        if not item:
            return None
        value, expires_at = item
        if datetime.utcnow() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value, ttl: Optional[int] = None):
        ttl = ttl if ttl is not None else self.default_ttl
        self._store[key] = (value, datetime.utcnow() + timedelta(seconds=ttl))

    def clear(self):
        self._store.clear()

    def stats(self) -> dict:
        return {"size": len(self._store), "default_ttl_sec": self.default_ttl}


_yf_cache = TTLCache(default_ttl=300)  # 5-min default


def cached_history(symbol: str, period: str = "5d", interval: str = "1d", ttl: int = 300):
    """yfinance .history() wrapper with TTL cache.
    Use shorter ttl (60s) for intraday, longer (600s) for monthly+ data.
    """
    key = f"hist:{symbol}:{period}:{interval}"
    cached = _yf_cache.get(key)
    if cached is not None:
        return cached
    try:
        import yfinance as _yf
        df = _yf.Ticker(symbol).history(period=period, interval=interval)
        _yf_cache.set(key, df, ttl=ttl)
        return df
    except Exception:
        # Cache empty result briefly so we don't hammer on errors
        import pandas as _pd
        empty = _pd.DataFrame()
        _yf_cache.set(key, empty, ttl=30)
        return empty


def cached_info(symbol: str, ttl: int = 1800):
    """yfinance .info wrapper — cached longer (30 min) since fundamentals change slowly."""
    key = f"info:{symbol}"
    cached = _yf_cache.get(key)
    if cached is not None:
        return cached
    try:
        import yfinance as _yf
        info = _yf.Ticker(symbol).info or {}
        _yf_cache.set(key, info, ttl=ttl)
        return info
    except Exception:
        _yf_cache.set(key, {}, ttl=60)
        return {}
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Optional imports (graceful fallback) ──────────────────────
try:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import DeclarativeBase, sessionmaker
    from sqlalchemy import Column, String, Float, Integer, DateTime, Text, select
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False
    logger.warning("SQLAlchemy not available - running without DB persistence")

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    logger.warning("APScheduler not available - pipeline scheduling disabled")

# ── App ───────────────────────────────────────────────────────
app = FastAPI(title="StockPulse Analytics API", version="3.1.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# ── Database setup (optional) ─────────────────────────────────
engine = None
AsyncSessionLocal = None
scheduler = None

if DB_AVAILABLE:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./stockpulse.db")
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

    class Base(DeclarativeBase):
        pass

    class StockSnapshot(Base):
        __tablename__ = "stock_snapshots"
        id          = Column(Integer, primary_key=True, index=True)
        symbol      = Column(String(20), index=True)
        name        = Column(String(100))
        price       = Column(Float)
        change_pct  = Column(Float)
        volume      = Column(Integer)
        rsi         = Column(Float)
        macd        = Column(Float)
        sector      = Column(String(50))
        captured_at = Column(DateTime, default=datetime.utcnow)

    class PipelineRun(Base):
        __tablename__ = "pipeline_runs"
        id           = Column(Integer, primary_key=True)
        run_at       = Column(DateTime, default=datetime.utcnow)
        stocks_count = Column(Integer)
        duration_sec = Column(Float)
        status       = Column(String(20))
        notes        = Column(Text, nullable=True)

    try:
        engine = create_async_engine(DATABASE_URL, echo=False)
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    except Exception as e:
        logger.warning(f"DB engine creation failed: {e} - running without persistence")
        DB_AVAILABLE = False

# ── In-memory pipeline log (fallback when no DB) ──────────────
pipeline_log = []

# ── Stock Universe ─────────────────────────────────────────────
WATCHLIST = [
    "RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS","ICICIBANK.NS",
    "HINDUNILVR.NS","SBIN.NS","BAJFINANCE.NS","BHARTIARTL.NS","WIPRO.NS",
    "HCLTECH.NS","ASIANPAINT.NS","MARUTI.NS","TITAN.NS","SUNPHARMA.NS",
    "LTIM.NS","NESTLEIND.NS","AXISBANK.NS","ULTRACEMCO.NS","TECHM.NS",
    "KOTAKBANK.NS","ITC.NS","POWERGRID.NS","NTPC.NS","ONGC.NS",
    "TATAMOTORS.NS","TATASTEEL.NS","ADANIENT.NS","ADANIPORTS.NS","COALINDIA.NS",
    "AAPL","GOOGL","MSFT","TSLA","AMZN","META","NVDA","NFLX","AMD","INTC",
]

STOCK_NAMES = {
    "RELIANCE.NS":"Reliance Industries","TCS.NS":"Tata Consultancy Services",
    "INFY.NS":"Infosys","HDFCBANK.NS":"HDFC Bank","ICICIBANK.NS":"ICICI Bank",
    "HINDUNILVR.NS":"Hindustan Unilever","SBIN.NS":"State Bank of India",
    "BAJFINANCE.NS":"Bajaj Finance","BHARTIARTL.NS":"Bharti Airtel","WIPRO.NS":"Wipro",
    "HCLTECH.NS":"HCL Technologies","ASIANPAINT.NS":"Asian Paints","MARUTI.NS":"Maruti Suzuki",
    "TITAN.NS":"Titan Company","SUNPHARMA.NS":"Sun Pharmaceutical","LTIM.NS":"LTIMindtree",
    "NESTLEIND.NS":"Nestle India","AXISBANK.NS":"Axis Bank","ULTRACEMCO.NS":"UltraTech Cement",
    "TECHM.NS":"Tech Mahindra","KOTAKBANK.NS":"Kotak Mahindra Bank","ITC.NS":"ITC Limited",
    "POWERGRID.NS":"Power Grid Corp","NTPC.NS":"NTPC Limited","ONGC.NS":"ONGC",
    "TATAMOTORS.NS":"Tata Motors","TATASTEEL.NS":"Tata Steel","ADANIENT.NS":"Adani Enterprises",
    "ADANIPORTS.NS":"Adani Ports","COALINDIA.NS":"Coal India",
    "AAPL":"Apple Inc.","GOOGL":"Alphabet Inc.","MSFT":"Microsoft","TSLA":"Tesla",
    "AMZN":"Amazon","META":"Meta Platforms","NVDA":"NVIDIA","NFLX":"Netflix",
    "AMD":"AMD","INTC":"Intel",
}

SECTORS = {
    "RELIANCE.NS":"Energy","TCS.NS":"IT","INFY.NS":"IT","HDFCBANK.NS":"Banking",
    "ICICIBANK.NS":"Banking","HINDUNILVR.NS":"FMCG","SBIN.NS":"Banking",
    "BAJFINANCE.NS":"Finance","BHARTIARTL.NS":"Telecom","WIPRO.NS":"IT",
    "HCLTECH.NS":"IT","ASIANPAINT.NS":"FMCG","MARUTI.NS":"Auto","TITAN.NS":"Consumer",
    "SUNPHARMA.NS":"Pharma","LTIM.NS":"IT","NESTLEIND.NS":"FMCG","AXISBANK.NS":"Banking",
    "ULTRACEMCO.NS":"Cement","TECHM.NS":"IT","KOTAKBANK.NS":"Banking","ITC.NS":"FMCG",
    "POWERGRID.NS":"Utilities","NTPC.NS":"Utilities","ONGC.NS":"Energy",
    "TATAMOTORS.NS":"Auto","TATASTEEL.NS":"Metal","ADANIENT.NS":"Conglomerate",
    "ADANIPORTS.NS":"Infrastructure","COALINDIA.NS":"Mining",
    "AAPL":"Tech","GOOGL":"Tech","MSFT":"Tech","TSLA":"Auto","AMZN":"Tech",
    "META":"Tech","NVDA":"Semiconductors","NFLX":"Media","AMD":"Semiconductors","INTC":"Semiconductors",
}

# ── Indicators ────────────────────────────────────────────────
def calculate_rsi(prices, period=14):
    if len(prices) < period+1: return 50.0
    d = np.diff(prices)
    ag = np.mean(np.where(d>0,d,0)[:period])
    al = np.mean(np.where(d<0,-d,0)[:period])
    if al==0: return 100.0
    return round(float(100-(100/(1+ag/al))),2)

def calculate_macd(prices):
    if len(prices)<26: return 0.0,0.0,0.0
    s=pd.Series(prices)
    m=float(s.ewm(span=12).mean().iloc[-1]-s.ewm(span=26).mean().iloc[-1])
    sig=float((s.ewm(span=12).mean()-s.ewm(span=26).mean()).ewm(span=9).mean().iloc[-1])
    return round(m,4),round(sig,4),round(m-sig,4)

def detect_patterns(prices):
    """Detect chart patterns with **real, deterministic confidence scores**.

    Confidence is computed from geometric / statistical properties of the pattern,
    not random numbers. Range: 50–95 (capped to keep humble).
    """
    patterns = []
    if len(prices) < 20:
        return patterns
    arr = np.array(prices)

    # Local peaks (price higher than 2 neighbours on each side)
    peaks = [
        (i, arr[i]) for i in range(2, len(arr) - 2)
        if arr[i] > arr[i-1] and arr[i] > arr[i-2]
        and arr[i] > arr[i+1] and arr[i] > arr[i+2]
    ]

    # ── Head & Shoulders ──
    if len(peaks) >= 3:
        for i in range(len(peaks) - 2):
            l, m, r = peaks[i], peaks[i+1], peaks[i+2]
            if m[1] > l[1] and m[1] > r[1]:
                # Confidence drivers:
                #   1. Shoulder symmetry (left vs right peak heights)
                #   2. Head prominence over shoulders
                #   3. Time symmetry (left-to-head distance vs head-to-right)
                shoulder_sym = 1 - abs(l[1] - r[1]) / max(l[1], r[1])  # 0..1, 1 = perfect
                head_prom = min((m[1] - max(l[1], r[1])) / m[1] * 10, 1.0)  # cap at 1
                time_sym = 1 - abs((m[0] - l[0]) - (r[0] - m[0])) / max(m[0] - l[0], r[0] - m[0], 1)
                conf = (shoulder_sym * 0.45 + head_prom * 0.30 + time_sym * 0.25) * 100
                conf = max(50, min(round(conf, 1), 95))
                if shoulder_sym > 0.95 and head_prom > 0.05:
                    patterns.append({
                        "type": "Head & Shoulders",
                        "confidence": conf,
                        "signal": "Bearish Reversal",
                        "description": f"Symmetry={shoulder_sym:.2f}, head prominence={head_prom:.2f} — neckline break confirmation needed",
                    })
                    break

    # ── Double Top ──
    if len(peaks) >= 2:
        for i in range(len(peaks) - 1):
            p1, p2 = peaks[i], peaks[i+1]
            sep = p2[0] - p1[0]
            if sep < 5:
                continue  # too close, ignore
            similarity = 1 - abs(p1[1] - p2[1]) / max(p1[1], p2[1])
            if similarity < 0.97:
                continue
            # Trough between peaks — depth strengthens the pattern
            trough = arr[p1[0]:p2[0]].min()
            depth = (max(p1[1], p2[1]) - trough) / max(p1[1], p2[1])
            depth_score = min(depth * 8, 1.0)
            conf = (similarity * 0.55 + depth_score * 0.30 + min(sep / 30, 1) * 0.15) * 100
            conf = max(50, min(round(conf, 1), 92))
            patterns.append({
                "type": "Double Top",
                "confidence": conf,
                "signal": "Bearish",
                "description": f"Peak similarity={similarity:.3f}, trough depth={depth:.2%} — resistance confirmed",
            })
            break

    # ── Trend channels (linear regression confidence) ──
    if len(arr) >= 10:
        n = min(10, len(arr))
        x = np.arange(n)
        y = arr[-n:]
        slope, intercept = np.polyfit(x, y, 1)
        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        slope_pct = slope / arr[-1]  # normalized slope
        if abs(slope_pct) > 0.001:
            # Confidence: R² (fit quality) × magnitude factor
            mag_score = min(abs(slope_pct) * 200, 1.0)
            conf = (r_squared * 0.7 + mag_score * 0.3) * 100
            conf = max(50, min(round(conf, 1), 92))
            if slope > 0:
                patterns.append({
                    "type": "Uptrend Channel",
                    "confidence": conf,
                    "signal": "Bullish",
                    "description": f"Linear fit R²={r_squared:.3f}, daily slope={slope_pct*100:+.2f}% — consistent higher highs",
                })
            else:
                patterns.append({
                    "type": "Downtrend",
                    "confidence": conf,
                    "signal": "Bearish",
                    "description": f"Linear fit R²={r_squared:.3f}, daily slope={slope_pct*100:+.2f}% — consistent lower lows",
                })
    return patterns[:3]

def _clean(x):
    """Recursively replace NaN/Inf with None so dicts are JSON-safe.
    Pandas/numpy NaN can't be serialized — this normalizes them."""
    import math
    if isinstance(x, float):
        if math.isnan(x) or math.isinf(x):
            return None
        return x
    if isinstance(x, dict):
        return {k: _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if hasattr(x, "item"):  # numpy scalar
        try:
            v = x.item()
            return _clean(v)
        except Exception:
            return None
    return x


def is_market_open():
    ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    if ist.weekday()>=5: return False
    t = ist.hour*60+ist.minute
    return (9*60+15<=t<=15*60+30) or (14*60+30<=t<=21*60)

def get_ist_time():
    ist = datetime.now(timezone.utc)+timedelta(hours=5,minutes=30)
    return ist.strftime("%A %d %B %Y %H:%M IST")

# ── Data Pipeline ─────────────────────────────────────────────
async def run_data_pipeline():
    global pipeline_log
    start_time = datetime.utcnow()
    logger.info("🔄 Pipeline started — fetching %d stocks", len(WATCHLIST))
    count = 0
    errors = []

    for symbol in WATCHLIST:
        try:
            hist = yf.Ticker(symbol).history(period="5d")
            if hist.empty or len(hist)<2: continue
            cur  = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2])
            chg  = (cur-prev)/prev*100
            prices = hist["Close"].tolist()

            snap_data = {
                "symbol":symbol, "name":STOCK_NAMES.get(symbol,symbol),
                "price":round(cur,2), "change_pct":round(chg,2),
                "volume":int(hist["Volume"].iloc[-1]),
                "rsi":calculate_rsi(prices), "macd":calculate_macd(prices)[0],
                "sector":SECTORS.get(symbol,"Other"),
                "captured_at": datetime.utcnow().isoformat(),
            }

            # Persist to DB if available
            if DB_AVAILABLE and AsyncSessionLocal:
                try:
                    async with AsyncSessionLocal() as db:
                        from sqlalchemy import text
                        snap = StockSnapshot(
                            symbol=symbol, name=snap_data["name"],
                            price=snap_data["price"], change_pct=snap_data["change_pct"],
                            volume=snap_data["volume"], rsi=snap_data["rsi"],
                            macd=snap_data["macd"], sector=snap_data["sector"],
                        )
                        db.add(snap)
                        await db.commit()
                except Exception as db_err:
                    logger.debug(f"DB write skip {symbol}: {db_err}")
            count+=1
        except Exception as e:
            errors.append(symbol)
            logger.warning("Pipeline skip %s: %s", symbol, e)

    duration = (datetime.utcnow()-start_time).total_seconds()
    run_entry = {
        "id": len(pipeline_log)+1,
        "run_at": datetime.utcnow().isoformat(),
        "stocks_count": count,
        "duration_sec": round(duration,2),
        "status": "success" if not errors else "partial",
        "notes": f"Skipped: {','.join(errors[:3])}" if errors else None,
    }
    pipeline_log.append(run_entry)
    pipeline_log = pipeline_log[-20:]  # keep last 20

    # Also persist run to DB
    if DB_AVAILABLE and AsyncSessionLocal:
        try:
            async with AsyncSessionLocal() as db:
                db.add(PipelineRun(stocks_count=count, duration_sec=round(duration,2), status=run_entry["status"], notes=run_entry["notes"]))
                await db.commit()
        except: pass

    logger.info("✅ Pipeline done — %d/%d stocks in %.1fs", count, len(WATCHLIST), duration)

# ── Startup / Shutdown ────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Init DB
    if DB_AVAILABLE and engine:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ Database initialised")
        except Exception as e:
            logger.warning(f"DB init failed (non-fatal): {e}")

    # Start scheduler
    if SCHEDULER_AVAILABLE:
        global scheduler
        scheduler = AsyncIOScheduler()
        scheduler.add_job(run_data_pipeline, "interval", minutes=15, id="data_pipeline")
        scheduler.start()
        logger.info("✅ Scheduler started — pipeline every 15 min")

    # Run pipeline immediately (non-blocking)
    asyncio.create_task(run_data_pipeline())
    logger.info("🚀 StockPulse API v3.0 ready!")

@app.on_event("shutdown")
async def shutdown():
    if scheduler and SCHEDULER_AVAILABLE:
        scheduler.shutdown()

# ── WebSocket Manager ─────────────────────────────────────────
class ConnectionManager:
    def __init__(self): self.connections: List[WebSocket] = []
    async def connect(self, ws: WebSocket): await ws.accept(); self.connections.append(ws)
    def disconnect(self, ws: WebSocket):
        if ws in self.connections: self.connections.remove(ws)

manager = ConnectionManager()

# ── REST Endpoints ────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "StockPulse API v3.1 running",
        "docs": "/docs",
        "time_ist": get_ist_time(),
        "market_open": is_market_open(),
        "db_available": DB_AVAILABLE,
        "scheduler_available": SCHEDULER_AVAILABLE,
        "cache": _yf_cache.stats(),
    }


@app.get("/health")
def health():
    """Lightweight health probe for load balancers / Render / uptime monitors."""
    return {
        "status": "healthy",
        "version": "3.1.0",
        "market_open": is_market_open(),
        "scheduler_running": scheduler.running if (scheduler and SCHEDULER_AVAILABLE) else False,
    }


@app.post("/api/admin/cache/clear")
def cache_clear():
    """Manually flush the yfinance cache. Useful for forcing a refresh."""
    _yf_cache.clear()
    return {"ok": True, "stats": _yf_cache.stats()}

@app.get("/api/pipeline/status")
async def pipeline_status():
    db_runs = []
    if DB_AVAILABLE and AsyncSessionLocal:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(10))
                db_runs = [{"id":r.id,"run_at":str(r.run_at),"stocks_count":r.stocks_count,"duration_sec":r.duration_sec,"status":r.status,"notes":r.notes} for r in result.scalars().all()]
        except: pass

    all_runs = db_runs if db_runs else pipeline_log[-10:]
    return {
        "pipeline_runs": all_runs,
        "db_enabled": DB_AVAILABLE,
        "scheduler_running": scheduler.running if (scheduler and SCHEDULER_AVAILABLE) else False,
        "last_run_at": all_runs[0]["run_at"] if all_runs else None,
        "next_run": "Every 15 minutes",
        "stocks_tracked": len(WATCHLIST),
    }

def get_market_state() -> dict:
    """Detailed market state for honest UI rendering.
    Returns: {open: bool, label: str, next_event: str, as_of: ISO timestamp}
    """
    ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    weekday = ist.weekday()
    minute_of_day = ist.hour * 60 + ist.minute

    # NSE: Mon-Fri 9:15-15:30 IST (550 to 930)
    # NYSE: Mon-Fri 19:00-01:30 IST next day (translated: 14:30-21:00 UTC; 20:00-02:30 IST when DST off)
    nse_open = (weekday < 5 and 555 <= minute_of_day <= 930)
    nyse_open = (weekday < 5 and (1140 <= minute_of_day or minute_of_day <= 150))

    if nse_open:
        return {"open": True, "label": "NSE LIVE", "exchange": "NSE",
                "as_of": ist.isoformat(), "feed_type": "live"}
    if nyse_open:
        return {"open": True, "label": "NYSE LIVE", "exchange": "NYSE",
                "as_of": ist.isoformat(), "feed_type": "live"}
    return {"open": False, "label": "MARKETS CLOSED", "exchange": None,
            "as_of": ist.isoformat(), "feed_type": "last_close",
            "note": "All prices reflect the last market close. They will not move until markets reopen."}


@app.get("/api/market/state")
def market_state():
    """Lightweight endpoint for UI banner — used to show 'last close' warning."""
    return get_market_state()


INDICES = [
    ("NIFTY 50",   "^NSEI",     "IN"),
    ("SENSEX",     "^BSESN",    "IN"),
    ("BANK NIFTY", "^NSEBANK",  "IN"),
    ("DOW JONES",  "^DJI",      "US"),
    ("NASDAQ",     "^IXIC",     "US"),
    ("S&P 500",    "^GSPC",     "US"),
]


@app.get("/api/market/overview")
async def market_overview():
    """Major indices — uses batch download to fetch all 6 at once."""
    import math
    syms = [s for _, s, _ in INDICES]
    df = _batch_download(syms, period="5d", ttl=180)

    result = []
    for name, sym, region in INDICES:
        item = {"name": name, "symbol": sym, "region": region,
                "price": 0, "change": 0, "change_pct": 0, "positive": True, "error": True}
        try:
            if df is not None and sym in df.columns.get_level_values(0):
                sym_df = df[sym].dropna(subset=["Close"])
            else:
                sym_df = cached_history(sym, period="5d", ttl=300).dropna(subset=["Close"])
            if len(sym_df) >= 2:
                cur = float(sym_df["Close"].iloc[-1])
                prev = float(sym_df["Close"].iloc[-2])
                if not math.isnan(cur) and not math.isnan(prev) and prev != 0:
                    chg = cur - prev
                    item = {
                        "name": name, "symbol": sym, "region": region,
                        "price": round(cur, 2), "change": round(chg, 2),
                        "change_pct": round(chg / prev * 100, 2),
                        "positive": chg >= 0, "error": False,
                    }
        except Exception:
            pass
        result.append(item)
    return _clean(result)

def _batch_download(symbols: list, period: str = "7d", ttl: int = 300):
    """yfinance batch download — single HTTP request for many tickers.
    Avoids per-symbol rate-limiting from Yahoo. Cached for `ttl` seconds.
    """
    key = f"batch:{','.join(sorted(symbols))}:{period}"
    cached = _yf_cache.get(key)
    if cached is not None:
        return cached
    try:
        df = yf.download(
            tickers=" ".join(symbols),
            period=period,
            group_by="ticker",
            progress=False,
            auto_adjust=True,
            threads=True,
        )
        _yf_cache.set(key, df, ttl=ttl)
        return df
    except Exception as e:
        logger.warning(f"Batch download failed: {e}")
        _yf_cache.set(key, None, ttl=30)
        return None


@app.get("/api/stocks/watchlist")
async def get_watchlist():
    """Fetches all 40 stocks in a single yfinance batch call.
    Falls back to per-symbol cached history if batch is unavailable.
    """
    import math
    result = []
    df = _batch_download(WATCHLIST, period="7d", ttl=180)

    for sym in WATCHLIST:
        try:
            # Try batch result first
            if df is not None and sym in df.columns.get_level_values(0):
                sym_df = df[sym].dropna(subset=["Close"])
            else:
                # Fallback to per-symbol cached call
                sym_df = cached_history(sym, period="7d", ttl=300).dropna(subset=["Close"])

            if len(sym_df) < 2:
                continue

            cur = float(sym_df["Close"].iloc[-1])
            prev = float(sym_df["Close"].iloc[-2])
            if math.isnan(cur) or math.isnan(prev) or prev == 0:
                continue

            chg = cur - prev
            prices = [p for p in sym_df["Close"].tolist() if not math.isnan(p)]
            if not prices:
                continue

            vol_raw = sym_df["Volume"].iloc[-1]
            vol = int(vol_raw) if not math.isnan(float(vol_raw)) else 0

            result.append({
                "symbol": sym,
                "name": STOCK_NAMES.get(sym, sym),
                "sector": SECTORS.get(sym, "Other"),
                "price": round(cur, 2),
                "change": round(chg, 2),
                "change_pct": round(chg / prev * 100, 2),
                "volume": vol,
                "rsi": calculate_rsi(prices),
                "positive": chg >= 0,
                "sparkline": [round(float(p), 2) for p in prices[-7:]],
            })
        except Exception as e:
            logger.warning("Watchlist skip %s: %s", sym, e)

    return _clean(result)

@app.get("/api/stocks/search")
async def search_stocks(q: str):
    ql=q.lower()
    return [{"symbol":s,"name":n} for s,n in STOCK_NAMES.items() if ql in s.lower() or ql in n.lower()]

@app.get("/api/stocks/{symbol}/history")
async def get_stock_history(symbol: str, period: str="1mo", interval: str="1d"):
    import math
    try:
        h = cached_history(symbol, period=period, interval=interval, ttl=300)
        if h.empty: raise HTTPException(404,"No data found")
        # Drop rows with NaN close — safest filter
        h = h.dropna(subset=["Close"])
        candles=[]
        for idx,r in h.iterrows():
            try:
                vol = int(r["Volume"]) if not math.isnan(float(r["Volume"])) else 0
                candles.append({
                    "time":idx.strftime("%Y-%m-%d"),
                    "open":round(float(r["Open"]),2),
                    "high":round(float(r["High"]),2),
                    "low":round(float(r["Low"]),2),
                    "close":round(float(r["Close"]),2),
                    "volume":vol,
                })
            except (ValueError, TypeError):
                continue
        prices=[c["close"] for c in candles]
        if not prices:
            raise HTTPException(404, "No valid price data")
        ps=pd.Series(prices)
        macd,signal,hv=calculate_macd(prices)
        def _ma(window):
            if len(prices) < window: return None
            v = ps.rolling(window).mean().iloc[-1]
            return round(float(v),2) if not math.isnan(v) else None
        return _clean({
            "symbol":symbol,"name":STOCK_NAMES.get(symbol,symbol),"candles":candles,
            "indicators":{
                "rsi":calculate_rsi(prices),
                "macd":{"macd":macd,"signal":signal,"histogram":hv},
                "moving_averages":{
                    "ma20":_ma(20), "ma50":_ma(50), "ma200":_ma(200),
                }
            },
            "patterns":detect_patterns(prices),
        })
    except HTTPException: raise
    except Exception as e: raise HTTPException(500,str(e))

@app.get("/api/stocks/{symbol}/info")
async def get_stock_info(symbol: str):
    try:
        info=yf.Ticker(symbol).info
        return {
            "symbol":symbol,"name":info.get("longName",STOCK_NAMES.get(symbol,symbol)),
            "sector":info.get("sector","N/A"),"industry":info.get("industry","N/A"),
            "market_cap":info.get("marketCap",0),"pe_ratio":info.get("trailingPE"),
            "eps":info.get("trailingEps"),"dividend_yield":info.get("dividendYield"),
            "52w_high":info.get("fiftyTwoWeekHigh"),"52w_low":info.get("fiftyTwoWeekLow"),
            "avg_volume":info.get("averageVolume"),
            "description":(info.get("longBusinessSummary","") or "")[:600],
        }
    except Exception as e: raise HTTPException(500,str(e))

@app.get("/api/analysis/correlation")
async def get_correlation(symbols: str="RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,ICICIBANK.NS"):
    try:
        data={}
        for s in symbols.split(",")[:8]:
            h=yf.Ticker(s).history(period="3mo")
            if not h.empty: data[STOCK_NAMES.get(s,s)]=h["Close"]
        if len(data)<2: return {"error":"Not enough data"}
        corr=pd.DataFrame(data).dropna().corr().round(3)
        return {"symbols":list(corr.columns),"matrix":corr.values.tolist()}
    except Exception as e: raise HTTPException(500,str(e))

@app.get("/api/portfolio/backtest")
async def backtest_portfolio(symbols: str="RELIANCE.NS,TCS.NS,INFY.NS", weights: str="0.4,0.3,0.3", period: str="1y"):
    sym_list=[s.strip() for s in symbols.split(",")]
    w_list=[float(w.strip()) for w in weights.split(",")]
    if len(sym_list)!=len(w_list): raise HTTPException(400,"Symbols/weights mismatch")
    total=sum(w_list)
    if total<=0: raise HTTPException(400,"Invalid weights")
    w_list=[w/total for w in w_list]
    try:
        data={s:yf.Ticker(s).history(period=period)["Close"] for s in sym_list}
        data={k:v for k,v in data.items() if not v.empty}
        if not data: raise HTTPException(400,"No data fetched")
        df=pd.DataFrame(data).dropna()
        valid=[s for s in sym_list if s in df.columns]
        w=[w_list[sym_list.index(s)] for s in valid]
        w_norm=[x/sum(w) for x in w]
        rets=df[valid].pct_change().dropna()
        port=rets.dot(np.array(w_norm))
        cum=(1+port).cumprod()
        std=port.std()
        return {
            "total_return_pct":round(float((cum.iloc[-1]-1)*100),2),
            "volatility_pct":round(float(std*np.sqrt(252)*100),2),
            "sharpe_ratio":round(float(port.mean()*252/(std*np.sqrt(252))),3) if std>0 else 0,
            "max_drawdown_pct":round(float(((cum/cum.cummax())-1).min()*100),2),
            "timeline":[{"date":str(d.date()),"value":round(float(v)*100,2)} for d,v in zip(cum.index,cum.values)],
        }
    except HTTPException: raise
    except Exception as e: raise HTTPException(500,str(e))

@app.get("/api/screener")
async def screener(min_rsi:float=0,max_rsi:float=100,min_change:float=-100,max_change:float=100,sector:str="All",sort_by:str="change_pct"):
    async def fetch(sym):
        try:
            h = cached_history(sym, period="5d", ttl=180)
            if h.empty or len(h)<2: return None
            cur,prev=float(h["Close"].iloc[-1]),float(h["Close"].iloc[-2])
            chg=(cur-prev)/prev*100; rsi=calculate_rsi(h["Close"].tolist())
            vol=int(h["Volume"].iloc[-1]); avg=int(h["Volume"].mean())
            sec=SECTORS.get(sym,"Other")
            if not(min_rsi<=rsi<=max_rsi) or not(min_change<=chg<=max_change): return None
            if sector!="All" and sec!=sector: return None
            return {"symbol":sym,"name":STOCK_NAMES.get(sym,sym),"sector":sec,"price":round(cur,2),"change_pct":round(chg,2),"rsi":round(rsi,1),"volume":vol,"vol_ratio":round(vol/avg,2) if avg>0 else 1.0,"signal":"Overbought" if rsi>70 else "Oversold" if rsi<30 else "Neutral"}
        except: return None
    raw=await asyncio.gather(*[fetch(s) for s in WATCHLIST[:30]])
    results=[r for r in raw if r]
    results.sort(key=lambda x:x.get(sort_by,0),reverse=True)
    return _clean(results)

@app.get("/api/heatmap")
async def sector_heatmap():
    """Sector heatmap — uses batch download to fetch all 40 stocks at once."""
    import math
    from collections import defaultdict
    df = _batch_download(WATCHLIST, period="5d", ttl=180)
    raw = []
    for sym in WATCHLIST:
        try:
            if df is not None and sym in df.columns.get_level_values(0):
                sym_df = df[sym].dropna(subset=["Close"])
            else:
                sym_df = cached_history(sym, period="5d", ttl=300).dropna(subset=["Close"])
            if len(sym_df) < 2:
                continue
            cur = float(sym_df["Close"].iloc[-1])
            prev = float(sym_df["Close"].iloc[-2])
            if math.isnan(cur) or math.isnan(prev) or prev == 0:
                continue
            raw.append({
                "symbol": sym.replace(".NS", ""),
                "name": STOCK_NAMES.get(sym, sym),
                "sector": SECTORS.get(sym, "Other"),
                "change_pct": round((cur - prev) / prev * 100, 2),
                "price": round(cur, 2),
            })
        except Exception:
            continue
    by_sec=defaultdict(list)
    for r in raw:
        if r: by_sec[r["sector"]].append(r)
    result=[{"sector":k,"avg_change_pct":round(sum(i["change_pct"] for i in v)/len(v),2),"stocks":sorted(v,key=lambda x:abs(x["change_pct"]),reverse=True),"count":len(v)} for k,v in by_sec.items()]
    result.sort(key=lambda x:x["avg_change_pct"],reverse=True)
    return _clean(result)

# ── WebSocket — real prices when available, transparently labeled ──
async def _fetch_realtime_price(symbol: str) -> Optional[dict]:
    """Hit yfinance for the latest 1-min bar. Labelled 'live' on success."""
    try:
        h = yf.Ticker(symbol).history(period="1d", interval="1m")
        if h.empty:
            return None
        cur = float(h["Close"].iloc[-1])
        prev_close = float(yf.Ticker(symbol).history(period="2d")["Close"].iloc[-2])
        chg_pct = (cur - prev_close) / prev_close * 100
        return {"price": round(cur, 2), "change_pct": round(chg_pct, 4), "feed": "live"}
    except Exception:
        return None


@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """Real-time feed.

    Behaviour by market state:
      • Open  → polls yfinance 1-min bars every 15s (real data, ~1-min lag).
      • Closed → broadcasts last close price every 30s, no synthetic walks.

    Honest labelling: every payload includes `feed_type` ∈ {"live","last_close"}.
    """
    await manager.connect(ws)
    # Seed with last-known prices
    base_prices = {}
    for sym in WATCHLIST[:15]:
        try:
            h = yf.Ticker(sym).history(period="2d")
            if not h.empty:
                base_prices[sym] = float(h["Close"].iloc[-1])
        except Exception:
            pass

    try:
        while True:
            open_now = is_market_open()
            updates = []
            feed_type = "live" if open_now else "last_close"

            if open_now:
                # Real-time: parallel yfinance fetches with timeout
                results = await asyncio.gather(
                    *[asyncio.to_thread(lambda s=s: _fetch_realtime_price_sync(s)) for s in base_prices.keys()],
                    return_exceptions=True,
                )
                for sym, res in zip(base_prices.keys(), results):
                    if isinstance(res, dict) and res:
                        base_prices[sym] = res["price"]
                        updates.append({
                            "symbol": sym, "price": res["price"],
                            "change_pct": res["change_pct"],
                            "feed_type": "live", "market_open": True,
                            "timestamp": datetime.now().isoformat(),
                        })
                    else:
                        # Fallback: send last-known with 0% change, marked as stale
                        updates.append({
                            "symbol": sym, "price": round(base_prices.get(sym, 0), 2),
                            "change_pct": 0.0, "feed_type": "stale", "market_open": True,
                            "timestamp": datetime.now().isoformat(),
                        })
            else:
                # Market closed: broadcast last close, no synthetic walks
                for sym, base in base_prices.items():
                    updates.append({
                        "symbol": sym, "price": round(base, 2),
                        "change_pct": 0.0, "feed_type": "last_close", "market_open": False,
                        "timestamp": datetime.now().isoformat(),
                    })

            await ws.send_json({
                "type": "price_update", "market_open": open_now,
                "feed_type": feed_type, "data": updates,
            })
            await asyncio.sleep(15 if open_now else 30)
    except WebSocketDisconnect:
        manager.disconnect(ws)


def _fetch_realtime_price_sync(symbol: str) -> Optional[dict]:
    """Sync version for use with asyncio.to_thread."""
    try:
        t = yf.Ticker(symbol)
        intraday = t.history(period="1d", interval="1m")
        if intraday.empty:
            return None
        cur = float(intraday["Close"].iloc[-1])
        daily = t.history(period="2d")
        if len(daily) < 2:
            return None
        prev_close = float(daily["Close"].iloc[-2])
        chg_pct = (cur - prev_close) / prev_close * 100
        return {"price": round(cur, 2), "change_pct": round(chg_pct, 4), "feed": "live"}
    except Exception:
        return None

# ── AI Chat ───────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    symbol: Optional[str] = None

def detect_provider():
    key=os.getenv("GROQ_API_KEY","").strip()
    if key: return "groq","llama-3.3-70b-versatile",key
    return "ollama","llama3.2",""

def _safe_close_pair(df):
    """Return (current, previous) close pair from a yfinance dataframe,
    skipping NaN rows. Returns (None, None) if not enough valid data."""
    import math
    if df is None or df.empty:
        return None, None
    closes = [float(c) for c in df["Close"].tolist() if not math.isnan(float(c))]
    if len(closes) < 2:
        return None, None
    return closes[-1], closes[-2]


async def build_market_context(symbol):
    """Build a system-prompt context block with live market data.
    All values are pre-validated — no NaN strings ever leak to the LLM.
    """
    import math
    market_state = get_market_state()
    lines = [
        "You are StockPulse AI, an expert financial analyst with live market data below.",
        "Give precise, data-driven answers. Cite actual numbers. Never give explicit buy/sell advice.",
        f"Time: {get_ist_time()}",
        f"Market state: {market_state['label']} (open={market_state['open']})",
        "" if market_state['open'] else "NOTE: Markets are closed. All prices below reflect the LAST CLOSING PRICE.",
        "",
    ]

    # ── INDICES ──
    try:
        idx_lines = []
        for name, sym, _region in INDICES:
            h = cached_history(sym, period="5d", ttl=300)
            cur, prev = _safe_close_pair(h)
            if cur is None or prev is None or prev == 0:
                continue
            chg = (cur - prev) / prev * 100
            idx_lines.append(f"  {name:11s}: {cur:>10,.2f}  ({chg:+.2f}%)")
        if idx_lines:
            lines.append("=== INDICES (last close) ===" if not market_state['open'] else "=== LIVE INDICES ===")
            lines.extend(idx_lines)
            lines.append("")
    except Exception:
        pass

    # ── FOCUSED SYMBOL ──
    if symbol:
        try:
            h = cached_history(symbol, period="1mo", ttl=300)
            info = cached_info(symbol, ttl=1800)
            cur, prev = _safe_close_pair(h)
            if cur is not None and prev is not None and prev != 0:
                pl = [float(c) for c in h["Close"].tolist() if not math.isnan(float(c))]
                rsi = calculate_rsi(pl)
                macd, sig, hv = calculate_macd(pl)
                ps = pd.Series(pl)
                ma20_raw = ps.rolling(20).mean().iloc[-1] if len(pl) >= 20 else float('nan')
                ma50_raw = ps.rolling(50).mean().iloc[-1] if len(pl) >= 50 else float('nan')
                ma20 = float(ma20_raw) if not math.isnan(ma20_raw) else None
                ma50 = float(ma50_raw) if not math.isnan(ma50_raw) else None
                pats = detect_patterns(pl)
                long_name = info.get('longName') or info.get('shortName') or symbol
                rsi_tag = '[OVERBOUGHT]' if rsi > 70 else '[OVERSOLD]' if rsi < 30 else '[NEUTRAL]'
                day_chg_pct = (cur - prev) / prev * 100
                lines += [
                    f"=== FOCUSED: {symbol} ({long_name}) ===",
                    f"  Price       : {cur:.2f}  ({day_chg_pct:+.2f}% vs prior close)",
                    f"  RSI(14)     : {rsi:.1f} {rsi_tag}",
                    f"  MACD        : {macd:.4f}   Signal: {sig:.4f}   Hist: {hv:+.4f}",
                ]
                if ma20:
                    lines.append(f"  MA20        : {ma20:.2f}  ({'above (bullish)' if cur > ma20 else 'below (bearish)'})")
                if ma50:
                    lines.append(f"  MA50        : {ma50:.2f}  ({'above (bullish)' if cur > ma50 else 'below (bearish)'})")
                pe = info.get('trailingPE')
                if isinstance(pe, (int, float)) and not math.isnan(pe):
                    lines.append(f"  P/E         : {pe:.2f}")
                if pats:
                    pat_summary = ", ".join(f"{p['type']} ({p['confidence']:.0f}% conf)" for p in pats)
                    lines.append(f"  Patterns    : {pat_summary}")
                # Last-7-day mini history for additional context
                if len(pl) >= 7:
                    week_ago = pl[-7]
                    week_chg = (cur - week_ago) / week_ago * 100
                    lines.append(f"  7-day change: {week_chg:+.2f}%")
                lines.append("")
        except Exception as e:
            logger.warning(f"build_market_context FOCUSED failed for {symbol}: {e}")

    # ── TOP MOVERS (from watchlist batch) ──
    try:
        df = _batch_download(WATCHLIST[:30], period="5d", ttl=300)
        movers = []
        for sym in WATCHLIST[:30]:
            try:
                if df is not None and sym in df.columns.get_level_values(0):
                    sym_df = df[sym].dropna(subset=["Close"])
                else:
                    sym_df = cached_history(sym, period="5d", ttl=300).dropna(subset=["Close"])
                cur, prev = _safe_close_pair(sym_df)
                if cur is None or prev is None or prev == 0:
                    continue
                chg = (cur - prev) / prev * 100
                movers.append((sym.replace(".NS", ""), chg, cur))
            except Exception:
                continue
        movers.sort(key=lambda x: abs(x[1]), reverse=True)
        if movers:
            lines.append("=== TOP MOVERS (by abs % change) ===")
            for n, c, p in movers[:6]:
                lines.append(f"  {n:15s} {p:>10,.2f}  {c:+.2f}%")
    except Exception:
        pass

    return "\n".join(lines)

@app.get("/api/chat/status")
async def chat_status():
    provider,model,key=detect_provider()
    ready=bool(key) if provider!="ollama" else True
    return {"provider":provider,"model":model,"ready":ready,"message":f"Groq ({model}) ready" if ready else "Set GROQ_API_KEY env var — free at console.groq.com"}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    provider,model,api_key=detect_provider()
    if provider=="groq" and not api_key:
        raise HTTPException(503,"NO_KEY: Set GROQ_API_KEY env var.\nexport GROQ_API_KEY=gsk_...\nFree key: https://console.groq.com/keys")
    context=await build_market_context(req.symbol)
    msgs=[{"role":"system","content":context}]+[{"role":m.role,"content":m.content} for m in req.messages]
    url="https://api.groq.com/openai/v1/chat/completions" if provider=="groq" else "http://localhost:11434/v1/chat/completions"
    headers={"Authorization":f"Bearer {api_key}","Content-Type":"application/json"} if provider=="groq" else {"Content-Type":"application/json"}
    body={"model":model,"messages":msgs,"stream":True,"max_tokens":1024,"temperature":0.65}

    async def stream():
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream("POST",url,headers=headers,json=body) as resp:
                    if resp.status_code!=200:
                        raw=await resp.aread()
                        try: msg=json.loads(raw).get("error",{}).get("message",raw.decode()[:300])
                        except: msg=raw.decode(errors="replace")[:300]
                        yield f"data: {json.dumps({'error':f'API {resp.status_code}: {msg}'})}\n\n"; return
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "): continue
                        data=line[6:].strip()
                        if data=="[DONE]": yield "data: [DONE]\n\n"; return
                        try:
                            text=json.loads(data)["choices"][0]["delta"].get("content","")
                            if text: yield f"data: {json.dumps({'text':text})}\n\n"
                        except: pass
        except httpx.ConnectError:
            yield f"data: {json.dumps({'error':'Cannot connect. Check internet or Ollama server.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error':str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

# ── Serve built frontend in production (single-service deploy) ────────
# When frontend has been built (dist/ exists), serve it from this same app.
# This means one Render service can host both API and SPA at one URL.
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
_FRONTEND_DIST = os.path.abspath(_FRONTEND_DIST)

if os.path.isdir(_FRONTEND_DIST):
    logger.info(f"Serving SPA from {_FRONTEND_DIST}")

    # Mount /assets (vite-bundled JS/CSS/images)
    _assets_dir = os.path.join(_FRONTEND_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    # SPA fallback — any GET that wasn't matched above returns index.html.
    # Browser router then handles client-side routing.
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # If a real file exists in dist, serve it directly (favicon, robots.txt, etc.)
        candidate = os.path.join(_FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        # Otherwise return index.html — React handles the route
        index = os.path.join(_FRONTEND_DIST, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        raise HTTPException(404, "Frontend not built. Run `npm run build` in frontend/.")
else:
    logger.info("Frontend dist not found — running in API-only mode (use vite dev for UI)")


if __name__=="__main__":
    import uvicorn
    uvicorn.run("main:app",host="0.0.0.0",port=8000,reload=True)

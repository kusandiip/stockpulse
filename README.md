# 📈 StockPulse — Real-Time Stock Market Analytics Platform

> A Bloomberg Terminal-inspired analytics platform for NSE & US markets.
> Built as a Data Engineering showcase project.

## 🚀 Quick Start

### Mac/Linux
```bash
# 1. Set AI key (free at console.groq.com/keys)
export GROQ_API_KEY=gsk_your_key_here

# 2. Launch everything
chmod +x start.sh && ./start.sh
```

### Windows
```bash
# Set key in terminal first
set GROQ_API_KEY=gsk_your_key_here

# Then run
start.bat
```

Open **http://localhost:3000**

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Live Dashboard** | Real-time ticker tape, NIFTY/SENSEX/NASDAQ/S&P cards, 40-stock watchlist |
| 🕯️ **Chart Analysis** | Candlestick chart, RSI gauge, MACD, MA20/50, pattern detection |
| 🔍 **Stock Screener** | Filter by RSI, change%, sector, volume spike — 4 preset strategies |
| 🗺️ **Sector Heatmap** | Color-coded real-time sector performance across 14 sectors |
| 🔗 **Correlation Matrix** | Cross-stock correlation heatmap (up to 8 stocks) |
| 🧪 **Backtester** | Historical simulation with Sharpe ratio, drawdown, equity curve |
| 🤖 **AI Chat** | Groq Llama 3.3 70B with live market context injected |
| 🔄 **Data Pipeline** | APScheduler ETL pipeline — runs every 15 min, full audit log |

---

## 🏗️ Architecture

```
Data Sources (Yahoo Finance API, NSE)
    ↓ Extract
yfinance library
    ↓ Transform
pandas / numpy → RSI, MACD, MA, Patterns
    ↓ Load
SQLAlchemy → SQLite (local) / PostgreSQL (prod)
    ↓ Serve
FastAPI REST + WebSocket
    ↓
React Frontend (Recharts, real-time updates)
```

## 📦 Tech Stack

**Backend:** FastAPI · Python 3.12 · SQLAlchemy · APScheduler · yfinance · pandas · numpy · httpx

**Frontend:** React 18 · Recharts · Vite · Lucide Icons

**AI:** Groq (Llama 3.3 70B) / Ollama (local)

**Database:** SQLite → PostgreSQL (production)

**Data:** Yahoo Finance API · NSE India

---

## 🌐 API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/market/overview` | NIFTY, SENSEX, NASDAQ, S&P 500 |
| `GET /api/stocks/watchlist` | All 40 stocks with RSI, sparkline |
| `GET /api/stocks/{symbol}/history` | OHLCV + indicators + patterns |
| `GET /api/stocks/{symbol}/info` | Fundamentals |
| `GET /api/screener` | Stock screener with filters |
| `GET /api/heatmap` | Sector performance heatmap |
| `GET /api/analysis/correlation` | Correlation matrix |
| `GET /api/portfolio/backtest` | Portfolio backtester |
| `GET /api/pipeline/status` | Data pipeline audit log |
| `POST /api/chat` | AI chat with live market context |
| `WS /ws/live` | Live price WebSocket stream |

---

## 🚀 Production Deployment (Railway)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "StockPulse v3.0"
git remote add origin https://github.com/yourname/stockpulse
git push -u origin main

# 2. Deploy on Railway
# - Go to railway.app → New Project → Deploy from GitHub
# - Add environment variable: GROQ_API_KEY=gsk_...
# - Railway auto-detects and deploys both services
```

---

## 📊 Data Engineering Notes

- **Pipeline runs every 15 minutes** via APScheduler
- **SQLite locally → PostgreSQL in production** (change DATABASE_URL env var)
- **Full audit trail** of every pipeline run stored in `pipeline_runs` table
- **Scale-up path:** Replace APScheduler with Apache Kafka, SQLite with TimescaleDB
- **5TB+ scale:** Add Apache Spark for historical batch processing


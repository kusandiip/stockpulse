#!/bin/bash
set -e

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'; BOLD='\033[1m'
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║  StockPulse v3.0 — Starting Platform     ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Kill existing processes ──────────────────────────────────
echo -e "${YELLOW}▶ Cleaning up old processes...${NC}"
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# ── Backend setup ─────────────────────────────────────────────
echo -e "${YELLOW}▶ Setting up Python backend...${NC}"
cd "$SCRIPT_DIR/backend"

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python 3 not found. Install from https://python.org${NC}"; exit 1
fi

echo "  Python: $(python3 --version)"

# Create venv if missing
if [ ! -d "venv" ]; then
  echo "  Creating virtual environment..."
  python3 -m venv venv
fi

# Activate
source venv/bin/activate
echo "  Upgrading pip + build tools..."
pip install --upgrade pip setuptools wheel -q

echo "  Installing packages (first run may take ~2 minutes)..."
pip install -r requirements.txt -q
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Package install failed. Trying with --no-cache-dir...${NC}"
  pip install -r requirements.txt -q --no-cache-dir
fi

echo -e "${GREEN}  ✓ Python ready${NC}"

# ── Test backend starts ───────────────────────────────────────
echo -e "${YELLOW}▶ Starting backend (port 8000)...${NC}"
cd "$SCRIPT_DIR/backend"
source venv/bin/activate

# Start backend, capture output to log file too
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/stockpulse_backend.log 2>&1 &
BACKEND_PID=$!

# Wait up to 15 seconds for backend to be ready
echo "  Waiting for backend to start..."
for i in $(seq 1 15); do
  sleep 1
  if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Backend running on http://localhost:8000${NC}"
    break
  fi
  if [ $i -eq 15 ]; then
    echo -e "${RED}✗ Backend failed to start! Check error below:${NC}"
    echo ""
    cat /tmp/stockpulse_backend.log
    echo ""
    echo -e "${YELLOW}Common fix: Run this in your terminal:${NC}"
    echo "  cd backend && source venv/bin/activate && python main.py"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  echo "  ... ($i/15)"
done

# ── Frontend setup ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ Setting up Node.js frontend...${NC}"
cd "$SCRIPT_DIR/frontend"

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"; exit 1
fi
echo "  Node: $(node --version)"

npm install --silent
echo -e "${GREEN}  ✓ Frontend ready${NC}"

# ── Launch frontend ───────────────────────────────────────────
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ✓ StockPulse is running!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}→ Open: http://localhost:3000${NC}"
echo -e "  ${CYAN}→ API:  http://localhost:8000/docs${NC}"
echo ""
echo -e "  ${YELLOW}GROQ_API_KEY: ${GROQ_API_KEY:+SET ✓}${GROQ_API_KEY:-NOT SET ⚠️  (AI chat won't work)}${NC}"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop${NC}"
echo ""

trap "echo ''; echo -e '${YELLOW}Shutting down...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $FRONTEND_PID

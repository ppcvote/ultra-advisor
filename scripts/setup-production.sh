#!/usr/bin/env bash
# ============================================================================
# Sprint 13-15 Production Setup (one-script orchestrator)
# ----------------------------------------------------------------------------
# 跑完整 production pipeline:
#   1. Extract PDF text (22k PDFs)
#   2. Build embeddings (180k chunks)
#   3. Upload PDFs to Firebase Storage
#   4. Upload chunks to Firestore
#   5. Ingest catalog (Sprint 13)
#   6. Backfill versioned schema (Sprint 15 W1)
#   7. Deploy Firestore rules + indexes
#   8. Deploy Cloud Functions
#
# Usage:
#   scripts/setup-production.sh                # dry-run (default, safe)
#   scripts/setup-production.sh --commit       # 真寫 Firestore / Storage
#   scripts/setup-production.sh --commit --skip-extract --skip-embed
#
# Flags:
#   --commit         真寫 (預設 dry-run、不寫任何 remote state)
#   --skip-extract   跳過 PDF text extraction
#   --skip-embed     跳過 embeddings build
#   --skip-upload    跳過 PDF + chunk upload
#   --skip-migrate   跳過 catalog ingest + versioning backfill
#   --skip-deploy    跳過 Firestore rules / indexes / functions deploy
#   -h | --help      show this help
#
# 平台:
#   - Linux / macOS: bash 直接跑
#   - Windows: git-bash 跑 (POSIX-compatible)
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DRY_RUN=true
SKIP_EXTRACT=false
SKIP_EMBED=false
SKIP_UPLOAD=false
SKIP_MIGRATE=false
SKIP_DEPLOY=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ANSI colors (skip if non-tty)
if [ -t 1 ]; then
  C_RESET="\033[0m"
  C_BOLD="\033[1m"
  C_GREEN="\033[32m"
  C_YELLOW="\033[33m"
  C_BLUE="\033[34m"
  C_RED="\033[31m"
  C_DIM="\033[2m"
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_RED=""; C_DIM=""
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()    { printf "%b\n" "${C_BLUE}[$(date +%H:%M:%S)]${C_RESET} $*"; }
ok()     { printf "%b\n" "${C_GREEN}[OK]${C_RESET} $*"; }
warn()   { printf "%b\n" "${C_YELLOW}[WARN]${C_RESET} $*"; }
err()    { printf "%b\n" "${C_RED}[ERR]${C_RESET} $*" >&2; }
step()   { printf "\n%b\n" "${C_BOLD}${C_BLUE}━━━ $* ━━━${C_RESET}"; }

usage() {
  sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "需要的 command 不存在: $1"
    exit 1
  fi
}

check_env_var() {
  if [ -z "${!1:-}" ]; then
    err "環境變數 $1 缺失"
    err "請先 export $1=... 再跑此腳本"
    exit 1
  fi
}

check_file() {
  if [ ! -f "$1" ]; then
    err "找不到檔案: $1"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit)        DRY_RUN=false ;;
    --skip-extract)  SKIP_EXTRACT=true ;;
    --skip-embed)    SKIP_EMBED=true ;;
    --skip-upload)   SKIP_UPLOAD=true ;;
    --skip-migrate)  SKIP_MIGRATE=true ;;
    --skip-deploy)   SKIP_DEPLOY=true ;;
    -h|--help)       usage ;;
    *) err "Unknown flag: $1"; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
printf "\n%b\n" "${C_BOLD}Sprint 13-15 Production Setup${C_RESET}"
printf "%b\n" "${C_DIM}Project root: ${PROJECT_ROOT}${C_RESET}"
if $DRY_RUN; then
  printf "%b\n\n" "${C_YELLOW}Mode: DRY-RUN (no remote writes, pass --commit to apply)${C_RESET}"
else
  printf "%b\n\n" "${C_RED}Mode: COMMIT (will write to Firestore / Storage / Functions)${C_RESET}"
  read -r -p "確定要對 production 寫入嗎? [yes/NO] " confirm
  if [ "$confirm" != "yes" ]; then
    err "Aborted by user"
    exit 1
  fi
fi

cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Step 0: Preflight checks
# ---------------------------------------------------------------------------
step "Step 0/8: Preflight checks"

require_cmd node
require_cmd python
require_cmd firebase

check_env_var GOOGLE_APPLICATION_CREDENTIALS
check_env_var GEMINI_API_KEY

# Service account file must exist
check_file "$GOOGLE_APPLICATION_CREDENTIALS"

# Sanity: confirm firebase CLI is logged in to a project
if ! firebase projects:list >/dev/null 2>&1; then
  err "firebase CLI 未登入。請先跑 'firebase login'"
  exit 1
fi

ok "preflight checks 全部通過"
log "Node: $(node --version)"
log "Python: $(python --version 2>&1)"
log "Firebase CLI: $(firebase --version)"

# ---------------------------------------------------------------------------
# Step 1: Extract PDF text
# ---------------------------------------------------------------------------
if $SKIP_EXTRACT; then
  step "Step 1/8: Extract PDFs — SKIPPED"
else
  step "Step 1/8: Extract 22k PDF text (預估 1-2 hr, 可 resume)"
  check_file "scripts/extract-pdf-text.py"
  # resume-safe: 重跑會跳過已 extract 過的
  python scripts/extract-pdf-text.py --resume
  ok "PDF text extraction done"
fi

# ---------------------------------------------------------------------------
# Step 2: Build embeddings
# ---------------------------------------------------------------------------
if $SKIP_EMBED; then
  step "Step 2/8: Build embeddings — SKIPPED"
else
  step "Step 2/8: Build embeddings for 180k chunks (預估 60-90 min, ~NT\$50, 可 resume)"
  check_file "scripts/build-embeddings.cjs"
  node scripts/build-embeddings.cjs --resume
  ok "embeddings built"
fi

# ---------------------------------------------------------------------------
# Step 3: Upload PDFs to Firebase Storage
# ---------------------------------------------------------------------------
if $SKIP_UPLOAD; then
  step "Step 3/8: Upload PDFs to Storage — SKIPPED"
else
  step "Step 3/8: Upload 22k PDFs to Firebase Storage (預估 30 min)"
  check_file "scripts/upload-pdfs-to-storage.cjs"
  if $DRY_RUN; then
    node scripts/upload-pdfs-to-storage.cjs --dry-run
  else
    node scripts/upload-pdfs-to-storage.cjs --commit
  fi
  ok "PDFs uploaded"
fi

# ---------------------------------------------------------------------------
# Step 4: Upload chunks to Firestore
# ---------------------------------------------------------------------------
if $SKIP_UPLOAD; then
  step "Step 4/8: Upload chunks to Firestore — SKIPPED"
else
  step "Step 4/8: Upload 180k chunks to Firestore (預估 30 min, batched)"
  check_file "scripts/upload-chunks-to-firestore.cjs"
  if $DRY_RUN; then
    node scripts/upload-chunks-to-firestore.cjs --dry-run
  else
    node scripts/upload-chunks-to-firestore.cjs --commit
  fi
  ok "chunks uploaded"
fi

# ---------------------------------------------------------------------------
# Step 5: Ingest Sprint 13 catalog (33k products)
# ---------------------------------------------------------------------------
if $SKIP_MIGRATE; then
  step "Step 5/8: Ingest catalog — SKIPPED"
else
  step "Step 5/8: Ingest Sprint 13 catalog (33k products)"
  check_file "scripts/ingest-catalog-to-firestore.cjs"
  if $DRY_RUN; then
    node scripts/ingest-catalog-to-firestore.cjs --dry-run
  else
    node scripts/ingest-catalog-to-firestore.cjs --commit
  fi
  ok "catalog ingested"
fi

# ---------------------------------------------------------------------------
# Step 6: Versioning backfill (Sprint 15 W1)
# ---------------------------------------------------------------------------
if $SKIP_MIGRATE; then
  step "Step 6/8: Versioning backfill — SKIPPED"
else
  step "Step 6/8: Backfill versioned schema (Sprint 15 W1)"
  check_file "scripts/migrate-to-versioned-schema.cjs"
  if $DRY_RUN; then
    node scripts/migrate-to-versioned-schema.cjs --product-only --dry-run
    node scripts/migrate-to-versioned-schema.cjs --policy-only --dry-run
  else
    node scripts/migrate-to-versioned-schema.cjs --product-only --commit
    node scripts/migrate-to-versioned-schema.cjs --policy-only --commit
  fi
  ok "versioning backfill done"
fi

# ---------------------------------------------------------------------------
# Step 7: Deploy Firestore rules + indexes
# ---------------------------------------------------------------------------
if $SKIP_DEPLOY; then
  step "Step 7/8: Deploy Firestore rules + indexes — SKIPPED"
else
  step "Step 7/8: Deploy Firestore rules + indexes"
  if $DRY_RUN; then
    log "[dry-run] would run: firebase deploy --only firestore:rules"
    log "[dry-run] would run: firebase deploy --only firestore:indexes"
    warn "composite index 通常需在 Firebase Console 手動建立、看 docs/SPRINT-15-DEPLOY.md"
  else
    firebase deploy --only firestore:rules
    firebase deploy --only firestore:indexes
  fi
  ok "rules + indexes deployed"
fi

# ---------------------------------------------------------------------------
# Step 8: Deploy Cloud Functions
# ---------------------------------------------------------------------------
if $SKIP_DEPLOY; then
  step "Step 8/8: Deploy Cloud Functions — SKIPPED"
else
  step "Step 8/8: Deploy Cloud Functions (Sprint 13-15)"
  if $DRY_RUN; then
    log "[dry-run] would run: firebase deploy --only functions"
  else
    firebase deploy --only functions
  fi
  ok "functions deployed"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
printf "\n%b\n" "${C_BOLD}${C_GREEN}Sprint 13-15 setup complete.${C_RESET}"
if $DRY_RUN; then
  printf "%b\n" "${C_YELLOW}(dry-run — pass --commit to apply for real)${C_RESET}"
fi
printf "%b\n" "${C_DIM}Next: 看 docs/SPRINT-15-DEPLOY.md 的 smoke tests 確認部署${C_RESET}"

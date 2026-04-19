#!/usr/bin/env bash
# kb-tool installer
# Usage: curl -fsSL https://raw.githubusercontent.com/v-yatskin/vibe-discovery-kb-tool/main/scripts/install.sh | bash

set -euo pipefail

REPO="https://github.com/v-yatskin/vibe-discovery-kb-tool.git"
INSTALL_DIR="${KB_INSTALL_DIR:-$HOME/.kb/app}"
MIN_NODE_MAJOR=20

color_green="\033[32m"
color_red="\033[31m"
color_dim="\033[2m"
color_reset="\033[0m"

say()  { printf "%b→%b %s\n" "$color_dim" "$color_reset" "$*"; }
ok()   { printf "%b✓%b %s\n" "$color_green" "$color_reset" "$*"; }
die()  { printf "%b✗%b %s\n" "$color_red" "$color_reset" "$*" >&2; exit 1; }

# --- preflight ---------------------------------------------------------------

command -v git  >/dev/null 2>&1 || die "git is required. Install Xcode command line tools: xcode-select --install"
command -v node >/dev/null 2>&1 || die "Node.js $MIN_NODE_MAJOR+ is required. Install from https://nodejs.org (pick the LTS) and re-run."
command -v npm  >/dev/null 2>&1 || die "npm is required (usually ships with Node.js)."

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  die "Node $MIN_NODE_MAJOR+ required (have $(node -v)). Upgrade from https://nodejs.org."
fi

if ! command -v gh >/dev/null 2>&1; then
  say "Note: \`gh\` CLI not found. kb needs it for the publish flow."
  say "      Install later with: brew install gh && gh auth login"
fi

# --- clone / update ----------------------------------------------------------

mkdir -p "$(dirname "$INSTALL_DIR")"

if [ -d "$INSTALL_DIR/.git" ]; then
  say "Updating kb-tool in $INSTALL_DIR..."
  git -C "$INSTALL_DIR" fetch --depth 1 origin main
  git -C "$INSTALL_DIR" reset --hard origin/main
else
  say "Cloning kb-tool into $INSTALL_DIR..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
fi

# --- build -------------------------------------------------------------------

cd "$INSTALL_DIR"
say "Installing dependencies..."
npm install --silent --no-audit --no-fund

say "Building..."
npm run build --silent

# --- link globally -----------------------------------------------------------

say "Linking kb globally..."
if npm install -g . --silent --no-audit --no-fund 2>/dev/null; then
  :
else
  # npm's global prefix isn't writable — fall back to a user-local symlink.
  LOCAL_BIN="$HOME/.local/bin"
  mkdir -p "$LOCAL_BIN"
  ln -sf "$INSTALL_DIR/dist/index.js" "$LOCAL_BIN/kb"
  chmod +x "$INSTALL_DIR/dist/index.js"
  case ":$PATH:" in
    *":$LOCAL_BIN:"*) ;;
    *) say "Add this to your ~/.zshrc: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
  esac
fi

# --- done --------------------------------------------------------------------

echo ""
ok "kb installed."
echo ""
echo "Next steps:"
echo "  1. Verify:  kb --version"
echo "  2. If you don't have gh yet:  brew install gh && gh auth login"
echo "  3. Clone your team's vault and open it in Claude Code + Obsidian."
echo ""

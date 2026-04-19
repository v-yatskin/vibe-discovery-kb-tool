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

LOCAL_BIN="$HOME/.local/bin"
say "Linking kb to $LOCAL_BIN/kb..."
mkdir -p "$LOCAL_BIN"
ln -sf "$INSTALL_DIR/dist/index.js" "$LOCAL_BIN/kb"
chmod +x "$INSTALL_DIR/dist/index.js"

# Detect shell profile and append PATH export if not already present.
PATH_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\""
SHELL_RC=""
case "${SHELL:-}" in
  */zsh)  SHELL_RC="$HOME/.zshrc" ;;
  */bash) SHELL_RC="$HOME/.bashrc" ;;
esac

PATH_ADDED=false
if [ -n "$SHELL_RC" ]; then
  if ! grep -qF '.local/bin' "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Added by kb installer" >> "$SHELL_RC"
    echo "$PATH_LINE" >> "$SHELL_RC"
    PATH_ADDED=true
  fi
fi

# --- done --------------------------------------------------------------------

echo ""
ok "kb installed."
echo ""
if $PATH_ADDED; then
  printf "%b!%b PATH updated in %s — run: source %s\n" "$color_green" "$color_reset" "$SHELL_RC" "$SHELL_RC"
  echo ""
elif ! command -v kb >/dev/null 2>&1; then
  printf "%b!%b Add kb to your PATH: $PATH_LINE\n" "$color_green" "$color_reset"
  echo ""
fi
echo "Next steps:"
echo "  1. Reload shell:  source ${SHELL_RC:-~/.zshrc}   (or open a new terminal)"
echo "  2. Verify:        kb --version"
echo "  3. If you don't have gh yet:  brew install gh && gh auth login"
echo ""
echo "  New vault:"
echo "    kb init                          — scaffold a fresh vault (prompts for path, product, team)"
echo "    Open the vault folder in Claude Code + Obsidian"
echo "    Type /resume in Claude Code to begin"
echo ""
echo "  Existing team vault:"
echo "    git clone <vault-repo-url>"
echo "    Open it in Claude Code + Obsidian"
echo "    Type /resume in Claude Code to begin"
echo ""

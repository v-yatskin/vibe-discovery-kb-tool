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
ask()  { printf "%b?%b %s " "$color_green" "$color_reset" "$*"; }

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

# --- clone / update kb-tool --------------------------------------------------

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

# Make kb available in this shell session without requiring a reload.
export PATH="$LOCAL_BIN:$PATH"

# --- vault setup -------------------------------------------------------------

echo ""
ok "kb installed."
echo ""

# When piped through curl|bash stdin is the pipe — read from /dev/tty instead.
TTY="${TTY:-/dev/tty}"
if [ ! -r "$TTY" ]; then TTY="/dev/stdin"; fi

ask "New vault or existing team vault? [new/existing]"
read -r vault_mode <"$TTY"
vault_mode="${vault_mode:-new}"

echo ""

if [ "$vault_mode" = "existing" ]; then
  # --- clone existing team vault ---
  ask "Team vault repo URL:"
  read -r vault_url <"$TTY"

  default_name="$(basename "$vault_url" .git)"
  default_path="$HOME/Documents/$default_name"
  ask "Clone to [$default_path]:"
  read -r vault_path <"$TTY"
  vault_path="${vault_path:-$default_path}"

  echo ""
  say "Cloning vault into $vault_path..."
  git clone "$vault_url" "$vault_path"

  cd "$vault_path"
  "$LOCAL_BIN/kb" init --upgrade <"$TTY"
else
  # --- new vault ---
  "$LOCAL_BIN/kb" init <"$TTY"
fi

# --- shell reload reminder ---------------------------------------------------

echo ""
if $PATH_ADDED; then
  printf "%b!%b Shell reloaded for this session. To persist, run: source %s\n" \
    "$color_green" "$color_reset" "${SHELL_RC:-~/.zshrc}"
fi

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

# Open /dev/tty as fd 3 NOW — before bash reads more of the pipe.
# This is the only safe way to get a real TTY handle in curl|bash.
INTERACTIVE=false
if exec 3</dev/tty 2>/dev/null; then
  INTERACTIVE=true
fi

ask() {
  # Print prompt to stderr (always goes to terminal); read answer from fd 3 (tty).
  printf "%b?%b %s " "$color_green" "$color_reset" "$*" >&2
  local ans
  read -r ans <&3
  printf '%s' "$ans"
}

# --- preflight ---------------------------------------------------------------

command -v git  >/dev/null 2>&1 || die "git is required. Install Xcode command line tools: xcode-select --install"

# Install or upgrade Node via nvm if it's missing or too old.
install_node_via_nvm() {
  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    say "Installing nvm (per-user Node version manager)..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  say "Installing Node $MIN_NODE_MAJOR via nvm..."
  nvm install "$MIN_NODE_MAJOR" >/dev/null
  nvm alias default "$MIN_NODE_MAJOR" >/dev/null 2>&1 || true
  nvm use "$MIN_NODE_MAJOR" >/dev/null
}

need_node_install=false
if ! command -v node >/dev/null 2>&1; then
  need_node_install=true
else
  NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
  if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
    say "Node $(node -v) is too old — kb needs $MIN_NODE_MAJOR+."
    need_node_install=true
  fi
fi

if $need_node_install; then
  if $INTERACTIVE; then
    ans=$(ask "Install Node $MIN_NODE_MAJOR via nvm now? [Y/n]")
    case "${ans:-y}" in
      n|N|no|No) die "Node $MIN_NODE_MAJOR+ required. Install from https://nodejs.org (LTS) and re-run." ;;
    esac
  else
    say "Installing Node $MIN_NODE_MAJOR via nvm (non-interactive)..."
  fi
  install_node_via_nvm
  ok "Node $(node -v) ready."
fi

command -v npm  >/dev/null 2>&1 || die "npm is required (usually ships with Node.js)."

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
# Prefer `npm ci` on updates: wipes node_modules and reinstalls strictly from
# package-lock.json, so a stray edit to any vendored file can't survive an update.
# Falls back to `npm install` on a fresh clone that may lack the lockfile.
if [ -f package-lock.json ]; then
  say "Installing dependencies (clean install)..."
  npm ci --silent --no-audit --no-fund
else
  say "Installing dependencies..."
  npm install --silent --no-audit --no-fund
fi

say "Building..."
npm run build --silent

# --- link globally -----------------------------------------------------------

LOCAL_BIN="$HOME/.local/bin"
say "Linking kb to $LOCAL_BIN/kb..."
mkdir -p "$LOCAL_BIN"
ln -sf "$INSTALL_DIR/dist/index.js" "$LOCAL_BIN/kb"
chmod +x "$INSTALL_DIR/dist/index.js"

PATH_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\""
SHELL_RC=""
case "${SHELL:-}" in
  */zsh)  SHELL_RC="$HOME/.zshrc" ;;
  */bash) SHELL_RC="$HOME/.bashrc" ;;
esac

PATH_ADDED=false
if [ -n "$SHELL_RC" ]; then
  if ! grep -qF '.local/bin' "$SHELL_RC" 2>/dev/null; then
    { echo ""; echo "# Added by kb installer"; echo "$PATH_LINE"; } >> "$SHELL_RC"
    PATH_ADDED=true
  fi
fi

export PATH="$LOCAL_BIN:$PATH"

# --- vault setup -------------------------------------------------------------

echo ""
ok "kb installed."
echo ""

if ! $INTERACTIVE; then
  echo "Run in a new terminal:"
  echo "  kb init              — create a new vault"
  echo "  kb init --upgrade    — join an existing team vault (cd into the clone first)"
  echo ""
  exit 0
fi

vault_mode=$(ask "New vault or existing team vault? [new/existing]")
vault_mode="${vault_mode:-new}"
echo ""

if [ "$vault_mode" = "existing" ]; then
  vault_url=$(ask "Team vault repo URL:")
  echo ""

  default_name="$(basename "$vault_url" .git)"
  default_path="$HOME/Documents/$default_name"
  vault_path=$(ask "Clone to [$default_path]:")
  vault_path="${vault_path:-$default_path}"
  echo ""

  say "Cloning vault into $vault_path..."
  git clone "$vault_url" "$vault_path"
  cd "$vault_path"

  # fd 3 is /dev/tty — redirect it to stdin so kb init reads from the terminal
  "$LOCAL_BIN/kb" init --upgrade <&3
else
  "$LOCAL_BIN/kb" init <&3
fi

# --- shell reload reminder ---------------------------------------------------

echo ""
if $PATH_ADDED; then
  printf "%b!%b PATH updated — to persist beyond this session: source %s\n" \
    "$color_green" "$color_reset" "${SHELL_RC:-~/.zshrc}"
fi

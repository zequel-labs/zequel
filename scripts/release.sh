#!/bin/bash
set -e

CURRENT_VERSION=$(node -p "require('./package.json').version")
# Strip any existing prerelease suffix to get the base version
BASE_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-.*//')

# Auto-increment: 1.0.8 -> 1.0.9, 1.0.9 -> 1.1.0, 1.9.9 -> 2.0.0
next_version() {
  local major minor patch
  IFS='.' read -r major minor patch <<< "$1"

  if [ "$patch" -lt 9 ]; then
    echo "$major.$minor.$((patch + 1))"
  elif [ "$minor" -lt 9 ]; then
    echo "$major.$((minor + 1)).0"
  else
    echo "$((major + 1)).0.0"
  fi
}

# Find next beta number for a given base version by checking existing git tags
next_beta() {
  local base="$1"
  local last_beta
  last_beta=$(git tag -l "${base}-beta.*" | sed "s/${base}-beta\.//" | sort -n | tail -1)

  if [ -z "$last_beta" ]; then
    echo "${base}-beta.1"
  else
    echo "${base}-beta.$((last_beta + 1))"
  fi
}

if [ -z "$1" ]; then
  NEXT_STABLE=$(next_version "$BASE_VERSION")

  echo "Current version: $CURRENT_VERSION"
  echo ""
  echo "Release type:"
  echo "  1) Stable  ($NEXT_STABLE)"
  echo "  2) Beta    ($(next_beta "$NEXT_STABLE"))"
  echo ""
  printf "Choose [1/2]: "
  read -r CHOICE

  case "$CHOICE" in
    1) NEW_VERSION="$NEXT_STABLE" ;;
    2) NEW_VERSION=$(next_beta "$NEXT_STABLE") ;;
    *)
      echo "Invalid choice. Aborted."
      exit 1
      ;;
  esac
else
  NEW_VERSION="$1"
fi

echo ""
echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"

if [[ "$NEW_VERSION" == *-* ]]; then
  echo "Channel:         beta (prerelease)"
else
  echo "Channel:         stable"
fi
echo ""

# Validate version format
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: invalid version format '$NEW_VERSION'"
  echo "Expected: X.Y.Z or X.Y.Z-prerelease"
  exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: you have uncommitted changes. Commit or stash them first."
  exit 1
fi

# Check we're on main
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "Warning: you're on '$BRANCH', not 'main'. Continue? (y/N)"
  read -r CONFIRM
  if [ "$CONFIRM" != "y" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# Check tag doesn't already exist
if git tag -l "$NEW_VERSION" | grep -q .; then
  echo "Error: tag '$NEW_VERSION' already exists"
  exit 1
fi

echo "Continue? (y/N)"
read -r CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Aborted."
  exit 1
fi

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit, tag, push
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"
git tag "$NEW_VERSION"
git push && git push origin "$NEW_VERSION"

echo ""
echo "Done! Version $NEW_VERSION released."
echo "Check CI: https://github.com/zequel-labs/zequel/actions"

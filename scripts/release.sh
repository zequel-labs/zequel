#!/bin/bash
set -e

CURRENT_VERSION=$(node -p "require('./package.json').version")

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

if [ -z "$1" ]; then
  NEW_VERSION=$(next_version "$CURRENT_VERSION")
else
  NEW_VERSION="$1"
fi

echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"
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

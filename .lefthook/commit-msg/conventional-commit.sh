#!/bin/sh
msg=$(cat "$1")
regex="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?: .+"

if echo "$msg" | grep -qE "$regex"; then
  exit 0
else
  echo ""
  echo "  Commit message must follow Conventional Commits:"
  echo "  <type>(<scope>): <subject>"
  echo ""
  echo "  Types: feat fix docs style refactor perf test build ci chore revert"
  echo "  Example: feat(overlay): add threshold configuration"
  echo ""
  exit 1
fi

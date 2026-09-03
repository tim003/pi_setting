#!/usr/bin/env bash
#
# Reapply the local observer-coverage-gap fix to pi-observational-memory.
#
# The package is installed as a git clone and `pi update` resets it with
# `git reset --hard @{upstream}`, which throws away local commits on main. The fix
# survives on the local branch below, because a ref is not touched by that reset,
# so recovering after an update means replaying that branch onto the new tip.
#
# On a fresh machine the clone has no such branch, so the branch is rebuilt from
# patches/om-observer-coverage-gap.patch — that file, not the clone, is the
# durable copy of the fix.
#
# Idempotent: exits 0 with "already applied" when the fix is already in HEAD.
#
# Usage: ./scripts/reapply-om-coverage-gap-fix.sh [path-to-package]

set -euo pipefail

BRANCH="fix/observer-coverage-gap"
PATCH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/patches/om-observer-coverage-gap.patch"
REPO="${1:-${OM_PACKAGE_DIR:-$HOME/.pi/agent/git/github.com/amosblomqvist/pi-observational-memory}}"

if [ ! -d "$REPO/.git" ]; then
	echo "skip: pi-observational-memory is not installed at $REPO"
	exit 0
fi

cd "$REPO"
TARGET="$(git rev-parse --abbrev-ref HEAD)"

# Checked before the clean-tree guard on purpose: reporting "already applied" must
# not depend on whether someone happens to be editing the repo right now.
if git rev-parse --verify --quiet "$BRANCH" >/dev/null && git merge-base --is-ancestor "$BRANCH" HEAD; then
	echo "already applied: $(git rev-parse --short "$BRANCH") is in $TARGET"
	exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "ERROR: $REPO has uncommitted changes." >&2
	echo "Refusing to rewrite branches over work in progress — commit or stash it first:" >&2
	git status --short >&2
	exit 1
fi

if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
	echo "replaying $BRANCH onto $TARGET ($(git rev-parse --short HEAD))"
	if ! git rebase "$TARGET" "$BRANCH"; then
		git rebase --abort || true
		git checkout "$TARGET" >/dev/null 2>&1 || true
		echo "ERROR: $BRANCH conflicts with the new upstream." >&2
		echo "Upstream probably reworked the observer watermark — check whether the fix is" >&2
		echo "still needed, then resolve by hand: git rebase $TARGET $BRANCH" >&2
		exit 1
	fi
else
	if [ ! -f "$PATCH" ]; then
		echo "ERROR: neither branch $BRANCH nor $PATCH exists; the fix is unrecoverable." >&2
		exit 1
	fi
	echo "branch $BRANCH is missing (fresh clone) — rebuilding it from $(basename "$PATCH")"
	git checkout -q -b "$BRANCH"
	if ! git am "$PATCH"; then
		git am --abort || true
		git checkout -q "$TARGET"
		git branch -q -D "$BRANCH"
		echo "ERROR: $(basename "$PATCH") does not apply to $TARGET." >&2
		echo "Upstream has moved under the fix — re-do it by hand and refresh the patch with:" >&2
		echo "  git format-patch -1 <commit> --stdout > $PATCH" >&2
		exit 1
	fi
fi

git checkout -q "$TARGET"
git merge --ff-only "$BRANCH" >/dev/null
echo "reapplied: $TARGET is now at $(git rev-parse --short HEAD)"

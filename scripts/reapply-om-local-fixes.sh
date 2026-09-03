#!/usr/bin/env bash
#
# Reapply the local fixes carried on top of pi-observational-memory.
#
# The package is installed as a git clone and `pi update` resets it with
# `git reset --hard @{upstream}`, which throws away local commits on main. Each fix
# survives on its own local branch, because a ref is not touched by that reset, so
# recovering after an update means replaying those branches onto the new tip.
#
# On a fresh machine the clone has no such branches, so each one is rebuilt from its
# patch file under patches/ — those files, not the clone, are the durable copy.
#
# Fixes are applied in the order listed: each patch was cut on top of the one before
# it, so a later patch will not apply to a tree missing an earlier one.
#
# Idempotent: reports "already applied" per fix and exits 0 when nothing is pending.
#
# Usage: ./scripts/reapply-om-local-fixes.sh [path-to-package]

set -euo pipefail

# branch:patch-filename, oldest first.
FIXES=(
	"fix/observer-coverage-gap:om-observer-coverage-gap.patch"
	"fix/observer-argv-null-bytes:om-argv-null-bytes.patch"
)

PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/patches"
REPO="${1:-${OM_PACKAGE_DIR:-$HOME/.pi/agent/git/github.com/amosblomqvist/pi-observational-memory}}"

if [ ! -d "$REPO/.git" ]; then
	echo "skip: pi-observational-memory is not installed at $REPO"
	exit 0
fi

cd "$REPO"
TARGET="$(git rev-parse --abbrev-ref HEAD)"

# Worked out before the clean-tree guard on purpose: reporting "already applied" must
# not depend on whether someone happens to be editing the repo right now.
PENDING=()
for fix in "${FIXES[@]}"; do
	branch="${fix%%:*}"
	if git rev-parse --verify --quiet "$branch" >/dev/null && git merge-base --is-ancestor "$branch" HEAD; then
		echo "already applied: $branch ($(git rev-parse --short "$branch")) is in $TARGET"
	else
		PENDING+=("$fix")
	fi
done

if [ ${#PENDING[@]} -eq 0 ]; then
	exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "ERROR: $REPO has uncommitted changes." >&2
	echo "Refusing to rewrite branches over work in progress — commit or stash it first:" >&2
	git status --short >&2
	exit 1
fi

for fix in "${PENDING[@]}"; do
	branch="${fix%%:*}"
	patch="$PATCH_DIR/${fix##*:}"

	# Re-read HEAD each round: an earlier fix in this loop has already moved it.
	TARGET="$(git rev-parse --abbrev-ref HEAD)"

	if git rev-parse --verify --quiet "$branch" >/dev/null; then
		echo "replaying $branch onto $TARGET ($(git rev-parse --short HEAD))"
		if ! git rebase "$TARGET" "$branch"; then
			git rebase --abort || true
			git checkout "$TARGET" >/dev/null 2>&1 || true
			echo "ERROR: $branch conflicts with the new upstream." >&2
			echo "Upstream probably reworked this area — check whether the fix is still" >&2
			echo "needed, then resolve by hand: git rebase $TARGET $branch" >&2
			exit 1
		fi
	else
		if [ ! -f "$patch" ]; then
			echo "ERROR: neither branch $branch nor $patch exists; the fix is unrecoverable." >&2
			exit 1
		fi
		echo "branch $branch is missing (fresh clone) — rebuilding it from $(basename "$patch")"
		git checkout -q -b "$branch"
		if ! git am "$patch"; then
			git am --abort || true
			git checkout -q "$TARGET"
			git branch -q -D "$branch"
			echo "ERROR: $(basename "$patch") does not apply to $TARGET." >&2
			echo "Upstream has moved under the fix — re-do it by hand and refresh the patch with:" >&2
			echo "  git format-patch -1 <commit> --stdout > $patch" >&2
			exit 1
		fi
	fi

	git checkout -q "$TARGET"
	git merge --ff-only "$branch" >/dev/null
	echo "reapplied: $TARGET is now at $(git rev-parse --short HEAD)"
done

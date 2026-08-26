#!/usr/bin/env bash
set -euo pipefail

# Reinstall the Pi packages used by this setup.
# Review third-party package source before installing; Pi packages run with full system access.

pi install npm:pi-claude-auth
pi install git:github.com/obra/superpowers
pi install npm:pi-subagents
pi install npm:pi-web-access

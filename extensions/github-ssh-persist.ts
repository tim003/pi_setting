/**
 * github-ssh-persist
 *
 * PROBLEM
 *   The Pi container runs with `docker run --rm`, so /root/.ssh lives in the
 *   container's throwaway overlay filesystem and is destroyed on every exit.
 *   Only these paths persist:
 *     /workspace                       (virtiofs bind mount of the vault)
 *     /root/.pi/agent                  (named volume `pi-agent-home`)
 *     /root/.ssh/pi_deploy             (single-file bind mount, read-only)
 *
 *   A GitHub SSH key written to /root/.ssh therefore vanishes on restart, and
 *   its public half becomes orphaned in GitHub's settings.
 *
 * SOLUTION
 *   The private key is stored in the persistent volume at
 *   /root/.pi/agent/ssh/. This extension runs on every session_start and
 *   recreates the ephemeral /root/.ssh/config entry that points at it.
 *
 *   ~/.gitconfig is likewise ephemeral, so the commit identity is restored
 *   here too - otherwise every fresh container fails to commit with
 *   "Please tell me who you are".
 *
 *   Extensions in ~/.pi/agent/extensions/ are auto-discovered at startup and
 *   live in the same persistent volume, so this file survives too.
 *
 * RESULT
 *   GitHub SSH access and git identity are restored automatically on every
 *   container start. No manual step, no re-registering keys.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, chmodSync, symlinkSync, lstatSync, unlinkSync } from "node:fs";

const KEY_PATH = "/root/.pi/agent/ssh/id_ed25519_pi_github";
const SSH_DIR = "/root/.ssh";
const CONFIG_PATH = `${SSH_DIR}/config`;

const BLOCK = `
Host github.com
  HostName github.com
  User git
  IdentityFile ${KEY_PATH}
  IdentitiesOnly yes
`;

// The codex CLI keeps its own auth store, separate from Pi's /login, and
// defaults to /root/.codex - which is ephemeral container overlay, so a
// device-auth login would have to be repeated after every restart. The
// credential itself lives on the persistent volume; this symlink points the
// CLI's default home at it. The Dockerfile also sets CODEX_HOME, which makes
// this redundant on images built after 2026-08-29; it stays as a backstop for
// older images and costs nothing when already correct.
const CODEX_DIR = "/root/.codex";
const CODEX_LINK = `${CODEX_DIR}/auth.json`;
const CODEX_TARGET = "/root/.pi/agent/codex/auth.json";

const GITCONFIG_PATH = "/root/.gitconfig";
const GIT_NAME = "tim003";
const GIT_EMAIL = "tim003@users.noreply.github.com";

const GITCONFIG = `[user]
	name = ${GIT_NAME}
	email = ${GIT_EMAIL}
`;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      // No persistent key means nothing to restore. Stay silent on the happy
      // path; only speak up if the key is missing but expected.
      if (!existsSync(KEY_PATH)) {
        return;
      }

      if (!existsSync(SSH_DIR)) {
        mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
      }

      const current = existsSync(CONFIG_PATH)
        ? readFileSync(CONFIG_PATH, "utf8")
        : "";

      // Idempotent: only append when the github.com block is absent.
      if (!/^Host\s+github\.com/mi.test(current)) {
        appendFileSync(CONFIG_PATH, BLOCK);
        ctx.ui.notify("Restored GitHub SSH config from persistent key", "info");
      }

      chmodSync(CONFIG_PATH, 0o600);
      chmodSync(KEY_PATH, 0o600);

      // Restore the commit identity. Only write when absent so any manual
      // edit inside a running container is preserved.
      const gitconfig = existsSync(GITCONFIG_PATH)
        ? readFileSync(GITCONFIG_PATH, "utf8")
        : "";
      if (!/^\s*email\s*=/mi.test(gitconfig)) {
        writeFileSync(GITCONFIG_PATH, GITCONFIG);
        ctx.ui.notify(`Restored git identity (${GIT_NAME})`, "info");
      }

      // Point the codex CLI's default auth path at the persistent credential.
      if (existsSync(CODEX_TARGET)) {
        if (!existsSync(CODEX_DIR)) mkdirSync(CODEX_DIR, { recursive: true });
        let needsLink = true;
        try {
          // lstat, not exists: a symlink to a missing target reports false.
          needsLink = !lstatSync(CODEX_LINK).isSymbolicLink();
          if (!needsLink && readFileSync(CODEX_LINK, "utf8").length === 0) needsLink = true;
        } catch {
          needsLink = true;
        }
        if (needsLink) {
          try {
            unlinkSync(CODEX_LINK);
          } catch {
            /* nothing to remove */
          }
          symlinkSync(CODEX_TARGET, CODEX_LINK);
          ctx.ui.notify("Linked codex CLI auth to persistent store", "info");
        }
      }
    } catch (err) {
      ctx.ui.notify(
        `github-ssh-persist failed: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    }
  });
}

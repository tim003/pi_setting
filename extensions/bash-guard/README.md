# bash-guard (pi extension)

Intercepts agent-issued `bash` tool calls and asks before destructive ones run.

There is one code path, not two. Sessions differ only in whether a UI exists to answer the prompt:
a session with one gets asked, a session without one is refused unless a trusted project covers the
command. Subagents are simply the second kind.

> An earlier build branched on `PI_SUBAGENT_DEPTH` into a separate headless mode. Nothing ever set
> that variable — it was a convention of the removed `pi-subagents` package — so the branch could
> not run, while reading like the path subagents took. It is gone. Do not reintroduce a mode keyed
> on a variable no launcher sets.

## Behaviour

### Interactive prompt

#### Prompt threshold (`PI_BASH_GUARD_LEVEL`)

By default only **high**-severity commands prompt; medium-risk ones are auto-allowed. That keeps
routine work (including most `git` commands) friction-free.

- unset / anything else — high-only (default)
- `PI_BASH_GUARD_LEVEL=strict` — also prompt on medium-severity commands

The detection list below describes what bash-guard *classifies* as risky. Which of those actually
prompt depends on the threshold above. Catastrophic commands are hard-blocked regardless, and
`/bash-guard` disables interactive prompting for the current session.

- Heuristically detects destructive/questionable commands via shell-aware parsing
- Prompts for **any** `git ...` command (escalates severity for especially risky ones: `git rm`,
  `git reset --hard`, `git clean -fdx`, `git push --force`, `git reflog expire`, `git gc --prune`)
- Prompts for disk/volume tooling: `diskutil`, `hdiutil`, `mkfs*`, `newfs_*`, `wipefs`, `parted`,
  `fdisk`, `gdisk/sgdisk`, `cryptsetup`, `pvcreate/vgcreate/lvcreate`, `zpool`, `lsblk`
- Prompts for: `rm`/`rmdir`/`unlink`, `sudo`, `find -delete`, `dd`, `truncate`, `sed -i`,
  `perl -pi`, `chmod/chown -R`, `mv/cp --force`, `kill`/`pkill`/`killall`, `shutdown`/`reboot`,
  `systemctl stop/disable`, `curl|sh`/`wget|sh`, `kubectl delete`, `terraform destroy`,
  `aws s3 rm --recursive`, `gcloud delete`, shell redirections (`>`, `>>`, `2>`), pipes
- Shows a 2-option dialog: **Run** / **Abort**
- If aborted, the tool call is blocked and the model receives a clear reason
- Remembers recently aborted commands for 60 s to prevent retry loops

### Sessions with no UI

A subagent or a `pi -p` run cannot be asked anything, so a high-risk command is refused unless a
[trusted project](../../docs/OPERATIONS.md#trusted-projects) covers every path it touches.

One operation is refused outright, before risk rating and before any project grant:

| Pattern | Reason |
|---|---|
| `git push` | Visible to everyone else immediately, and cannot be recalled |

Commits and pulls are deliberately allowed — they are local and recoverable, and recording work is
usually the point of delegating it. Commit in the child; push from the session with a person in it.
`--bash-guard-auto-allow` lifts this for a deliberately autonomous headless run.

### Catastrophic set

Used as the hard floor when bash-guard is disabled with `/bash-guard`, and never released by a
project grant:

| Pattern | Reason |
|---|---|
| `rm -r` / `-rf` / `-Rf` | Recursive deletion |
| `sudo` | Elevated privileges |
| `curl\|sh`, `wget\|sh` | Pipe to shell (remote code execution) |
| `mkfs*`, `newfs_*` | Filesystem formatting |
| `wipefs` | Disk signature wipe |
| `diskutil erase/zeroDisk/secureErase/reformat` | Destructive disk operation |
| `dd of=/dev/…` | Raw disk write |
| `parted`, `fdisk`, `gdisk`, `sgdisk` | Partition table management |
| `cryptsetup` | Disk encryption management |
| `zpool` | ZFS pool management |
| `shutdown`, `reboot`, `halt`, `poweroff` | System power operation |
| `terraform destroy` | Infrastructure teardown |
| `kubectl delete` | Kubernetes resource deletion |
| `aws s3 rm --recursive` | Bulk S3 deletion |
| `git reset --hard` | Discard all uncommitted changes |
| `git clean -f` | Delete untracked files |
| `git reflog expire` | Remove recovery history |
| `git gc --prune` | Prune unreachable objects |

All other commands (including routine git operations) pass through unaffected.

## Install

Auto-discovered from `~/.pi/agent/extensions/bash-guard/`. Run `/reload` in pi.

## Notes

- Scope: `bash` tool calls only (`write`/`edit` and user `!` commands are not intercepted).
- `--bash-guard-auto-allow`: main-session flag that allows flagged commands when there is no UI
  (e.g. running pi non-interactively). Has no effect in subagent sessions.

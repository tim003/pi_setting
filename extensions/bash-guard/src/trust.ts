/**
 * Trusted project roots: a standing grant that stops bash-guard asking about
 * operations confined to one project.
 *
 * The rule is deliberately narrow. Trust follows the *paths a command touches*,
 * not the directory it runs from, so a command launched inside a trusted project
 * that reaches outside it still prompts. Anything that cannot be resolved
 * statically counts as outside, because a guard that guesses is not a guard.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { parse as shellParse } from "shell-quote";

import { firstBlockedReason } from "./mask.ts";

export type TrustGrant = {
	path: string;
	grantedAt: string;
};

/**
 * Where grants are stored.
 *
 * Deliberately in the agent directory rather than the project: a grant kept inside
 * a repo would travel with the repo, so cloning something would import its own
 * permission to delete your files.
 */
export function defaultStorePath(): string {
	const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return join(agentDir, "bash-guard-trust.json");
}

export function loadTrustedRoots(storePath: string): string[] {
	let raw: string;
	try {
		raw = readFileSync(storePath, "utf8");
	} catch {
		return [];
	}

	try {
		const parsed = JSON.parse(raw) as { roots?: unknown };
		if (!Array.isArray(parsed.roots)) return [];
		return parsed.roots
			.map((entry) => (entry as TrustGrant | undefined)?.path)
			.filter((path): path is string => typeof path === "string" && path.length > 0);
	} catch {
		// A store we cannot read grants nothing. Failing open here would turn a
		// corrupted file into blanket permission.
		return [];
	}
}

function writeStore(storePath: string, roots: string[]): void {
	const existing = new Map<string, string>();
	try {
		const parsed = JSON.parse(readFileSync(storePath, "utf8")) as { roots?: TrustGrant[] };
		for (const grant of parsed.roots ?? []) {
			if (grant?.path) existing.set(grant.path, grant.grantedAt);
		}
	} catch {
		// No usable prior file; every root below is treated as newly granted.
	}

	const now = new Date().toISOString();
	const payload = {
		version: 1,
		roots: roots.map((path) => ({ path, grantedAt: existing.get(path) ?? now })),
	};

	mkdirSync(dirname(storePath), { recursive: true });
	const temp = `${storePath}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(payload, null, "\t")}\n`, "utf8");
	renameSync(temp, storePath);
}

export function grantTrust(storePath: string, root: string): void {
	const roots = loadTrustedRoots(storePath);
	if (roots.includes(root)) return;
	writeStore(storePath, [...roots, root]);
}

export function revokeTrust(storePath: string, root: string): void {
	writeStore(
		storePath,
		loadTrustedRoots(storePath).filter((path) => path !== root),
	);
}

/** The nearest git root at or above `cwd`, falling back to `cwd` itself. */
export function findProjectRoot(cwd: string): string {
	let current = resolve(cwd);
	for (;;) {
		if (existsSync(join(current, ".git"))) return current;
		const parent = dirname(current);
		if (parent === current) return resolve(cwd);
		current = parent;
	}
}

/**
 * Operations never released by a project grant, however trusted the project.
 *
 * Two kinds: things that reach past the project into the machine, and things that
 * destroy the history a project is recovered from.
 */
const NEVER_AUTO_APPROVE: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\b(?:sudo|doas)\b/, reason: "runs with elevated privileges" },
	{ pattern: /\b(?:mkfs|newfs|wipefs)\b/, reason: "formats a filesystem" },
	{ pattern: /\bdiskutil\s+(?:erase|partition|reformat)/, reason: "repartitions a disk" },
	{ pattern: /\b(?:parted|fdisk|gpart)\b/, reason: "edits a partition table" },
	{ pattern: /\b(?:cryptsetup|zpool)\b/, reason: "operates on volumes" },
	{ pattern: /\bdd\b[^|;&]*\bof=\/dev\//, reason: "writes to a raw device" },
	{ pattern: /\b(?:shutdown|reboot|halt|poweroff)\b/, reason: "changes machine power state" },
	{ pattern: /\|\s*(?:sudo\s+)?(?:ba|z|k)?sh\b/, reason: "pipes fetched content into a shell" },
	{ pattern: /\bgit\s+push\b[^|;&]*(?:--force\b|--force-with-lease\b|\s-f\b)/, reason: "force-pushes, overwriting remote history" },
	{ pattern: /\bgit\s+reset\b[^|;&]*--hard\b/, reason: "discards uncommitted work" },
	{ pattern: /\bgit\s+reflog\s+expire\b/, reason: "expires the reflog, the recovery path of last resort" },
	{ pattern: /\bgit\s+gc\b[^|;&]*--prune\b/, reason: "prunes unreachable objects" },
	{ pattern: /\bgit\s+filter-branch\b/, reason: "rewrites history" },
];

type Targets = {
	paths: string[];
	unresolvable: boolean;
};

/**
 * Path-like arguments of a command.
 *
 * The first word of each pipeline segment is the program, not a path, so it is
 * skipped; flags are skipped too. Everything else a shell would hand to the
 * program is treated as a path, because to the program that is what it is.
 */
/**
 * The home directory the shell would substitute for a leading tilde.
 *
 * Returns null when the tilde names someone else's home (`~root/x`), which we
 * cannot resolve here and must not guess at: guessing wrong in the permissive
 * direction releases a command that leaves the project entirely.
 *
 * A quoted tilde is not expanded by a real shell, but shell-quote yields the
 * same string for `~/.ssh` and `"~/.ssh"`, so both are read as home. The cost
 * of that conflation is one extra prompt for a file literally named `~`; the
 * cost of the opposite reading is deleting out of the home directory unasked.
 */
function expandTilde(token: string): string | null {
	if (token === "~") return homedir();
	if (token.startsWith("~/")) return join(homedir(), token.slice(2));
	if (token.startsWith("~")) return null;
	return token;
}

/**
 * Programs whose first bare word is a verb, not a file.
 *
 * `git clean -fdx` names no path at all, but reading "clean" as one made it
 * resolve inside the project and released a command whose actual effect was
 * never examined. Dropping the verb usually leaves no target, and no target
 * fails closed, so these commands are asked about rather than assumed safe.
 */
const SUBCOMMAND_PROGRAMS = new Set([
	"git",
	"npm",
	"pnpm",
	"yarn",
	"npx",
	"cargo",
	"docker",
	"kubectl",
	"brew",
	"go",
	"gh",
	"pip",
	"pip3",
	"bundle",
	"poetry",
]);

/**
 * A verb like `clean` or `rm`, as opposed to a path.
 *
 * The distinction is needed because flags take values: in `git -C /etc clean`
 * the first bare word is `/etc`, and consuming that as the subcommand would
 * both lose the one path that matters and promote `clean` into a fake one.
 * No subcommand contains a separator, so anything path-shaped is a path.
 */
function looksLikeSubcommand(token: string): boolean {
	return !token.includes("/") && !token.startsWith("~") && !token.startsWith(".");
}

function extractTargets(command: string): Targets {
	let tokens: unknown[];
	try {
		tokens = shellParse(command) as unknown[];
	} catch {
		return { paths: [], unresolvable: true };
	}

	const paths: string[] = [];
	let unresolvable = false;
	let expectProgram = true;
	let expectSubcommand = false;

	for (const token of tokens) {
		if (typeof token === "string") {
			// Anything the shell would expand later cannot be located now.
			if (token.includes("$") || token.includes("`")) {
				unresolvable = true;
				continue;
			}
			if (expectProgram) {
				expectProgram = false;
				expectSubcommand = SUBCOMMAND_PROGRAMS.has(basename(token));
				continue;
			}
			if (token.startsWith("-")) continue;
			if (expectSubcommand && looksLikeSubcommand(token)) {
				expectSubcommand = false;
				continue;
			}
			const expanded = expandTilde(token);
			if (expanded === null) {
				unresolvable = true;
				continue;
			}
			paths.push(expanded);
			continue;
		}

		const record = token as Record<string, unknown>;
		if (typeof record.comment === "string") continue;

		if (record.op === "glob" && typeof record.pattern === "string") {
			if (expectProgram) {
				expectProgram = false;
				expectSubcommand = false;
				continue;
			}
			// A glob cannot be a subcommand, so it is a target either way.
			expectSubcommand = false;
			// A glob is judged by the literal directory it is anchored in.
			const literal = record.pattern.split(/[*?[]/)[0];
			if (literal) {
				const expanded = expandTilde(literal);
				if (expanded === null) {
					unresolvable = true;
					continue;
				}
				paths.push(expanded);
			}
			continue;
		}

		if (typeof record.op === "string") {
			// A new segment begins, so the next word is a program again.
			expectProgram = true;
			expectSubcommand = false;
		}
	}

	return { paths, unresolvable };
}

/**
 * Absolute path with symlinks resolved as far as the filesystem allows.
 *
 * Resolving only the part that exists matters twice: a target being created does
 * not yet have a realpath, and a symlink that *does* exist must be followed, or a
 * link inside the project could point anywhere and launder trust through it.
 */
function resolveThroughSymlinks(cwd: string, target: string): string {
	const absolute = isAbsolute(target) ? target : resolve(cwd, target);
	const trailing: string[] = [];
	let current = absolute;

	while (!existsSync(current)) {
		const parent = dirname(current);
		if (parent === current) return absolute;
		trailing.unshift(basename(current));
		current = parent;
	}

	try {
		current = realpathSync(current);
	} catch {
		return absolute;
	}

	return trailing.length > 0 ? join(current, ...trailing) : current;
}

function isInside(root: string, target: string): boolean {
	return target.startsWith(root.endsWith(sep) ? root : root + sep);
}

/** True when a path is, or lives inside, a git directory. */
function touchesGitDirectory(target: string): boolean {
	return basename(target) === ".git" || target.split(sep).includes(".git");
}

export type TrustContext = {
	cwd: string;
	trustedRoots: string[];
};

/**
 * Whether a high-risk command is covered by a standing project grant.
 *
 * Every answer defaults to false. A command is released only when it names at
 * least one path, every path it names resolves inside one trusted root, and none
 * of them is that root or its git directory.
 */
export function isAutoApproved(command: string, context: TrustContext): boolean {
	const roots = context.trustedRoots.map((root) => resolve(root));
	if (roots.length === 0) return false;

	if (firstBlockedReason(command, NEVER_AUTO_APPROVE)) return false;

	const { paths, unresolvable } = extractTargets(command);
	if (unresolvable) return false;
	// No path means nothing to confine, so a project grant cannot speak to it.
	if (paths.length === 0) return false;

	const resolvedRoots = roots.map((root) => {
		try {
			return realpathSync(root);
		} catch {
			return root;
		}
	});

	return paths.every((path) => {
		const target = resolveThroughSymlinks(context.cwd, path);
		if (touchesGitDirectory(target)) return false;
		// Deleting the root is not an operation "within" the project.
		if (resolvedRoots.includes(target)) return false;
		return resolvedRoots.some((root) => isInside(root, target));
	});
}

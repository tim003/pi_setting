/**
 * Shell-aware masking of the parts of a command that are data rather than syntax.
 *
 * Floor patterns are regexes, and a regex cannot tell a command from an argument
 * that merely spells one. Masking quoted spans, comments and heredoc bodies leaves
 * only the structure that actually executes.
 */

// Stand-in character for masked data. A letter, so masking cannot accidentally
// create shell punctuation that some pattern then matches on.
const MASK_CHAR = "x";

/** Blank out text while preserving line structure, so line-anchored patterns stay honest. */
function maskText(text: string): string {
	return text.replace(/[^\n]/g, MASK_CHAR);
}

/** Index just past the `$( ... )` starting at `open`, or -1 if it never closes. */
function findSubstitutionEnd(input: string, open: number): number {
	let depth = 0;
	for (let i = open; i < input.length; i++) {
		if (input[i] === "(") depth++;
		else if (input[i] === ")" && --depth === 0) return i;
	}
	return -1;
}

/**
 * Mask everything the shell would treat as data rather than syntax.
 *
 * The floor patterns are regexes, and a regex cannot tell `rm -rf x` from an argument
 * that merely spells it. Quoted spans, comments and heredoc bodies are therefore
 * blanked before matching, which leaves command structure — the part that actually
 * executes — intact and matchable.
 *
 * Two deliberate asymmetries, both erring toward blocking:
 *
 * - Command substitutions inside double quotes stay live. `"$(sudo rm -rf /)"` runs,
 *   so it must still match.
 * - An unterminated quote is left unmasked. A malformed command is the last place to
 *   start assuming its contents are inert.
 */
function maskDataRegions(input: string): string {
	let out = "";
	let i = 0;

	while (i < input.length) {
		const ch = input[i];

		if (ch === "\\" && i + 1 < input.length) {
			out += ch + input[i + 1];
			i += 2;
			continue;
		}

		// A `#` only opens a comment at the start of a word.
		if (ch === "#" && (out === "" || /[\s;&|(]/.test(out[out.length - 1]))) {
			const newline = input.indexOf("\n", i);
			const stop = newline === -1 ? input.length : newline;
			out += maskText(input.slice(i, stop));
			i = stop;
			continue;
		}

		// Single quotes suppress every expansion, so the span is pure data.
		if (ch === "'") {
			const close = input.indexOf("'", i + 1);
			if (close === -1) {
				out += ch;
				i++;
				continue;
			}
			out += `'${maskText(input.slice(i + 1, close))}'`;
			i = close + 1;
			continue;
		}

		if (ch === '"') {
			const closed = hasClosingDoubleQuote(input, i + 1);
			if (!closed) {
				out += ch;
				i++;
				continue;
			}
			out += ch;
			i++;
			while (i < input.length) {
				if (input[i] === "\\" && i + 1 < input.length) {
					out += MASK_CHAR + MASK_CHAR;
					i += 2;
					continue;
				}
				if (input[i] === '"') {
					out += '"';
					i++;
					break;
				}
				if (input[i] === "$" && input[i + 1] === "(") {
					const end = findSubstitutionEnd(input, i + 1);
					if (end !== -1) {
						out += maskDataRegions(input.slice(i, end + 1));
						i = end + 1;
						continue;
					}
				}
				out += input[i] === "\n" ? "\n" : MASK_CHAR;
				i++;
			}
			continue;
		}

		out += ch;
		i++;
	}

	return out;
}

function hasClosingDoubleQuote(input: string, from: number): boolean {
	for (let i = from; i < input.length; i++) {
		if (input[i] === "\\") {
			i++;
			continue;
		}
		if (input[i] === '"') return true;
	}
	return false;
}

/**
 * Mask heredoc bodies, which are stdin payloads rather than shell syntax.
 *
 * A quoted delimiter (`<<'EOF'`) suppresses expansion, so the body is inert. An
 * unquoted one still expands, so substitutions inside it are preserved.
 */
function maskHeredocBodies(command: string): string {
	const lines = command.split("\n");
	const out: string[] = [];
	const open: Array<{ delimiter: string; expands: boolean }> = [];

	for (const line of lines) {
		if (open.length > 0) {
			// `<<-` permits an indented terminator, so compare trimmed.
			if (line.trim() === open[0].delimiter) {
				open.shift();
				out.push(line);
				continue;
			}
			out.push(open[0].expands ? maskDataRegions(`"${line}"`).slice(1, -1) : maskText(line));
			continue;
		}

		out.push(line);
		// `<<<` is a here-string, not a heredoc: no alternative below matches its third `<`.
		for (const match of line.matchAll(/<<-?\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_]\w*))/g)) {
			const quoted = match[1] ?? match[2];
			open.push({ delimiter: quoted ?? match[3], expands: quoted === undefined });
		}
	}

	return out.join("\n");
}

/**
 * First floor pattern the command trips, or undefined if it trips none.
 *
 * Matching runs against the masked command so that argument *contents* cannot
 * impersonate command *structure*.
 */
export function firstBlockedReason(
	command: string,
	patterns: ReadonlyArray<{ pattern: RegExp; reason: string }>,
): string | undefined {
	const haystack = maskDataRegions(maskHeredocBodies(command));
	for (const { pattern, reason } of patterns) {
		if (pattern.test(haystack)) return reason;
	}
	return undefined;
}

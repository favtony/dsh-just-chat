//#region src/shared/errors.ts
/** Error that can be serialized at the browser boundary without exposing input text. */
var JustChatError = class extends Error {
	name = "JustChatError";
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
	}
};
/** Convert an unknown failure into a stable host error without retaining its detail. */
function asJustChatError(error, fallbackCode = "storage-failed") {
	if (error instanceof JustChatError) return error;
	return new JustChatError(fallbackCode, "The operation could not be completed.", fallbackCode === "storage-failed" ? 500 : 400);
}
//#endregion
//#region src/shared/path.ts
const WINDOWS_RESERVED_NAMES = /* @__PURE__ */ new Set([
	"CON",
	"PRN",
	"AUX",
	"NUL",
	...Array.from({ length: 9 }, (_, index) => "COM" + String(index + 1)),
	...Array.from({ length: 9 }, (_, index) => "LPT" + String(index + 1))
]);
const WINDOWS_INVALID = /[\u0000-\u001f<>:"/\\|?*]/u;
const DRIVE_PATH = /^[A-Za-z]:[\\/]/u;
/** Validate a configured absolute root path without touching the filesystem. */
function validateRootPath(rootDirectory) {
	if (typeof rootDirectory !== "string" || rootDirectory.length === 0) throw new JustChatError("settings-invalid-root", "The conversation root directory is required.");
	if (/[\u0000-\u001f]/u.test(rootDirectory)) throw new JustChatError("settings-invalid-root", "The conversation root directory contains control characters.");
	if (!(rootDirectory.startsWith("/") || rootDirectory.startsWith("\\\\") || DRIVE_PATH.test(rootDirectory))) throw new JustChatError("settings-invalid-root", "The conversation root directory must be absolute.");
	const normalized = rootDirectory.replaceAll("\\", "/");
	const remainder = DRIVE_PATH.test(rootDirectory) ? normalized.slice(3) : normalized.replace(/^\/+/, "");
	for (const segment of remainder.split("/").filter(Boolean)) try {
		validateSegment(segment);
	} catch {
		throw new JustChatError("settings-invalid-root", "The conversation root directory contains an invalid path segment.");
	}
	return rootDirectory;
}
/** Validate a rendered path relative to the configured root. */
function validateRelativePath(relativePath) {
	if (typeof relativePath !== "string" || relativePath.length === 0) throw new JustChatError("template-empty-path", "The template produced an empty directory path.");
	if (relativePath.includes("\\")) throw new JustChatError("path-invalid", "Backslashes are not allowed in directory templates.");
	if (relativePath.startsWith("/") || relativePath.endsWith("/") || relativePath.includes("//")) throw new JustChatError("path-invalid", "The rendered path must contain non-empty relative segments.");
	const segments = relativePath.split("/");
	for (const segment of segments) validateSegment(segment);
	if ([...relativePath].length > 32767) throw new JustChatError("path-too-long", "The rendered directory path is too long.");
	return relativePath;
}
/** Validate one Windows-compatible directory name. */
function validateSegment(segment) {
	if (segment.length === 0 || segment === "." || segment === "..") throw new JustChatError("path-invalid", "Directory segments must not be empty or traversal markers.");
	if ([...segment].length > 80) throw new JustChatError("path-invalid", "A directory segment is longer than 80 characters.");
	if (WINDOWS_INVALID.test(segment) || /[\u0000-\u001f]/u.test(segment)) throw new JustChatError("path-invalid", "A directory segment contains an invalid Windows filename character.");
	if (/[ .]$/u.test(segment)) throw new JustChatError("path-invalid", "A directory segment cannot end with a space or period.");
	const reservedBase = segment.split(".")[0]?.toUpperCase();
	if (reservedBase !== void 0 && WINDOWS_RESERVED_NAMES.has(reservedBase)) throw new JustChatError("path-invalid", "A directory segment uses a reserved Windows name.");
	return segment;
}
/** Confirm that a resolved child path remains a strict descendant of its root. */
function isStrictDescendant(rootDirectory, childPath, relativePath) {
	if (relativePath.length === 0 || relativePath === "." || relativePath.startsWith("../") || relativePath.startsWith("..\\")) return false;
	const root = rootDirectory.replaceAll("\\", "/").replace(/\/+$/u, "");
	const child = childPath.replaceAll("\\", "/").replace(/\/+$/u, "");
	const rootKey = root.toLowerCase();
	const childKey = child.toLowerCase();
	if (childKey === rootKey) return false;
	if (rootKey.endsWith(":")) {
		if (!childKey.startsWith(rootKey + "/")) return false;
		return child.slice(root.length + 1) === relativePath;
	}
	if (rootKey === "") {
		if (!childKey.startsWith("/") || childKey.length <= 1) return false;
		return child.slice(1) === relativePath;
	}
	if (!childKey.startsWith(rootKey + "/")) return false;
	return child.slice(root.length + 1) === relativePath;
}
//#endregion
//#region src/shared/template.ts
const DEFAULT_TEMPLATE = "${date.yyyy}-${date.MM}-${date.dd}/${time.HH}-${time.mm}-${time.ss}-${message.firstSentence}";
const EXPRESSION = /\$\{([^{}]*)\}/gu;
const ENGLISH_WORD = /[A-Za-z]+(?:'[A-Za-z]+)?/gu;
const SPLIT_SENTENCE = /[,，.。]/u;
/** Parse one restricted template without evaluating arbitrary expressions. */
function parseTemplate(template) {
	if (typeof template !== "string" || template.length === 0) throw new JustChatError("template-invalid", "The directory template is required.");
	if (template.includes("\\")) throw new JustChatError("template-invalid", "Backslashes are not allowed in directory templates.");
	const tokens = [];
	let cursor = 0;
	let match;
	EXPRESSION.lastIndex = 0;
	while ((match = EXPRESSION.exec(template)) !== null) {
		if (match.index > cursor) tokens.push({
			kind: "literal",
			value: template.slice(cursor, match.index)
		});
		tokens.push({
			kind: "parameter",
			value: parseParameter(match[1] ?? "")
		});
		cursor = match.index + match[0].length;
	}
	if (cursor < template.length) tokens.push({
		kind: "literal",
		value: template.slice(cursor)
	});
	if (template.slice(cursor).includes("${")) throw new JustChatError("template-invalid", "The directory template contains an unfinished expression.");
	if (tokens.length === 0 || !tokens.some((token) => token.kind === "literal" && token.value.length > 0 || token.kind === "parameter" && token.value !== "message.firstSentence" && typeof token.value !== "object" || token.kind === "parameter" && typeof token.value === "object" && token.value.kind !== "message.words")) throw new JustChatError("template-invalid", "The directory template must contain static or time text for a leaf directory.");
	if (tokens.some((token) => token.kind === "literal" && token.value.includes("\\"))) throw new JustChatError("template-invalid", "Backslashes are not allowed in directory templates.");
	return tokens;
}
function parseParameter(expression) {
	if (expression === "date.yyyy" || expression === "date.MM" || expression === "date.dd" || expression === "time.HH" || expression === "time.mm" || expression === "time.ss" || expression === "message.firstSentence") return expression;
	const words = /^message\.words\(([1-9]|[12]\d|3[0-2])\)$/u.exec(expression);
	if (words !== null) return {
		kind: "message.words",
		count: Number(words[1])
	};
	throw new JustChatError("template-invalid", "The directory template contains an unsupported expression.");
}
/** Render a parsed template with the host-local time and one message. */
function renderTemplate(template, message, now = /* @__PURE__ */ new Date()) {
	const tokens = parseTemplate(template);
	if (typeof message !== "string" || message.trim().length === 0) throw new JustChatError("empty-message", "The first message must contain text.");
	const values = {
		"date.yyyy": String(now.getFullYear()).padStart(4, "0"),
		"date.MM": String(now.getMonth() + 1).padStart(2, "0"),
		"date.dd": String(now.getDate()).padStart(2, "0"),
		"time.HH": String(now.getHours()).padStart(2, "0"),
		"time.mm": String(now.getMinutes()).padStart(2, "0"),
		"time.ss": String(now.getSeconds()).padStart(2, "0")
	};
	return validateRelativePath(tokens.map((token) => {
		if (token.kind === "literal") return token.value;
		if (typeof token.value === "object") return deriveWords(message, token.value.count);
		if (token.value === "message.firstSentence") return deriveFirstSentence(message);
		return values[token.value];
	}).join(""));
}
/** Validate a template against a sample message and return its rendered path. */
function previewTemplate(template, sampleText, now = /* @__PURE__ */ new Date()) {
	return renderTemplate(template, sampleText, now);
}
function normalizeDerived(value) {
	return [...value.normalize("NFKC").replace(/[\s\p{Cc}]+/gu, "").replace(/[<>:"/\\|?*]/gu, "")].slice(0, 48).join("");
}
function deriveFirstSentence(message) {
	const first = message.split(SPLIT_SENTENCE).find((part) => part.replace(/[\s\p{Cc}]+/gu, "").length > 0);
	if (first === void 0) throw new JustChatError("template-empty-path", "The first sentence is empty.");
	return normalizeDerived(first);
}
function deriveWords(message, count) {
	ENGLISH_WORD.lastIndex = 0;
	return normalizeDerived([...message.matchAll(ENGLISH_WORD)].slice(0, count).map((match) => match[0]).join("-"));
}
//#endregion
export { isStrictDescendant as a, JustChatError as c, renderTemplate as i, asJustChatError as l, parseTemplate as n, validateRelativePath as o, previewTemplate as r, validateRootPath as s, DEFAULT_TEMPLATE as t };

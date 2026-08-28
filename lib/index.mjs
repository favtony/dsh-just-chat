import { a as isStrictDescendant, c as JustChatError, i as renderTemplate, l as asJustChatError, n as parseTemplate, o as validateRelativePath, r as previewTemplate, s as validateRootPath, t as DEFAULT_TEMPLATE } from "./template-Dxun2q1U.mjs";
import { mkdir, realpath, stat } from "node:fs/promises";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
//#region src/host/recovery.ts
/** Reconcile durable plugin records against official session metadata. */
async function recoverConversationRecords(records, persistence, liveSessions) {
	const persisted = await persistence.list();
	const headers = new Map(persisted.map((header) => [header.id, header]));
	for (const session of liveSessions?.list() ?? []) headers.set(session.header.id, session.header);
	for (const record of records.list()) {
		const header = headers.get(record.sessionId);
		if (header === void 0 || header.cwd !== record.cwd) {
			await records.delete(record.sessionId);
			continue;
		}
		if (record.status === "prepared") await records.activate(record.sessionId, record.cwd);
	}
}
/** Verify a client activation against the live or materialized official session. */
async function assertSessionMatches(sessionId, cwd, persistence, liveSessions) {
	const live = liveSessions?.get(sessionId);
	if (live !== void 0) {
		if (live.header.cwd !== cwd) throw new JustChatError("session-cwd-mismatch", "The official session cwd does not match the preparation.", 409);
		return;
	}
	const header = (await persistence.list()).find((item) => item.id === sessionId);
	if (header === void 0) throw new JustChatError("session-not-found", "The official session has not been created.", 409);
	if (header.cwd !== cwd) throw new JustChatError("session-cwd-mismatch", "The official session cwd does not match the preparation.", 409);
}
/** Read the live session provider without importing the optional session package. */
function getLiveSessions(ctx) {
	const value = ctx.get("sessions");
	if (value === void 0) return void 0;
	return value;
}
//#endregion
//#region src/host/routes.ts
const ROUTE_PREFIX = "/api/dsh-just-chat";
const BODY_LIMIT = 64 * 1024;
/** Registerable prefix route for all dsh-just-chat HTTP operations. */
function createConversationRoute(deps) {
	return {
		kind: "prefix",
		path: ROUTE_PREFIX,
		handler: async (req, res) => {
			try {
				checkOrigin(req);
				const relativePath = new URL(req.url ?? ROUTE_PREFIX, "http://dsh-just-chat.invalid").pathname.slice(18);
				if (req.method === "PUT" && relativePath === "/settings") {
					await handleSettings(req, res, deps);
					return;
				}
				if (req.method === "POST" && relativePath === "/settings/preview") {
					await handlePreview(req, res);
					return;
				}
				if (req.method === "POST" && relativePath === "/preparations") {
					await handlePreparation(req, res, deps);
					return;
				}
				if (req.method === "POST" && relativePath.startsWith("/preparations/")) {
					await handleActivation(req, res, relativePath, deps);
					return;
				}
				if (req.method === "GET" && relativePath === "/conversations") {
					sendJson(res, 200, deps.records.active());
					return;
				}
				sendJson(res, 404, {
					errorCode: "not-found",
					message: "The requested route does not exist."
				});
			} catch (error) {
				const failure = asJustChatError(error, "storage-failed");
				sendJson(res, failure.status, {
					errorCode: failure.code,
					message: failure.message
				});
			}
		}
	};
}
async function handleSettings(req, res, deps) {
	const request = await readObject(req, ["rootDirectory", "template"]);
	if (typeof request.rootDirectory !== "string" || typeof request.template !== "string") throw invalidRequest();
	await deps.settings.update({
		rootDirectory: request.rootDirectory,
		template: request.template
	});
	sendJson(res, 200, request);
}
async function handlePreview(req, res) {
	const request = await readObject(req, ["template", "sampleText"]);
	if (typeof request.template !== "string" || typeof request.sampleText !== "string") throw invalidRequest();
	try {
		sendJson(res, 200, {
			valid: true,
			path: previewTemplate(request.template, request.sampleText)
		});
	} catch (error) {
		const failure = asJustChatError(error, "template-invalid");
		sendJson(res, 200, {
			valid: false,
			errorCode: failure.code,
			message: failure.message
		});
	}
}
async function handlePreparation(req, res, deps) {
	const request = await readObject(req, ["text"]);
	if (typeof request.text !== "string") throw invalidRequest();
	sendJson(res, 201, await deps.preparation.prepare(request.text));
}
async function handleActivation(req, res, pathname, deps) {
	if (!pathname.startsWith("/preparations/") || !pathname.endsWith("/activate")) {
		sendJson(res, 404, {
			errorCode: "not-found",
			message: "The requested route does not exist."
		});
		return;
	}
	let sessionId;
	try {
		sessionId = decodeURIComponent(pathname.slice(14, -9));
	} catch {
		throw invalidRequest();
	}
	if (sessionId.length === 0 || sessionId.includes("/")) throw invalidRequest();
	const request = await readObject(req, ["cwd"]);
	if (typeof request.cwd !== "string" || request.cwd.length === 0) throw invalidRequest();
	const record = deps.records.get(sessionId);
	if (record === void 0) throw new JustChatError("record-not-found", "The preparation record no longer exists.", 404);
	if (record.cwd !== request.cwd) throw new JustChatError("record-cwd-mismatch", "The activation directory does not match the stored record.", 409);
	await assertSessionMatches(sessionId, request.cwd, deps.persistence, deps.liveSessions);
	sendJson(res, 200, await deps.records.activate(sessionId, request.cwd));
}
async function readObject(req, expectedKeys) {
	const contentType = req.headers["content-type"];
	if (typeof contentType !== "string" || contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new JustChatError("content-type-required", "Requests must use application/json.", 415);
	const raw = await readBody(req);
	let value;
	try {
		value = JSON.parse(raw);
	} catch {
		throw invalidRequest();
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidRequest();
	const keys = Object.keys(value).sort();
	const expected = [...expectedKeys].sort();
	if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw invalidRequest();
	return value;
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		let total = 0;
		const chunks = [];
		req.on("data", (chunk) => {
			const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			total += bytes.byteLength;
			if (total > BODY_LIMIT) {
				reject(new JustChatError("body-too-large", "The request body is too large.", 413));
				return;
			}
			chunks.push(bytes);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", (error) => reject(error));
	});
}
function checkOrigin(req) {
	const origin = req.headers.origin;
	const host = req.headers.host;
	if (origin === void 0 || host === void 0) return;
	try {
		if (new URL(origin).host !== host) throw new JustChatError("origin-rejected", "Cross-origin requests are not accepted.", 403);
	} catch (error) {
		if (error instanceof JustChatError) throw error;
		throw new JustChatError("origin-rejected", "Cross-origin requests are not accepted.", 403);
	}
}
function invalidRequest() {
	return new JustChatError("invalid-request", "The request JSON fields are invalid.", 400);
}
function sendJson(res, status, value) {
	const body = JSON.stringify(value);
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("content-length", Buffer.byteLength(body));
	res.end(body);
}
//#endregion
//#region src/host/preparation.ts
/** Create a prepared directory and durable classification record. */
var ConversationPreparationService = class {
	readSettings;
	records;
	now;
	makeId;
	constructor(readSettings, records, now = Date.now, makeId = randomUUID) {
		this.readSettings = readSettings;
		this.records = records;
		this.now = now;
		this.makeId = makeId;
	}
	/** Validate, create, and persist one preparation without retaining its message. */
	async prepare(text) {
		if (typeof text !== "string" || text.trim().length === 0) throw new JustChatError("empty-message", "The first message must contain text.");
		const settings = this.readSettings();
		if (settings.rootDirectory.length === 0) throw new JustChatError("settings-missing-root", "Choose a conversation root directory before sending.", 409);
		const configuredRoot = validateRootPath(settings.rootDirectory);
		const rootDirectory = await this.canonicalDirectory(configuredRoot);
		const relativeDirectory = renderTemplate(settings.template, text);
		validateRelativePath(relativeDirectory);
		const cwd = resolve(rootDirectory, ...relativeDirectory.split("/"));
		const childRelative = relative(rootDirectory, cwd).replaceAll("\\", "/");
		if (childRelative !== relativeDirectory || !isStrictDescendant(rootDirectory, cwd, childRelative)) throw new JustChatError("path-invalid", "The rendered directory is outside the configured root.");
		await this.createDirectory(cwd);
		const sessionId = this.makeId();
		const createdAt = this.now();
		const record = Object.freeze({
			sessionId,
			cwd,
			rootDirectory,
			createdAt,
			template: settings.template,
			status: "prepared"
		});
		await this.records.put(record);
		return {
			sessionId,
			cwd,
			createdAt
		};
	}
	async canonicalDirectory(rootDirectory) {
		try {
			if (!(await stat(rootDirectory)).isDirectory()) throw new Error("not a directory");
			return await realpath(rootDirectory);
		} catch {
			throw new JustChatError("settings-invalid-root", "The conversation root directory is unavailable.", 409);
		}
	}
	async createDirectory(cwd) {
		try {
			await stat(cwd);
			throw new JustChatError("path-exists", "The generated conversation directory already exists.", 409);
		} catch (error) {
			if (error instanceof JustChatError) throw error;
			if (!isMissing(error)) throw new JustChatError("directory-create-failed", "The conversation directory could not be inspected.", 500);
		}
		try {
			await mkdir(dirname(cwd), { recursive: true });
			await mkdir(cwd);
		} catch (error) {
			if (isAlreadyExists(error)) throw new JustChatError("path-exists", "The generated conversation directory already exists.", 409);
			throw new JustChatError("directory-create-failed", "The conversation directory could not be created.", 500);
		}
	}
};
function isMissing(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function isAlreadyExists(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
/** Durable domain declaration for automatic conversation classification. */
const conversationDomainSpec = defineDomain({
	name: "dsh_just_chat",
	version: 1,
	tables: { conversations: domainTable({
		parse(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("record must be an object");
			const record = value;
			if (Object.keys(record).sort().join(",") !== "createdAt,cwd,rootDirectory,sessionId,status,template") throw new Error("record fields are invalid");
			if (typeof record.sessionId !== "string" || record.sessionId.length === 0) throw new Error("sessionId is invalid");
			if (typeof record.cwd !== "string" || record.cwd.length === 0) throw new Error("cwd is invalid");
			if (typeof record.rootDirectory !== "string" || record.rootDirectory.length === 0) throw new Error("rootDirectory is invalid");
			if (typeof record.template !== "string" || record.template.length === 0) throw new Error("template is invalid");
			if (typeof record.createdAt !== "number" || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0) throw new Error("createdAt is invalid");
			if (record.status !== "prepared" && record.status !== "active") throw new Error("status is invalid");
			return Object.freeze({
				sessionId: record.sessionId,
				cwd: record.cwd,
				rootDirectory: record.rootDirectory,
				createdAt: record.createdAt,
				template: record.template,
				status: record.status
			});
		},
		safeParse(value) {
			try {
				return {
					success: true,
					data: this.parse(value)
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error : new Error(String(error))
				};
			}
		}
	}) }
});
/** A typed store over the official storage-domain table. */
var ConversationRecordStore = class {
	table;
	constructor(table) {
		this.table = table;
	}
	/** Read one record by its preallocated session id. */
	get(sessionId) {
		return this.table.get(sessionId);
	}
	/** Return a stable snapshot of every stored classification record. */
	list() {
		return [...this.table.entries()].map(([, record]) => record);
	}
	/** Persist one prepared record before exposing its id to the caller. */
	async put(record) {
		await this.table.put(record.sessionId, record);
	}
	/** Mark one prepared record active, preserving every immutable field. */
	async activate(sessionId, cwd) {
		const current = this.table.get(sessionId);
		if (current === void 0) throw new JustChatError("record-not-found", "The preparation record no longer exists.", 404);
		if (current.cwd !== cwd) throw new JustChatError("record-cwd-mismatch", "The preparation directory does not match the stored record.", 409);
		if (current.status === "active") return current;
		return await this.table.update(sessionId, (record) => ({
			...record,
			status: "active"
		}));
	}
	/** Remove an abandoned classification record while leaving its directory untouched. */
	async delete(sessionId) {
		await this.table.delete(sessionId);
	}
	/** Return active records in their initial sidebar order. */
	active(excludedSessionIds = /* @__PURE__ */ new Set()) {
		return this.list().filter((record) => record.status === "active" && !excludedSessionIds.has(record.sessionId)).sort((left, right) => right.createdAt - left.createdAt || left.sessionId.localeCompare(right.sessionId));
	}
};
/** Open the plugin domain through the injected official facility. */
async function openConversationRecords(ctx) {
	const domain = await ctx.storageDomain.open(conversationDomainSpec);
	return {
		domain,
		records: new ConversationRecordStore(domain.table("conversations"))
	};
}
//#endregion
//#region src/host/settings.ts
/** Settings namespace used by the existing DSH settings panel. */
const CONVERSATION_SETTINGS_NAMESPACE = settingsNamespace("dsh-just-chat");
/** Composition defaults; an empty root intentionally does not create anything. */
const DEFAULT_SETTINGS = {
	rootDirectory: "",
	template: DEFAULT_TEMPLATE
};
const ConversationSettingsSchema = z.object({
	rootDirectory: z.string().default(""),
	template: z.string().default(DEFAULT_TEMPLATE)
});
/** Register the plugin settings on the owning Cordis fiber. */
function registerConversationSettings(ctx) {
	return ctx.settings.register(CONVERSATION_SETTINGS_NAMESPACE, ConversationSettingsSchema, {
		base: DEFAULT_SETTINGS,
		validate: (value) => {
			if (value.rootDirectory.length > 0) validateRootPath(value.rootDirectory);
			parseTemplate(value.template);
			previewTemplate(value.template, "Example message.", new Date(2e3, 0, 2, 3, 4, 5));
		}
	});
}
//#endregion
//#region src/host/compat.ts
const EXPECTED_VERSION = "0.1.1-rc.2";
const HOST_PACKAGES = [
	"@deepseek-ai/dsh-client-runtime",
	"@deepseek-ai/dsh-client-ui-renderer",
	"@deepseek-ai/dsh-client-ui-layout",
	"@deepseek-ai/dsh-client-ui-workspace",
	"@deepseek-ai/dsh-client-ui-conversation"
];
function packageManifest(root, name) {
	const file = join(root, "node_modules", ...name.split("/"), "package.json");
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return;
	}
}
function ancestors(start) {
	if (start === void 0 || start === "") return [];
	const result = [];
	let current = resolve(start);
	while (true) {
		result.push(current);
		const parent = dirname(current);
		if (parent === current) return result;
		current = parent;
	}
}
function dshRoots() {
	const roots = [];
	for (const entry of (process.env.PATH ?? "").split(delimiter)) {
		if (entry === "") continue;
		const candidates = [join(entry, "node_modules", "@deepseek-ai", "dsh"), join(entry, "..", "lib", "node_modules", "@deepseek-ai", "dsh")];
		for (const candidate of candidates) if (existsSync(join(candidate, "package.json"))) roots.push(resolve(candidate));
	}
	return roots;
}
function hostRoots() {
	return [.../* @__PURE__ */ new Set([
		...ancestors(process.cwd()),
		...ancestors(process.env.INIT_CWD),
		...ancestors(process.env.npm_config_local_prefix),
		...dshRoots()
	])];
}
function findHostPackage(name) {
	for (const root of hostRoots()) for (const candidate of [root, join(root, "node_modules", "@deepseek-ai", "dsh")]) {
		const version = packageManifest(candidate, name)?.version;
		if (typeof version === "string") return {
			root: candidate,
			version
		};
	}
}
/** Fail before mounting any routes when the loaded DSH internals are not the tested build. */
function assertHostCompatibility() {
	const found = HOST_PACKAGES.map((name) => ({
		name,
		package: findHostPackage(name)
	}));
	if (found.filter((item) => item.package?.version !== EXPECTED_VERSION).length === 0) return;
	const details = found.map((item) => `${item.name}=${item.package?.version ?? "missing"}`).join(", ");
	throw new Error(`dsh-just-chat requires DSH internal packages at exact version ${EXPECTED_VERSION}; found ${details}`);
}
//#endregion
//#region src/index.ts
/** Cordis plugin name. */
const name = "dsh-just-chat";
/** Services required from the official Web profile. */
const inject = [
	"webServer",
	"settings",
	"storageDomain",
	"sessionPersistence",
	"sessions"
];
/** Install settings, durable records, recovery, and the HTTP route on one fiber. */
function apply(ctx) {
	assertHostCompatibility();
	ctx.inject(inject, (hostCtx) => {
		const settings = registerConversationSettings(hostCtx);
		hostCtx.effect(async () => {
			const { domain, records } = await openConversationRecords(hostCtx);
			const persistence = hostCtx.get("sessionPersistence");
			const liveSessions = getLiveSessions(hostCtx);
			await recoverConversationRecords(records, persistence, liveSessions);
			const route = createConversationRoute({
				preparation: new ConversationPreparationService(() => settings.get(), records),
				records,
				persistence,
				liveSessions,
				settings
			});
			const unregister = hostCtx.webServer.register(route);
			return async () => {
				unregister();
				await domain.close();
			};
		}, "dsh-just-chat.host");
	});
}
//#endregion
export { apply, inject, name };

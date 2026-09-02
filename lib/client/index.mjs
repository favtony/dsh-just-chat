import "../template-Dxun2q1U.mjs";
import { Component, Fragment, createElement, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
import { Button, IconBrowseOutline16, IconChevronDownOutline14, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import { createSnapshotStore } from "@deepseek-ai/dsh-client-runtime/client";
//#region src/client/api.ts
var JustChatApiError = class extends Error {
	code;
	name = "JustChatApiError";
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
function record(value, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("dsh-just-chat: invalid " + label);
	return value;
}
function stringField(value, key) {
	const field = value[key];
	if (typeof field !== "string") throw new Error("dsh-just-chat: invalid " + key);
	return field;
}
function numberField(value, key) {
	const field = value[key];
	if (typeof field !== "number" || !Number.isFinite(field)) throw new Error("dsh-just-chat: invalid " + key);
	return field;
}
/** Convert a validated wire string into the runtime's opaque session id. */
function sessionIdField(value, key) {
	return stringField(value, key);
}
async function json(path, init, parse) {
	const response = await fetch(path, {
		...init,
		headers: {
			accept: "application/json",
			...init.headers
		}
	});
	let body;
	try {
		body = await response.json();
	} catch {
		throw new Error("dsh-just-chat: host returned non-JSON " + response.status);
	}
	if (!response.ok) {
		const value = record(body, "error");
		const message = typeof value.message === "string" ? value.message : "HTTP " + response.status;
		throw new JustChatApiError(typeof value.errorCode === "string" ? value.errorCode : "http-error", message);
	}
	return parse(body);
}
function preparation(value) {
	const body = record(value, "preparation");
	return {
		sessionId: sessionIdField(body, "sessionId"),
		cwd: stringField(body, "cwd"),
		createdAt: numberField(body, "createdAt")
	};
}
function conversation(value) {
	const body = record(value, "conversation");
	const status = body.status;
	if (status !== "prepared" && status !== "active") throw new Error("dsh-just-chat: invalid conversation status");
	return {
		sessionId: sessionIdField(body, "sessionId"),
		cwd: stringField(body, "cwd"),
		rootDirectory: stringField(body, "rootDirectory"),
		createdAt: numberField(body, "createdAt"),
		template: stringField(body, "template"),
		status
	};
}
/** Default route client. */
function createJustChatApi(base = "/api/dsh-just-chat") {
	return {
		saveSettings: (rootDirectory, template, signal) => json(base + "/settings", {
			method: "PUT",
			signal,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				rootDirectory,
				template
			})
		}, (value) => {
			const body = record(value, "settings");
			stringField(body, "rootDirectory");
			stringField(body, "template");
		}),
		preview: (template, sampleText, signal) => json(base + "/settings/preview", {
			method: "POST",
			signal,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				template,
				sampleText
			})
		}, (value) => {
			const body = record(value, "preview");
			const valid = body.valid;
			if (typeof valid !== "boolean") throw new Error("dsh-just-chat: invalid preview.valid");
			return {
				valid,
				path: typeof body.path === "string" ? body.path : void 0,
				message: typeof body.message === "string" ? body.message : void 0
			};
		}),
		prepare: (text, signal) => json(base + "/preparations", {
			method: "POST",
			signal,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text })
		}, preparation),
		activate: (sessionId, cwd, signal) => json(base + "/preparations/" + encodeURIComponent(sessionId) + "/activate", {
			method: "POST",
			signal,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ cwd })
		}, conversation),
		listConversations: (signal) => json(base + "/conversations", {
			method: "GET",
			signal
		}, (value) => {
			if (!Array.isArray(value)) throw new Error("dsh-just-chat: invalid conversations");
			return value.map((item) => conversation(item));
		})
	};
}
//#endregion
//#region src/client/ConversationHandoff.tsx
/**
* Runs only in a real session-maybe scope. The component never talks to RPC;
* the official InputActions path owns durable submission and logging.
*/
function ConversationHandoff(props) {
	useEffect(() => {
		if (!props.ready || props.sessionId === void 0 || props.inputActions === void 0) return;
		const text = props.controller.takeHandoff(props.sessionId);
		if (text === void 0) return;
		try {
			props.inputActions.setDraft(text);
			props.inputActions.submit();
			props.controller.completeHandoff(props.sessionId);
		} catch (error) {
			props.controller.failHandoff(props.sessionId, error);
			return;
		}
		props.onComplete();
	}, [
		props.controller,
		props.inputActions,
		props.onComplete,
		props.ready,
		props.sessionId
	]);
	return null;
}
//#endregion
//#region src/client/ComposerBarAdapter.tsx
const ACTIVE_PHASES = /* @__PURE__ */ new Set([
	"preparing",
	"creatingSession",
	"activating",
	"waitingPreset",
	"handingOff"
]);
function pendingInput(draft, busy, draftRev) {
	return {
		draft,
		imageIds: [],
		draftRev,
		phase: busy ? "submitting" : "plain",
		occurrences: [],
		queue: []
	};
}
/** Official InputBar with only the pending just-chat text adapter. */
function createComposerBarAdapter(deps) {
	return (official) => function ComposerBarAdapter(props) {
		const pending = useSyncExternalStore((listener) => deps.pending.subscribe(listener), () => deps.pending.getSnapshot(), () => deps.pending.getSnapshot());
		const view = useSyncExternalStore((listener) => deps.view.subscribe(listener), () => deps.view.getSnapshot(), () => deps.view.getSnapshot());
		const sessionBlank = props.useSession((state) => state.blank) ?? false;
		const ownedSession = props.sessionId !== void 0 && deps.controller.ownsSession(props.sessionId);
		const justChat = pending.mode === "just-chat" && !ownedSession && (props.sessionId === void 0 || sessionBlank);
		const busy = ACTIVE_PHASES.has(view.submission);
		const revision = useRef({
			draft: pending.draft,
			value: 0
		});
		if (revision.current.draft !== pending.draft) revision.current = {
			draft: pending.draft,
			value: revision.current.value + 1
		};
		const state = useMemo(() => pendingInput(pending.draft, busy, revision.current.value), [
			busy,
			pending.draft,
			revision.current.value
		]);
		const useInput = (selector) => {
			props.useInput((current) => current);
			return selector(state);
		};
		const start = useCallback(() => {
			if (!justChat || state.draft.trim() === "" || busy) return;
			deps.startPreparation(state.draft);
		}, [
			busy,
			deps.startPreparation,
			justChat,
			state.draft
		]);
		const inputActions = useMemo(() => ({
			setDraft: (draft) => deps.updatePendingDraft(draft),
			addImages: () => false,
			removeImage: () => {},
			pruneImages: () => {},
			submit: start
		}), [deps.updatePendingDraft, start]);
		const keyboard = useMemo(() => ({
			get snapshot() {
				return state;
			},
			setDraft: (draft) => deps.updatePendingDraft(draft),
			submit: start,
			steerQueue: () => {},
			undo: () => {},
			redo: () => {},
			pasteBegin: (text, selection) => {
				deps.updatePendingDraft(state.draft.slice(0, selection.start) + text + state.draft.slice(selection.end));
			},
			invalidatePaste: () => {},
			track: () => {},
			arbitrate: () => "pass",
			space: () => false,
			dismissPopup: () => {}
		}), [
			deps.updatePendingDraft,
			start,
			state
		]);
		useEffect(() => {
			if (props.sessionId === void 0 || props.inputActions === void 0 || pending.mode !== "workspace") return;
			props.inputActions.setDraft(pending.draft);
			deps.completePendingHandoff();
		}, [
			deps.completePendingHandoff,
			pending.draft,
			pending.mode,
			props.inputActions,
			props.sessionId
		]);
		return createElement(Fragment, null, createElement(official, justChat ? {
			...props,
			disabled: false,
			useInput,
			inputActions,
			keyboard
		} : props), props.sessionId === void 0 || props.inputActions === void 0 ? null : createElement(ConversationHandoff, {
			sessionId: props.sessionId,
			inputActions: props.inputActions,
			controller: deps.controller,
			ready: view.submission === "handingOff",
			onComplete: () => {}
		}));
	};
}
//#endregion
//#region src/client/workspace-projection.ts
const JUST_CHAT_OPTION_ID = "__dsh_just_chat_option__";
function automaticSessionIds(view, sessions) {
	const ids = view.active.filter((record) => record.status === "active").map((record) => record.sessionId).filter((id, index, all) => all.indexOf(id) === index).filter((id) => {
		const session = sessions?.byId[id];
		return session === void 0 || session.parentId === void 0 && session.origin !== "subagent";
	});
	const createdAt = new Map(view.active.map((record) => [record.sessionId, record.createdAt]));
	ids.sort((left, right) => (createdAt.get(right) ?? 0) - (createdAt.get(left) ?? 0) || left.localeCompare(right));
	return ids;
}
/** Remove plugin-owned sessions from the official workspace grouping view. */
function projectWorkspaceState(state, view, sessions) {
	const ids = automaticSessionIds(view, sessions);
	const automatic = new Set(ids);
	return {
		...state,
		items: state.items.map((workspace) => ({
			...workspace,
			sessionIds: workspace.sessionIds.filter((id) => !automatic.has(id))
		}))
	};
}
/** Project only plugin-owned top-level sessions for the official flat browser. */
function projectAutomaticSessionState(state, automaticIds) {
	const topLevel = new Set(automaticIds);
	const ids = automaticIds.filter((id) => state.byId[id] !== void 0);
	const byId = Object.fromEntries(Object.entries(state.byId).filter(([id, session]) => {
		return topLevel.has(id) || session.parentId !== void 0 && topLevel.has(session.parentId);
	}));
	const subagentsByParent = Object.fromEntries(Object.entries(state.subagentsByParent).filter(([id]) => topLevel.has(id)));
	const jobsBySession = Object.fromEntries(Object.entries(state.jobsBySession).filter(([id]) => byId[id] !== void 0));
	const current = state.current !== void 0 && topLevel.has(state.current) ? state.current : void 0;
	return {
		...state,
		ids,
		byId,
		current,
		subagentsByParent,
		jobsBySession,
		currentAddress: current === void 0 ? void 0 : state.currentAddress
	};
}
/** Project the host list for the official workspace browser, hiding plugin-owned sessions. */
function projectOrdinarySessionState(state, automaticIds) {
	const automatic = new Set(automaticIds);
	const current = state.current !== void 0 && automatic.has(state.current) ? void 0 : state.current;
	const byId = Object.fromEntries(Object.entries(state.byId).filter(([id]) => !automatic.has(id)));
	const jobsBySession = Object.fromEntries(Object.entries(state.jobsBySession).filter(([id]) => byId[id] !== void 0));
	return {
		...state,
		ids: state.ids.filter((id) => !automatic.has(id)),
		byId,
		current,
		jobsBySession,
		currentAddress: current === void 0 ? void 0 : state.currentAddress
	};
}
/** Project only the picker option; automatic conversations never appear as workspaces here. */
function projectPickerState(state) {
	const option = {
		workspaceId: JUST_CHAT_OPTION_ID,
		path: "",
		title: "不在项目中工作",
		sessionIds: [],
		createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
		updatedAt: (/* @__PURE__ */ new Date(0)).toISOString()
	};
	return {
		...state,
		items: [...state.items, option]
	};
}
/** Project the root conversation's current session into the persisted just-chat mode. */
function projectConversationState(state, pending, sessionId) {
	const projected = projectPickerState(state);
	if (pending.mode !== "just-chat" || sessionId === void 0) return projected;
	return {
		...projected,
		items: projected.items.map((workspace) => ({
			...workspace,
			sessionIds: workspace.workspaceId === "__dsh_just_chat_option__" ? [sessionId] : workspace.sessionIds.filter((id) => id !== sessionId)
		}))
	};
}
//#endregion
//#region src/client/ConversationAdapter.tsx
/** Official ConversationRoot with the same just-chat projection used by its picker. */
function createConversationAdapter(deps) {
	return (official) => function ConversationAdapter(props) {
		const pending = useSyncExternalStore((listener) => deps.pending.subscribe(listener), () => deps.pending.getSnapshot(), () => deps.pending.getSnapshot());
		const hostState = props.useWorkspaces((state) => state);
		const sessionId = props.useSessions((state) => state.current);
		const projected = useMemo(() => projectConversationState(hostState, pending, sessionId), [
			hostState,
			pending,
			sessionId
		]);
		const useWorkspaces = (selector) => {
			props.useWorkspaces((state) => state);
			return selector(projected);
		};
		const selectWorkspace = useCallback(async (workspaceId) => {
			if (workspaceId === "__dsh_just_chat_option__") return;
			await props.selectWorkspace(workspaceId);
		}, [props.selectWorkspace]);
		return official({
			...props,
			useWorkspaces,
			selectWorkspace
		});
	};
}
//#endregion
//#region src/client/sidebar-layout-guard.tsx
const SIDEBAR_SECTION_STYLE = {
	display: "block",
	flex: "none",
	minHeight: 0
};
const SIDEBAR_CSS_ID = "dsh-just-chat/sidebar-layout";
const SIDEBAR_CSS = [
	"[data-dsh-just-chat-sidebar=\"true\"] > [data-dsh-just-chat-section] {",
	"  display: block !important;",
	"  flex: none !important;",
	"  min-height: max-content !important;",
	"}",
	"[data-dsh-just-chat-sidebar=\"true\"] > [data-dsh-just-chat-section] > div,",
	"[data-dsh-just-chat-sidebar=\"true\"] > [data-dsh-just-chat-section] > div > div:has([role=\"tree\"]),",
	"[data-dsh-just-chat-sidebar=\"true\"] > [data-dsh-just-chat-section] > div > div > div:has([role=\"tree\"]),",
	"[data-dsh-just-chat-sidebar=\"true\"] div:has(> [role=\"tree\"]),",
	"[data-dsh-just-chat-sidebar=\"true\"] [role=\"tree\"] {",
	"  flex: none !important;",
	"  height: auto !important;",
	"  min-height: max-content !important;",
	"}",
	"[data-dsh-just-chat-sidebar=\"true\"] div:has(> [role=\"tree\"]),",
	"[data-dsh-just-chat-sidebar=\"true\"] [role=\"tree\"] {",
	"  flex: none !important;",
	"  height: auto !important;",
	"  min-height: max-content !important;",
	"  overflow-y: visible !important;",
	"}"
].join("\n");
function hasArea(element) {
	if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) return false;
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}
/** Return false when the expanded workspace browser has collapsed geometry. */
function isExpandedSidebarLayoutUsable(root) {
	if (!hasArea(root)) return false;
	const workspaceSection = root.querySelector("[data-dsh-just-chat-section=\"workspaces\"]");
	if (!hasArea(workspaceSection)) return false;
	const browser = workspaceSection.firstElementChild;
	if (!hasArea(browser)) return false;
	return hasArea(workspaceSection.querySelector("[role=\"tree\"]"));
}
function requestFrame(callback) {
	if (typeof window === "undefined") return 0;
	return typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(callback) : window.setTimeout(() => callback(Date.now()), 0);
}
function cancelFrame(handle) {
	if (typeof window === "undefined" || handle === 0) return;
	if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(handle);
	else window.clearTimeout(handle);
}
/** Inject scoped layout CSS and disable the plugin after repeated bad geometry. */
function SidebarLayoutGuard({ wide, rootRef, onInvalid, children }) {
	useEffect(() => {
		if (typeof document === "undefined") return;
		if (document.querySelector(`style[data-dsh-just-chat-css="${SIDEBAR_CSS_ID}"]`) !== null) return;
		const style = document.createElement("style");
		style.dataset.dshJustChatCss = SIDEBAR_CSS_ID;
		style.textContent = SIDEBAR_CSS;
		document.head.appendChild(style);
		return () => {
			if (style.parentNode !== null) style.parentNode.removeChild(style);
		};
	}, []);
	useEffect(() => {
		if (!wide || typeof window === "undefined") return;
		let disposed = false;
		let failures = 0;
		let firstFrame = 0;
		let secondFrame = 0;
		let scheduledFrame = 0;
		const check = () => {
			if (disposed) return;
			const root = rootRef.current;
			if (root !== null && isExpandedSidebarLayoutUsable(root)) {
				failures = 0;
				return;
			}
			failures += 1;
			if (failures >= 3) {
				onInvalid();
				return;
			}
			scheduledFrame = requestFrame(() => {
				scheduledFrame = 0;
				check();
			});
		};
		const scheduleCheck = () => {
			if (disposed || scheduledFrame !== 0) return;
			scheduledFrame = requestFrame(() => {
				scheduledFrame = 0;
				check();
			});
		};
		firstFrame = requestFrame(() => {
			secondFrame = requestFrame(() => check());
		});
		const ResizeObserverConstructor = window.ResizeObserver;
		const observer = typeof ResizeObserverConstructor === "function" ? new ResizeObserverConstructor(() => {
			scheduleCheck();
		}) : null;
		const mutationObserver = typeof MutationObserver === "function" ? new MutationObserver(() => {
			if (observer !== null) {
				const root = rootRef.current;
				if (root !== null) {
					observer.observe(root);
					const workspaceSection = root.querySelector("[data-dsh-just-chat-section=\"workspaces\"]");
					if (workspaceSection !== null) observer.observe(workspaceSection);
					const tree = workspaceSection?.querySelector("[role=\"tree\"]");
					if (tree !== null && tree !== void 0) observer.observe(tree);
				}
			}
			scheduleCheck();
		}) : null;
		const root = rootRef.current;
		if (root !== null) {
			mutationObserver?.observe(root, {
				childList: true,
				subtree: true
			});
			if (observer !== null) {
				observer.observe(root);
				const workspaceSection = root.querySelector("[data-dsh-just-chat-section=\"workspaces\"]");
				if (workspaceSection !== null) observer.observe(workspaceSection);
				const tree = workspaceSection?.querySelector("[role=\"tree\"]");
				if (tree !== null && tree !== void 0) observer.observe(tree);
			}
		}
		return () => {
			disposed = true;
			cancelFrame(firstFrame);
			cancelFrame(secondFrame);
			cancelFrame(scheduledFrame);
			observer?.disconnect();
			mutationObserver?.disconnect();
		};
	}, [
		onInvalid,
		rootRef,
		wide
	]);
	return /* @__PURE__ */ jsx(Fragment$1, { children });
}
/** Keep a failed plugin render from blanking the host sidebar slot. */
var SidebarErrorBoundary = class extends Component {
	state = { hasError: false };
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidCatch(error, info) {
		console.warn("dsh-just-chat sidebar disabled after render failure", error, info.componentStack);
		this.props.onError();
	}
	render() {
		return this.state.hasError ? this.props.fallback : this.props.children;
	}
};
//#endregion
//#region src/client/SidebarBrowserAdapter.tsx
const FLAT_SESSION_ORDER_KEY = "__flat_session_order__";
/**
* Reuses the host WorkspaceBrowser twice: real workspaces remain in the
* workspace tree, while plugin-owned conversations use the official flat list
* as a separate top-level section.
*/
function CombinedSidebarContent({ deps, official, props, rootRef }) {
	const view = useSyncExternalStore((listener) => deps.view.subscribe(listener), () => deps.view.getSnapshot(), () => deps.view.getSnapshot());
	const conversationOrder = useSyncExternalStore((listener) => deps.order.subscribe(listener), () => deps.order.getSnapshot(), () => deps.order.getSnapshot());
	const hostSessions = props.useSessions((state) => state);
	const hostWorkspaces = props.useWorkspaces((state) => state);
	const hostStore = props.useStore((state) => state);
	const hostDescription = props.useHostDescription((description) => description);
	const automaticIds = useMemo(() => automaticSessionIds(view, hostSessions), [hostSessions, view]);
	const automaticIdSet = useMemo(() => new Set(automaticIds), [automaticIds]);
	const projectedWorkspaces = useMemo(() => projectWorkspaceState(hostWorkspaces, view, hostSessions), [
		hostSessions,
		hostWorkspaces,
		view
	]);
	const ordinarySessions = useMemo(() => projectOrdinarySessionState(hostSessions, automaticIds), [automaticIds, hostSessions]);
	const automaticSessions = useMemo(() => projectAutomaticSessionState(hostSessions, automaticIds), [automaticIds, hostSessions]);
	const conversationWorkspaces = useMemo(() => ({
		...hostWorkspaces,
		items: []
	}), [hostWorkspaces]);
	const orderedConversationIds = useMemo(() => {
		const current = new Set(automaticIds);
		const retained = conversationOrder.sessionIds.filter((id) => current.has(id));
		return [...automaticIds.filter((id) => !retained.includes(id)), ...retained];
	}, [automaticIds, conversationOrder.sessionIds]);
	const conversationUpdatedAt = useMemo(() => Object.fromEntries(automaticIds.map((id) => [id, hostSessions.byId[id]?.updatedAt ?? 0])), [automaticIds, hostSessions.byId]);
	const workspaceStore = useMemo(() => ({
		...hostStore,
		groupBy: "workspace"
	}), [hostStore]);
	const conversationStore = useMemo(() => ({
		...hostStore,
		groupBy: "flat",
		orderBy: "manual",
		sessionOrderByAccount: {
			...hostStore.sessionOrderByAccount,
			[FLAT_SESSION_ORDER_KEY]: orderedConversationIds
		},
		sessionUpdatedAtByAccount: {
			...hostStore.sessionUpdatedAtByAccount,
			[FLAT_SESSION_ORDER_KEY]: conversationUpdatedAt
		}
	}), [
		conversationUpdatedAt,
		hostStore,
		orderedConversationIds
	]);
	const useWorkspaceSessions = useCallback((selector) => {
		props.useSessions((current) => current);
		return selector(ordinarySessions);
	}, [ordinarySessions, props.useSessions]);
	const useConversationSessions = useCallback((selector) => {
		props.useSessions((current) => current);
		return selector(automaticSessions);
	}, [automaticSessions, props.useSessions]);
	const useWorkspaceWorkspaces = useCallback((selector) => {
		props.useWorkspaces((current) => current);
		return selector(projectedWorkspaces);
	}, [projectedWorkspaces, props.useWorkspaces]);
	const useConversationWorkspaces = useCallback((selector) => {
		props.useWorkspaces((current) => current);
		return selector(conversationWorkspaces);
	}, [conversationWorkspaces, props.useWorkspaces]);
	const useWorkspaceStore = useCallback((selector) => {
		props.useStore((current) => current);
		return selector(workspaceStore);
	}, [props.useStore, workspaceStore]);
	const useConversationStore = useCallback((selector) => {
		props.useStore((current) => current);
		return selector(conversationStore);
	}, [conversationStore, props.useStore]);
	const useWorkspaceDirectoryFlow = useCallback((selector) => {
		return selector(props.useDirectoryFlow((current) => current));
	}, [props.useDirectoryFlow]);
	const useConversationDirectoryFlow = useCallback((selector) => {
		props.useDirectoryFlow((current) => current);
		return selector(false);
	}, [props.useDirectoryFlow]);
	const useWorkspaceHostDescription = useCallback((selector) => {
		return selector(props.useHostDescription((current) => current));
	}, [props.useHostDescription]);
	const useConversationHostDescription = useCallback((selector) => {
		props.useHostDescription((current) => current);
		return selector(hostDescription);
	}, [hostDescription, props.useHostDescription]);
	const workspaceSearchSessions = useCallback(async (query, signal) => {
		const result = await props.searchSessions(query, signal);
		return {
			...result,
			items: result.items.filter((item) => !automaticIdSet.has(item.sessionId))
		};
	}, [automaticIdSet, props.searchSessions]);
	const conversationSearchSessions = useCallback(async (query, signal) => {
		const result = await props.searchSessions(query, signal);
		return {
			...result,
			items: result.items.filter((item) => automaticIdSet.has(item.sessionId))
		};
	}, [automaticIdSet, props.searchSessions]);
	useEffect(() => {
		deps.refreshConversationRecords();
	}, [deps.refreshConversationRecords]);
	const workspaceActions = useMemo(() => ({
		...props.actions,
		setGroupBy: () => {},
		setSessionOrder: (accountKey, order) => {
			if (accountKey !== FLAT_SESSION_ORDER_KEY) props.actions.setSessionOrder(accountKey, order);
		},
		syncSessionOrderAccount: (accountKey, order, updatedAt) => {
			if (accountKey !== FLAT_SESSION_ORDER_KEY) props.actions.syncSessionOrderAccount(accountKey, order, updatedAt);
		}
	}), [props.actions]);
	const conversationActions = useMemo(() => ({
		...props.actions,
		setGroupBy: () => {},
		setOrderBy: () => {},
		setGroupExpanded: () => {},
		retainAccountKeys: () => {},
		syncSessionOrderAccount: (accountKey, order) => {
			if (accountKey === FLAT_SESSION_ORDER_KEY) deps.order.set({ sessionIds: [...order] });
		},
		setSessionOrder: (accountKey, order) => {
			if (accountKey === FLAT_SESSION_ORDER_KEY) deps.order.set({ sessionIds: [...order] });
		}
	}), [deps.order, props.actions]);
	const rejectConversationWorkspaceAction = useCallback(() => {
		return Promise.reject(/* @__PURE__ */ new Error("对话分区不支持工作区操作"));
	}, []);
	const rejectConversationSessionOrder = useCallback(() => {
		return Promise.reject(/* @__PURE__ */ new Error("对话分区不支持工作区会话排序"));
	}, []);
	const conversationT = useCallback((key, params) => {
		if (key === "section.sessions") return "对话";
		if (key === "empty.none") return "暂无对话";
		return props.t(key, params);
	}, [props.t]);
	const workspaceProps = {
		...props,
		useSessions: useWorkspaceSessions,
		useWorkspaces: useWorkspaceWorkspaces,
		useStore: useWorkspaceStore,
		actions: workspaceActions,
		useDirectoryFlow: useWorkspaceDirectoryFlow,
		useHostDescription: useWorkspaceHostDescription,
		searchSessions: workspaceSearchSessions
	};
	const conversationProps = {
		...props,
		useSessions: useConversationSessions,
		useWorkspaces: useConversationWorkspaces,
		useStore: useConversationStore,
		actions: conversationActions,
		useDirectoryFlow: useConversationDirectoryFlow,
		useHostDescription: useConversationHostDescription,
		searchSessions: conversationSearchSessions,
		startSession: () => {},
		renameWorkspace: rejectConversationWorkspaceAction,
		deleteWorkspace: rejectConversationWorkspaceAction,
		insertWorkspaceBefore: rejectConversationWorkspaceAction,
		insertSessionBefore: rejectConversationSessionOrder,
		t: conversationT
	};
	return createElement("div", {
		ref: rootRef,
		"data-dsh-just-chat-sidebar": "true",
		style: {
			display: "flex",
			flex: 1,
			flexDirection: "column",
			minHeight: 0,
			overflowY: "auto"
		}
	}, createElement("div", {
		"data-dsh-just-chat-section": "workspaces",
		style: SIDEBAR_SECTION_STYLE
	}, createElement(official, workspaceProps)), props.wide ? createElement("div", {
		"data-dsh-just-chat-section": "conversations",
		style: SIDEBAR_SECTION_STYLE
	}, createElement(official, conversationProps)) : null);
}
/**
* Keep plugin-specific hooks in a child so the parent can switch to the
* untouched official component without changing its hook order.
*/
function createSidebarBrowserAdapter(deps) {
	return (official) => function SidebarBrowserAdapter(props) {
		const [disabled, setDisabled] = useState(false);
		const rootRef = useRef(null);
		const disablePlugin = useCallback(() => {
			setDisabled(true);
		}, []);
		const officialComponent = official;
		const fallback = createElement(officialComponent, props);
		if (disabled) return fallback;
		const pluginLayout = createElement(CombinedSidebarContent, {
			deps,
			official: officialComponent,
			props,
			rootRef
		});
		return createElement(SidebarErrorBoundary, {
			fallback,
			onError: disablePlugin
		}, createElement(SidebarLayoutGuard, {
			wide: props.wide,
			rootRef,
			onInvalid: disablePlugin
		}, pluginLayout));
	};
}
//#endregion
//#region src/client/WorkspacePickerAdapter.tsx
/** Official WorkspacePicker with one projected just-chat row. */
function createWorkspacePickerAdapter(deps) {
	return (official) => function WorkspacePickerAdapter(props) {
		const hostState = props.useWorkspaces((state) => state);
		const pending = useSyncExternalStore((listener) => deps.pending.subscribe(listener), () => deps.pending.getSnapshot(), () => deps.pending.getSnapshot());
		const projected = useMemo(() => projectPickerState(hostState), [hostState]);
		const useWorkspaces = (selector) => {
			props.useWorkspaces((state) => state);
			return selector(projected);
		};
		const onPick = (workspaceId) => {
			if (workspaceId === "__dsh_just_chat_option__") {
				deps.chooseJustChat();
				props.onPick(workspaceId);
				props.onClose();
				return;
			}
			deps.chooseWorkspace();
			props.onPick(workspaceId);
		};
		return official({
			...props,
			useWorkspaces,
			selectedId: pending.mode === "just-chat" ? JUST_CHAT_OPTION_ID : props.selectedId,
			onPick
		});
	};
}
//#endregion
//#region src/client/live-entry.ts
function requireEntry(registry, name, contract) {
	const entries = registry.entries(name);
	if (entries.length !== 1) throw new Error(`dsh-just-chat requires exactly one official live entry for "${name}", found ${entries.length}`);
	const entry = entries[0];
	if (typeof entry.component !== "function") throw new Error(`dsh-just-chat official live entry "${name}" has no callable component`);
	if (entry.inject === void 0 || typeof entry.inject !== "function") throw new Error(`dsh-just-chat official live entry "${name}" has no inject factory`);
	if (entry.locale !== contract.locale) throw new Error(`dsh-just-chat official live entry "${name}" has locale "${entry.locale ?? ""}", expected "${contract.locale}"`);
	for (const child of contract.children) {
		const actual = entry.children?.[child.name];
		if (actual?.kind !== child.kind || actual.scope !== child.scope) throw new Error(`dsh-just-chat official live entry "${name}" has incompatible child "${child.name}"`);
	}
	return entry;
}
/** Replace only the component pointer of the host's current live entry. */
function installLiveEntry(registry, name, contract, createAdapter) {
	const entry = requireEntry(registry, name, contract);
	const official = entry.component;
	const adapter = createAdapter(official);
	if (typeof adapter !== "function") throw new Error(`dsh-just-chat adapter for "${name}" is not callable`);
	entry.component = adapter;
	return () => {
		if (entry.component !== adapter) throw new Error(`dsh-just-chat official live entry "${name}" changed while adapted`);
		entry.component = official;
	};
}
const OFFICIAL_ENTRY_CONTRACTS = {
	conversation: {
		locale: "conversation",
		children: [
			{
				name: "conversation.session",
				kind: "single",
				scope: "session"
			},
			{
				name: "conversation.session.header",
				kind: "single",
				scope: "session"
			},
			{
				name: "conversation.composer",
				kind: "chain",
				scope: "session"
			},
			{
				name: "conversation.composer.bar",
				kind: "single",
				scope: "session-maybe"
			},
			{
				name: "conversation.input.overlay",
				kind: "list",
				scope: "session"
			},
			{
				name: "conversation.input.dock",
				kind: "list",
				scope: "session"
			},
			{
				name: "conversation.composer.dock",
				kind: "list",
				scope: "session"
			},
			{
				name: "conversation.input.left",
				kind: "list",
				scope: "session"
			},
			{
				name: "conversation.input.right",
				kind: "list",
				scope: "session"
			},
			{
				name: "conversation.hero.brand.mark",
				kind: "single",
				scope: "root"
			},
			{
				name: "conversation.hero.workspace",
				kind: "single",
				scope: "root"
			},
			{
				name: "conversation.hero.agentPreset",
				kind: "single",
				scope: "root"
			}
		]
	},
	picker: {
		locale: "workspace",
		children: [{
			name: "conversation.hero.workspace.directoryFlow",
			kind: "single",
			scope: "root"
		}]
	},
	composer: {
		locale: "conversation",
		children: [
			{
				name: "conversation.input.attachments",
				kind: "single",
				scope: "session-maybe"
			},
			{
				name: "conversation.input.plan",
				kind: "single",
				scope: "session"
			},
			{
				name: "conversation.input.model",
				kind: "single",
				scope: "session"
			}
		]
	},
	sidebar: {
		locale: "workspace",
		children: [{
			name: "sidebar.workspaces.directoryFlow",
			kind: "single",
			scope: "root"
		}]
	}
};
//#endregion
//#region src/client/settings/ConversationDirectorySection.module.css?inline
var ConversationDirectorySection_module_default = ".dshJustChatSettingsCard {\n  width: 100%;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-3);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  transition: border-color .16s, background .16s;\n}\n\n.dshJustChatSettingsCard:hover {\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.dshJustChatSettingsCardOpen {\n  background: var(--dsw-alias-bg-layer-2);\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.dshJustChatSettingsHeader {\n  width: 100%;\n  min-width: 0;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  background: none;\n  border: 0;\n  border-radius: 12px;\n  align-items: center;\n  gap: 12px;\n  padding: 14px 16px;\n  display: flex;\n}\n\n.dshJustChatSettingsHeader:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n\n.dshJustChatSettingsHeadText {\n  flex-direction: column;\n  flex: 1;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n.dshJustChatSettingsTitle {\n  color: var(--dsw-alias-label-primary);\n  font-size: 15px;\n  font-weight: 600;\n  line-height: 21px;\n}\n\n.dshJustChatSettingsDescription {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dshJustChatSettingsPending {\n  color: var(--dsw-alias-label-secondary);\n  white-space: nowrap;\n  background: var(--dsw-alias-bg-module-platform);\n  border-radius: 999px;\n  flex: none;\n  padding: 1px 8px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 17px;\n}\n\n.dshJustChatSettingsChevron {\n  color: var(--dsw-alias-label-tertiary);\n  flex: none;\n  transition: transform .16s;\n}\n\n.dshJustChatSettingsChevronOpen {\n  transform: rotate(180deg);\n}\n\n.dshJustChatSettingsBody {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n  padding: 0 16px 12px;\n}\n\n.dshJustChatSettingsReadOnly {\n  color: var(--dsw-alias-label-tertiary);\n  margin: 12px 0 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.dshJustChatSettingsField {\n  flex-direction: column;\n  gap: 6px;\n  min-width: 0;\n  padding: 12px 0;\n  display: flex;\n}\n\n.dshJustChatSettingsField + .dshJustChatSettingsField {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n}\n\n.dshJustChatSettingsFieldHead {\n  align-items: center;\n  min-width: 0;\n  display: flex;\n}\n\n.dshJustChatSettingsLabel {\n  min-width: 0;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 20px;\n}\n\n.dshJustChatSettingsFieldDescription {\n  color: var(--dsw-alias-label-tertiary);\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.dshJustChatSettingsControl {\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  display: flex;\n}\n\n.dshJustChatSettingsPathInput {\n  flex: 1;\n  min-width: 0;\n}\n\n.dshJustChatSettingsTemplateInput {\n  width: 100%;\n}\n\n.dshJustChatSettingsTemplateHelp {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.dshJustChatSettingsTemplateDefault {\n  margin: 2px 0 10px;\n}\n\n.dshJustChatSettingsTemplateHelp code, .dshJustChatSettingsVariableName code {\n  color: var(--dsw-alias-label-secondary);\n  font-family: var(--dsw-font-family-code);\n  overflow-wrap: anywhere;\n}\n\n.dshJustChatSettingsVariables {\n  grid-template-columns: minmax(170px, max-content) minmax(0, 1fr);\n  gap: 6px 16px;\n  margin: 0;\n  display: grid;\n}\n\n.dshJustChatSettingsVariable {\n  display: contents;\n}\n\n.dshJustChatSettingsVariableName, .dshJustChatSettingsVariableDescription {\n  min-width: 0;\n  margin: 0;\n}\n\n.dshJustChatSettingsVariableDescription {\n  overflow-wrap: anywhere;\n}\n\n.dshJustChatSettingsActions {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n  justify-content: flex-end;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  padding-top: 12px;\n  display: flex;\n}\n\n.dshJustChatSettingsPreview {\n  color: var(--dsw-alias-label-secondary);\n  font-family: var(--dsw-font-family-code);\n  overflow-wrap: anywhere;\n  margin: 10px 0 0;\n  font-size: 12px;\n  line-height: 18px;\n  display: block;\n}\n\n.dshJustChatSettingsError {\n  min-width: 0;\n  color: var(--dsw-alias-state-error-primary);\n  overflow-wrap: anywhere;\n  flex: 240px;\n  margin: 0 auto 0 0;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n@media (width <= 640px) {\n  .dshJustChatSettingsVariables {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 2px;\n  }\n\n  .dshJustChatSettingsVariableName {\n    padding-top: 4px;\n  }\n\n  .dshJustChatSettingsActions {\n    flex-wrap: wrap;\n  }\n\n  .dshJustChatSettingsError {\n    flex-basis: 100%;\n    order: -1;\n  }\n}\n";
//#endregion
//#region src/client/settings/ConversationDirectorySection.tsx
const CSS_TAG_ID = "dsh-just-chat/ConversationDirectorySection.module.css";
const styles = {
	card: "dshJustChatSettingsCard",
	cardOpen: "dshJustChatSettingsCardOpen",
	header: "dshJustChatSettingsHeader",
	headText: "dshJustChatSettingsHeadText",
	title: "dshJustChatSettingsTitle",
	description: "dshJustChatSettingsDescription",
	pending: "dshJustChatSettingsPending",
	chevron: "dshJustChatSettingsChevron",
	chevronOpen: "dshJustChatSettingsChevronOpen",
	body: "dshJustChatSettingsBody",
	readOnly: "dshJustChatSettingsReadOnly",
	field: "dshJustChatSettingsField",
	fieldHead: "dshJustChatSettingsFieldHead",
	label: "dshJustChatSettingsLabel",
	fieldDescription: "dshJustChatSettingsFieldDescription",
	control: "dshJustChatSettingsControl",
	pathInput: "dshJustChatSettingsPathInput",
	templateInput: "dshJustChatSettingsTemplateInput",
	templateHelp: "dshJustChatSettingsTemplateHelp",
	templateDefault: "dshJustChatSettingsTemplateDefault",
	variables: "dshJustChatSettingsVariables",
	variable: "dshJustChatSettingsVariable",
	variableName: "dshJustChatSettingsVariableName",
	variableDescription: "dshJustChatSettingsVariableDescription",
	actions: "dshJustChatSettingsActions",
	preview: "dshJustChatSettingsPreview",
	error: "dshJustChatSettingsError"
};
if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`) === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-just-chat";
	tag.dataset.pluginCss = CSS_TAG_ID;
	tag.textContent = ConversationDirectorySection_module_default;
	document.head.appendChild(tag);
}
const TEMPLATE_VARIABLES = [
	{
		expression: "${date.yyyy}",
		description: "主机本地时区的四位年份。"
	},
	{
		expression: "${date.MM}",
		description: "两位月份。"
	},
	{
		expression: "${date.dd}",
		description: "两位日期。"
	},
	{
		expression: "${time.HH}",
		description: "两位小时，使用 24 小时制。"
	},
	{
		expression: "${time.mm}",
		description: "两位分钟。"
	},
	{
		expression: "${time.ss}",
		description: "两位秒。"
	},
	{
		expression: "${message.firstSentence}",
		description: "消息按中英文逗号和句号分割后的第一个非空片段。"
	},
	{
		expression: "${message.words(n)}",
		description: "前 n 个英文单词；n 必须是 1 到 32 的十进制整数。"
	}
];
function settingsValue(snapshot) {
	return {
		rootDirectory: snapshot.value?.rootDirectory ?? "",
		template: snapshot.value?.template ?? "${date.yyyy}-${date.MM}-${date.dd}/${time.HH}-${time.mm}-${time.ss}-${message.firstSentence}"
	};
}
/** Official plugin-configuration card for the automatic conversation directory. */
function ConversationDirectorySection(props) {
	const snapshot = props.useSettings((state) => state);
	const unavailable = snapshot.status === "unavailable";
	const initial = settingsValue(snapshot);
	const [rootDirectory, setRootDirectory] = useState(initial.rootDirectory);
	const [template, setTemplate] = useState(initial.template);
	const [saved, setSaved] = useState(initial);
	const [preview, setPreview] = useState(void 0);
	const [error, setError] = useState(void 0);
	const [pickingDirectory, setPickingDirectory] = useState(false);
	const [saving, setSaving] = useState(false);
	const [open, setOpen] = useState(false);
	const savedRequest = useRef(null);
	const snapshotValue = settingsValue(snapshot);
	const dirty = rootDirectory.trim() !== saved.rootDirectory || template !== saved.template;
	useEffect(() => {
		if (dirty || saving) return;
		const request = savedRequest.current;
		if (request !== null) {
			if (snapshotValue.rootDirectory !== request.rootDirectory || snapshotValue.template !== request.template) return;
			savedRequest.current = null;
		}
		if (snapshotValue.rootDirectory === saved.rootDirectory && snapshotValue.template === saved.template) return;
		setRootDirectory(snapshotValue.rootDirectory);
		setTemplate(snapshotValue.template);
		setSaved(snapshotValue);
	}, [
		dirty,
		saving,
		saved.rootDirectory,
		saved.template,
		snapshotValue.rootDirectory,
		snapshotValue.template
	]);
	const controlsDisabled = !(snapshot.status === "ready") || !snapshot.writable || saving;
	if (unavailable) return null;
	const editRootDirectory = (value) => {
		setRootDirectory(value);
		setError(void 0);
		setPreview(void 0);
	};
	const editTemplate = (value) => {
		setTemplate(value);
		setError(void 0);
		setPreview(void 0);
	};
	const browse = async () => {
		setError(void 0);
		setPickingDirectory(true);
		try {
			const selected = await props.pickDirectory();
			if (selected !== null) editRootDirectory(selected);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setPickingDirectory(false);
		}
	};
	const save = async () => {
		if (controlsDisabled || !dirty) return;
		setError(void 0);
		setSaving(true);
		const next = {
			rootDirectory: rootDirectory.trim(),
			template
		};
		try {
			await props.saveSettings(next.rootDirectory, next.template);
			setRootDirectory(next.rootDirectory);
			setSaved(next);
			savedRequest.current = next;
			setPreview(void 0);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setSaving(false);
		}
	};
	const discard = () => {
		if (saving) return;
		setRootDirectory(saved.rootDirectory);
		setTemplate(saved.template);
		setPreview(void 0);
		setError(void 0);
	};
	const showPreview = async () => {
		setError(void 0);
		try {
			const result = await props.api.preview(template, "示例消息 example");
			if (!result.valid) {
				setPreview(void 0);
				setError(result.message ?? "模板无效");
				return;
			}
			setPreview(result.path);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	};
	const bodyId = "dsh-just-chat-settings-body";
	return /* @__PURE__ */ jsxs("article", {
		className: `${styles.card} ${open ? styles.cardOpen : ""}`,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			className: styles.header,
			"aria-expanded": open,
			"aria-controls": bodyId,
			onClick: () => {
				setOpen((value) => !value);
			},
			children: [
				/* @__PURE__ */ jsxs("span", {
					className: styles.headText,
					children: [/* @__PURE__ */ jsx("span", {
						className: styles.title,
						children: "对话目录"
					}), /* @__PURE__ */ jsx("span", {
						className: styles.description,
						children: "设置自动对话的根目录和目录名模板。"
					})]
				}),
				dirty && /* @__PURE__ */ jsx("span", {
					className: styles.pending,
					children: "未保存"
				}),
				/* @__PURE__ */ jsx(IconChevronDownOutline14, { className: `${styles.chevron} ${open ? styles.chevronOpen : ""}` })
			]
		}), open && /* @__PURE__ */ jsxs("div", {
			className: styles.body,
			id: bodyId,
			children: [
				!snapshot.writable && /* @__PURE__ */ jsx("p", {
					className: styles.readOnly,
					role: "status",
					children: "此部署的设置为只读。"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: styles.field,
					children: [
						/* @__PURE__ */ jsx("div", {
							className: styles.fieldHead,
							children: /* @__PURE__ */ jsx("label", {
								className: styles.label,
								htmlFor: "dsh-just-chat-root-directory",
								children: "对话根目录"
							})
						}),
						/* @__PURE__ */ jsx("p", {
							className: styles.fieldDescription,
							children: "选择保存自动对话的现有目录。"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: styles.control,
							children: [/* @__PURE__ */ jsx(Input, {
								id: "dsh-just-chat-root-directory",
								className: styles.pathInput,
								value: rootDirectory,
								disabled: controlsDisabled || pickingDirectory,
								onChange: (event) => {
									editRootDirectory(event.currentTarget.value);
								}
							}), /* @__PURE__ */ jsx(Button, {
								variant: "outline",
								size: "sm",
								icon: /* @__PURE__ */ jsx(IconBrowseOutline16, { size: 16 }),
								disabled: controlsDisabled || pickingDirectory,
								onClick: () => {
									browse();
								},
								children: "浏览"
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: styles.field,
					children: [
						/* @__PURE__ */ jsx("div", {
							className: styles.fieldHead,
							children: /* @__PURE__ */ jsx("label", {
								className: styles.label,
								htmlFor: "dsh-just-chat-template",
								children: "目录名模板"
							})
						}),
						/* @__PURE__ */ jsx("p", {
							className: styles.fieldDescription,
							children: "每条消息按模板生成相对目录路径，只支持下方列出的参数。"
						}),
						/* @__PURE__ */ jsx(Input, {
							id: "dsh-just-chat-template",
							className: styles.templateInput,
							value: template,
							disabled: controlsDisabled,
							onChange: (event) => {
								editTemplate(event.currentTarget.value);
							}
						}),
						/* @__PURE__ */ jsxs("div", {
							className: styles.templateHelp,
							children: [/* @__PURE__ */ jsxs("p", {
								className: styles.templateDefault,
								children: ["默认模板：", /* @__PURE__ */ jsx("code", { children: "${date.yyyy}-${date.MM}-${date.dd}/${time.HH}-${time.mm}-${time.ss}-${message.firstSentence}" })]
							}), /* @__PURE__ */ jsx("dl", {
								className: styles.variables,
								children: TEMPLATE_VARIABLES.map((variable) => /* @__PURE__ */ jsxs("div", {
									className: styles.variable,
									children: [/* @__PURE__ */ jsx("dt", {
										className: styles.variableName,
										children: /* @__PURE__ */ jsx("code", { children: variable.expression })
									}), /* @__PURE__ */ jsx("dd", {
										className: styles.variableDescription,
										children: variable.description
									})]
								}, variable.expression))
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: styles.actions,
					children: [
						error !== void 0 && /* @__PURE__ */ jsx("p", {
							className: styles.error,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "outline",
							disabled: saving,
							onClick: () => {
								showPreview();
							},
							children: "预览"
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "outline",
							disabled: !dirty || saving,
							onClick: discard,
							children: "放弃修改"
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "primary",
							disabled: !dirty || controlsDisabled,
							onClick: () => {
								save();
							},
							children: saving ? "保存中…" : "保存"
						})
					]
				}),
				preview !== void 0 && /* @__PURE__ */ jsxs("output", {
					className: styles.preview,
					"aria-live": "polite",
					children: ["示例预览：", preview]
				})
			]
		})]
	});
}
//#endregion
//#region src/client/settings/ConversationDirectoryOnboarding.tsx
/** 仅在缺少根目录的提交明确请求时挂载设置引导项。 */
function createConversationDirectoryOnboardingRegistration(deps) {
	let unregister;
	const sync = () => {
		const requested = deps.request.getSnapshot() === "conversation-directory";
		if (requested && unregister === void 0) {
			unregister = deps.register();
			return;
		}
		if (!requested && unregister !== void 0) {
			const dispose = unregister;
			unregister = void 0;
			dispose();
		}
	};
	const unsubscribe = deps.request.subscribe(sync);
	sync();
	return () => {
		unsubscribe();
		unregister?.();
		unregister = void 0;
	};
}
/** 通过 DSH 公开的引导 owner 打开插件设置分区，然后结束本次引导请求。 */
function ConversationDirectoryOnboarding(props) {
	const handled = useRef(false);
	useEffect(() => {
		if (handled.current) return;
		handled.current = true;
		props.openSection("plugins");
		props.complete();
		props.acknowledge();
	}, [
		props.acknowledge,
		props.complete,
		props.openSection
	]);
	return null;
}
//#endregion
//#region src/client/stores/pending-draft-store.ts
/**
* Create the browser-persisted draft store. The runtime owns the localStorage
* adapter and persistence lifecycle.
*/
function createPendingDraftStore() {
	return createSnapshotStore({
		mode: "none",
		draft: ""
	}, { persist: { name: "dsh-just-chat.pending-draft" } });
}
/** Keep only text and the explicit mode in the persisted state. */
function setPendingDraft(store, mode, draft) {
	store.set({
		mode,
		draft
	});
}
/** Clear the persisted copy only after InputActions accepted the handoff. */
function clearPendingDraft(store) {
	store.set({
		mode: "none",
		draft: ""
	});
}
//#endregion
//#region src/client/handoff.ts
function errorOf(error) {
	return {
		code: typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "client",
		message: error instanceof Error ? error.message : String(error)
	};
}
/**
* Orchestrate directory preparation, official session creation, activation,
* opening, preset gate, and the later session-scope InputActions handoff.
*/
function createSubmissionController(deps) {
	let run;
	const setPhase = (submission, error) => {
		deps.viewStore.update((state) => {
			state.submission = submission;
			state.error = error;
		});
	};
	const cleanup = () => {
		if (run?.timer !== void 0) clearTimeout(run.timer);
		run?.listenerDispose?.();
		if (run !== void 0) {
			run.timer = void 0;
			run.listenerDispose = void 0;
		}
	};
	const resolveHandoff = () => {
		if (run === void 0 || run.gateClosed || run.sessionId === void 0) return;
		run.gateClosed = true;
		cleanup();
		setPhase("handingOff");
	};
	const startPreparation = async (text) => {
		if (run !== void 0 || text.trim() === "") return;
		const next = {
			sessionId: void 0,
			frozenText: text,
			eventSeen: false,
			timer: void 0,
			listenerDispose: void 0,
			handoffClaimed: false,
			gateClosed: false
		};
		run = next;
		deps.viewStore.update((state) => {
			state.submission = "preparing";
			state.frozenDraft = text;
			state.error = void 0;
			state.settingsSectionRequest = void 0;
		});
		const gateEvent = (sessionId) => {
			if (run !== next || next.sessionId !== sessionId) return;
			next.eventSeen = true;
			if (next.timer !== void 0) clearTimeout(next.timer);
			next.timer = void 0;
			resolveHandoff();
		};
		next.listenerDispose = deps.remote.$on("agent-preset/selected", gateEvent);
		try {
			const prepared = await deps.api.prepare(text);
			if (run !== next) return;
			next.sessionId = prepared.sessionId;
			setPhase("creatingSession");
			await deps.sessions.create({
				cwd: prepared.cwd,
				sessionId: prepared.sessionId
			});
			if (run !== next) return;
			setPhase("activating");
			const activated = await deps.api.activate(prepared.sessionId, prepared.cwd);
			if (run !== next) return;
			deps.viewStore.update((state) => {
				state.prepared = state.prepared.filter((record) => record.sessionId !== activated.sessionId);
				state.active = [...state.active.filter((record) => record.sessionId !== activated.sessionId), activated];
			});
			deps.sessions.open(prepared.sessionId);
			if (!(deps.nowHasPreset?.(prepared.sessionId) ?? deps.sessions.list.getSnapshot().byId[prepared.sessionId]?.agentPreset !== void 0)) resolveHandoff();
			else {
				setPhase("waitingPreset");
				if (next.eventSeen) resolveHandoff();
				else next.timer = setTimeout(resolveHandoff, 3e3);
			}
		} catch (error) {
			if (run !== next) return;
			cleanup();
			run = void 0;
			const viewError = errorOf(error);
			deps.viewStore.update((state) => {
				state.submission = "error";
				state.error = viewError;
				if (viewError.code === "settings-missing-root") state.settingsSectionRequest = "conversation-directory";
			});
		}
	};
	const takeHandoff = (sessionId) => {
		if (run === void 0 || run.sessionId !== sessionId || run.handoffClaimed || !run.gateClosed) return void 0;
		run.handoffClaimed = true;
		return run.frozenText;
	};
	const ownsSession = (sessionId) => run?.sessionId === sessionId;
	const completeHandoff = (sessionId) => {
		if (run?.sessionId !== sessionId) return;
		clearPendingDraft(deps.pendingStore);
		setPhase("sent");
		deps.viewStore.update((state) => {
			state.frozenDraft = void 0;
		});
		run = void 0;
	};
	const failHandoff = (sessionId, error) => {
		if (run?.sessionId !== sessionId) return;
		cleanup();
		setPhase("error", errorOf(error));
		run = void 0;
	};
	return {
		startPreparation,
		ownsSession,
		takeHandoff,
		completeHandoff,
		failHandoff
	};
}
//#endregion
//#region src/client/stores/view-store.ts
/** Create one view store per plugin fiber. */
function createViewStore() {
	return createSnapshotStore({
		prepared: [],
		active: [],
		submission: "idle",
		frozenDraft: void 0,
		error: void 0,
		settingsSectionRequest: void 0,
		conversationSearch: {
			query: "",
			status: "idle",
			results: []
		}
	});
}
/** Replace the host record projection while preserving local view choices. */
function setConversationRecords(store, records) {
	store.update((state) => {
		state.active = records.filter((record) => record.status === "active");
		state.prepared = records.filter((record) => record.status === "prepared");
	});
}
//#endregion
//#region src/client/stores/conversation-order-store.ts
/** Create the root-persisted manual order for automatic conversation rows. */
function createConversationOrderStore() {
	return createSnapshotStore({ sessionIds: [] }, { persist: { name: "dsh-just-chat.conversation-order" } });
}
//#endregion
//#region src/client/index.ts
const inject = [
	"connection",
	"slots",
	"sessions",
	"workspaces",
	"remote",
	"settingsScope"
];
/** Register the pre-session workspace picker after its owning slot is declared. */
function apply(ctx) {
	const pendingDraftStore = createPendingDraftStore();
	const viewStore = createViewStore();
	const conversationOrderStore = createConversationOrderStore();
	const sessions = {
		create: async (options) => {
			const { result } = await ctx.connection.api.sessions.create(options);
			if (!result.ok) throw new Error(result.error.message);
		},
		open: (sessionId) => ctx.sessions.open(sessionId),
		list: ctx.sessions.list
	};
	const api = createJustChatApi();
	const settings = ctx.settingsScope.bind({ namespace: "dsh-just-chat" });
	const saveSettings = async (rootDirectory, template) => {
		await api.saveSettings(rootDirectory, template);
	};
	const controller = createSubmissionController({
		api,
		sessions,
		remote: ctx.remote,
		viewStore,
		pendingStore: pendingDraftStore
	});
	const refreshConversationRecords = async () => {
		setConversationRecords(viewStore, await api.listConversations());
	};
	const settingsInjected = () => ({
		hooks: { settings },
		api,
		pickDirectory: () => ctx.workspaces.pickDirectory(),
		saveSettings
	});
	ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
		name: "settings.plugin.item",
		key: "dsh-just-chat",
		inject: settingsInjected
	}, ConversationDirectorySection));
	ctx.slots.inject("settings.onboarding", () => createConversationDirectoryOnboardingRegistration({
		request: {
			getSnapshot: () => viewStore.getSnapshot().settingsSectionRequest,
			subscribe: (listener) => viewStore.subscribe(listener)
		},
		register: () => ctx.slots.register({
			name: "settings.onboarding",
			id: "conversation-directory-required",
			order: 100,
			inject: () => ({ acknowledge: () => {
				viewStore.update((state) => {
					state.settingsSectionRequest = void 0;
				});
			} })
		}, ConversationDirectoryOnboarding)
	}));
	ctx.slots.inject("conversation.composer.bar", () => installLiveEntry(ctx.slots, "conversation.composer.bar", OFFICIAL_ENTRY_CONTRACTS.composer, createComposerBarAdapter({
		pending: pendingDraftStore,
		view: viewStore,
		controller,
		updatePendingDraft: (draft) => {
			const current = pendingDraftStore.getSnapshot();
			setPendingDraft(pendingDraftStore, current.mode, draft);
		},
		completePendingHandoff: () => {
			pendingDraftStore.getSnapshot();
			setPendingDraft(pendingDraftStore, "none", "");
		},
		startPreparation: (text) => controller.startPreparation(text)
	})));
	ctx.slots.inject("conversation", () => installLiveEntry(ctx.slots, "conversation", OFFICIAL_ENTRY_CONTRACTS.conversation, createConversationAdapter({ pending: pendingDraftStore })));
	ctx.slots.inject("conversation.hero.workspace", () => installLiveEntry(ctx.slots, "conversation.hero.workspace", OFFICIAL_ENTRY_CONTRACTS.picker, createWorkspacePickerAdapter({
		pending: pendingDraftStore,
		chooseWorkspace: () => {
			const current = pendingDraftStore.getSnapshot();
			setPendingDraft(pendingDraftStore, "workspace", current.draft);
		},
		chooseJustChat: () => {
			const current = pendingDraftStore.getSnapshot();
			setPendingDraft(pendingDraftStore, "just-chat", current.draft);
		}
	})));
	ctx.slots.inject("sidebar.workspaces", () => installLiveEntry(ctx.slots, "sidebar.workspaces", OFFICIAL_ENTRY_CONTRACTS.sidebar, createSidebarBrowserAdapter({
		view: viewStore,
		order: conversationOrderStore,
		refreshConversationRecords
	})));
}
//#endregion
export { apply, inject };

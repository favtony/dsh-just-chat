window.__ModuleLoader__.load({
	id: "dsh-just-chat",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
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
			(0, react.useEffect)(() => {
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
		//#region src/client/ComposerBar.tsx
		const ACTIVE_SUBMISSION_PHASES = /* @__PURE__ */ new Set([
			"preparing",
			"creatingSession",
			"activating",
			"waitingPreset",
			"handingOff"
		]);
		function isComposerDisabled(input) {
			const justChatEditor = !input.realSession && input.mode === "just-chat";
			return input.blocked || input.busy || ACTIVE_SUBMISSION_PHASES.has(input.submission) || input.ownerDisabled && !justChatEditor;
		}
		/**
		* Minimal public-input composer. It keeps the official session action face
		* intact and adds only the no-session just-chat preparation branch.
		*/
		function ComposerBar(props) {
			const currentInput = props.useInput?.((state) => state.draft) ?? void 0;
			const pending = props.usePendingDraft((state) => state);
			const view = props.useView((state) => state);
			const [draft, setDraft] = (0, react.useState)(currentInput ?? pending.draft);
			const [busy, setBusy] = (0, react.useState)(false);
			const realSession = props.inputActions !== void 0 && props.sessionId !== void 0;
			(0, react.useEffect)(() => {
				if (!realSession || props.sessionId === void 0) {
					if (currentInput !== void 0) setDraft(currentInput);
					return;
				}
				if (pending.mode === "workspace") {
					try {
						props.inputActions?.setDraft(pending.draft);
						setDraft(pending.draft);
						props.completePendingHandoff();
						props.releaseComposer();
					} catch {}
					return;
				}
				if (props.controller.ownsSession(props.sessionId)) return;
				if (currentInput !== void 0) setDraft(currentInput);
				props.releaseComposer();
			}, [
				currentInput,
				pending.draft,
				pending.mode,
				props.completePendingHandoff,
				props.controller,
				props.inputActions,
				props.releaseComposer,
				props.sessionId,
				realSession
			]);
			const disabled = isComposerDisabled({
				ownerDisabled: props.disabled === true,
				blocked: props.blocked !== void 0,
				busy,
				submission: view.submission,
				mode: pending.mode,
				realSession
			});
			const pendingEditor = !realSession && pending.mode === "just-chat";
			const submit = () => {
				if (disabled) return;
				if (realSession) {
					props.inputActions?.setDraft(draft);
					props.inputActions?.submit();
					return;
				}
				if (pending.mode !== "just-chat" || draft.trim() === "") {
					props.onRequestWorkspace?.();
					return;
				}
				setBusy(true);
				props.startPreparation(draft).finally(() => {
					setBusy(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"aria-label": "消息输入",
				"data-variant": props.variant,
				children: [
					props.accessory,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						value: draft,
						disabled,
						placeholder: props.blocked?.reason ?? (pendingEditor ? "输入消息" : props.placeholder ?? "输入消息"),
						onChange: (event) => {
							const text = event.currentTarget.value;
							setDraft(text);
							if (!realSession) props.updatePendingDraft(text);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								submit();
							}
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						props.leftItems,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: disabled || draft.trim() === "",
							onClick: submit,
							children: "发送"
						}),
						props.rightItems
					] }),
					props.footer,
					view.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: view.error.message
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationHandoff, {
						sessionId: props.sessionId,
						inputActions: props.inputActions,
						controller: props.controller,
						ready: view.submission === "handingOff",
						onComplete: props.releaseComposer
					})
				]
			});
		}
		//#endregion
		//#region src/client/composer-takeover.ts
		/**
		* 只在存在待选草稿且当前没有会话时安装临时输入栏。
		*
		* 当前会话出现后不在订阅回调里抢先撤销：组件还需要取得该会话的
		* InputActions 完成草稿交接。交接组件明确调用 release 后，默认输入栏
		* 才重新成为 single slot 的活动项。
		*/
		function createComposerTakeover(deps) {
			let disposed = false;
			let unregister;
			const release = () => {
				const current = unregister;
				unregister = void 0;
				current?.();
			};
			const reconcile = () => {
				if (disposed) return;
				const noSession = deps.sessions.getSnapshot().current === void 0;
				const hasPendingMode = deps.pending.getSnapshot().mode !== "none";
				if (noSession && hasPendingMode) {
					unregister ??= deps.register();
					return;
				}
				if (noSession) release();
			};
			const unsubscribePending = deps.pending.subscribe(reconcile);
			const unsubscribeSessions = deps.sessions.subscribe(reconcile);
			try {
				reconcile();
			} catch (error) {
				unsubscribeSessions();
				unsubscribePending();
				release();
				throw error;
			}
			return {
				release,
				dispose: () => {
					if (disposed) return;
					disposed = true;
					unsubscribeSessions();
					unsubscribePending();
					release();
				}
			};
		}
		//#endregion
		//#region src/client/settings/ConversationDirectorySection.tsx
		/** Settings page for the root directory and generated directory name template. */
		function ConversationDirectorySection(props) {
			const snapshot = props.useSettings((state) => state);
			const [rootDirectory, setRootDirectory] = (0, react.useState)(snapshot.value?.rootDirectory ?? "");
			const [template, setTemplate] = (0, react.useState)(snapshot.value?.template ?? "${date.yyyy}-${date.MM}-${date.dd}/${time.HH}-${time.mm}-${time.ss}-${message.firstSentence}");
			const [preview, setPreview] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const save = async () => {
				setError(void 0);
				try {
					await props.saveSettings(rootDirectory.trim(), template);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			const showPreview = async () => {
				setError(void 0);
				try {
					const result = await props.api.preview(template, "示例消息 example");
					if (!result.valid) setError(result.message ?? "模板无效");
					setPreview(result.path);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "dsh-just-chat-settings-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						id: "dsh-just-chat-settings-title",
						children: "对话目录"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["对话根目录", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: rootDirectory,
						onChange: (event) => {
							setRootDirectory(event.currentTarget.value);
						}
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["目录名模板", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: template,
						onChange: (event) => {
							setTemplate(event.currentTarget.value);
						}
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							showPreview();
						},
						children: "预览"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							save();
						},
						children: "保存"
					}),
					preview !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("output", { children: preview }),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: props.close,
						children: "关闭"
					})
				]
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
			const handled = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (handled.current) return;
				handled.current = true;
				props.openSection("conversation-directory");
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
			return (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
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
			return (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
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
			return (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({ sessionIds: [] }, { persist: { name: "dsh-just-chat.conversation-order" } });
		}
		/** Place one automatic conversation before another row or at the end. */
		function setConversationOrder(store, sessionId, beforeSessionId) {
			store.update((state) => {
				const sessionIds = state.sessionIds.filter((id) => id !== sessionId);
				const index = beforeSessionId === void 0 ? sessionIds.length : sessionIds.indexOf(beforeSessionId);
				sessionIds.splice(index < 0 ? sessionIds.length : index, 0, sessionId);
				state.sessionIds = sessionIds;
			});
		}
		//#endregion
		//#region src/client/SidebarBrowser.tsx
		function relativeUpdatedAt(updatedAt) {
			const elapsed = Math.max(0, Date.now() - updatedAt);
			const minute = 6e4;
			const hour = 60 * minute;
			const day = 24 * hour;
			if (elapsed < minute) return "刚刚";
			if (elapsed < hour) return `${Math.floor(elapsed / minute)} 分钟前`;
			if (elapsed < day) return `${Math.floor(elapsed / hour)} 小时前`;
			return `${Math.floor(elapsed / day)} 天前`;
		}
		/**
		* Complete sidebar-workspaces replacement. It uses public snapshots and keeps
		* the plugin's active-record projection separate from ordinary workspaces.
		*/
		function SidebarBrowser(props) {
			const sessions = props.useSessions((state) => state);
			const workspaceState = props.useWorkspaces((state) => state);
			const view = props.useView((state) => state);
			const manualOrder = props.useOrder((state) => state.sessionIds);
			const directoryFlowAvailable = props.useDirectoryFlow((occupied) => occupied);
			const workspaces = workspaceState.items;
			const records = (0, react.useMemo)(() => [...view.prepared, ...view.active], [view.active, view.prepared]);
			const [query, setQuery] = (0, react.useState)("");
			const [searchIds, setSearchIds] = (0, react.useState)(void 0);
			const [searching, setSearching] = (0, react.useState)(false);
			const [dragged, setDragged] = (0, react.useState)(void 0);
			const [editing, setEditing] = (0, react.useState)(void 0);
			const [rowError, setRowError] = (0, react.useState)(void 0);
			const [directoryFlowOpen, setDirectoryFlowOpen] = (0, react.useState)(false);
			const [creatingWorkspace, setCreatingWorkspace] = (0, react.useState)(false);
			const abortRef = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				if (!directoryFlowAvailable) setDirectoryFlowOpen(false);
			}, [directoryFlowAvailable]);
			(0, react.useEffect)(() => {
				props.refreshConversationRecords();
				return () => {
					abortRef.current?.abort();
				};
			}, [props.refreshConversationRecords]);
			const activeIds = (0, react.useMemo)(() => new Set(records.filter((record) => record.status === "active").map((record) => record.sessionId)), [records]);
			const archived = (0, react.useMemo)(() => new Set(workspaceState.archivedSessionIds), [workspaceState.archivedSessionIds]);
			const automatic = (0, react.useMemo)(() => {
				const initial = records.filter((record) => record.status === "active").map((record) => sessions.byId[record.sessionId]).filter((row) => row !== void 0).filter((row) => row.parentId === void 0 && row.origin !== "subagent" && !archived.has(row.id)).slice().sort((a, b) => {
					const aRecord = records.find((record) => record.sessionId === a.id);
					const time = (records.find((record) => record.sessionId === b.id)?.createdAt ?? 0) - (aRecord?.createdAt ?? 0);
					return time !== 0 ? time : a.id.localeCompare(b.id);
				});
				if (manualOrder.length === 0) return initial;
				const rank = new Map(manualOrder.map((id, index) => [id, index]));
				return initial.slice().sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
			}, [
				archived,
				manualOrder,
				records,
				sessions.byId
			]);
			(0, react.useEffect)(() => {
				abortRef.current?.abort();
				const normalized = query.trim();
				if (normalized === "") {
					setSearchIds(void 0);
					setSearching(false);
					return;
				}
				const titleHits = automatic.filter((row) => row.displayTitle.toLocaleLowerCase().includes(normalized.toLocaleLowerCase())).map((row) => row.id);
				const controller = new AbortController();
				abortRef.current = controller;
				setSearching(true);
				setRowError(void 0);
				props.searchMessages(normalized, controller.signal).then((results) => {
					if (controller.signal.aborted) return;
					setSearchIds([.../* @__PURE__ */ new Set([...titleHits, ...results.filter((result) => activeIds.has(result.sessionId)).map((result) => result.sessionId)])]);
					setSearching(false);
				}).catch((error) => {
					if (controller.signal.aborted) return;
					setSearchIds([]);
					setSearching(false);
					setRowError(error instanceof Error ? error.message : String(error));
				});
				return () => {
					controller.abort();
				};
			}, [
				activeIds,
				automatic,
				query,
				props.searchMessages
			]);
			const visibleAutomatic = searchIds === void 0 ? automatic : automatic.filter((row) => searchIds.includes(row.id));
			const drop = (beforeSessionId) => {
				if (dragged === void 0) return;
				props.setManualOrder(dragged, beforeSessionId);
				setDragged(void 0);
			};
			const rename = async () => {
				if (editing === void 0 || editing.title.trim() === "") return;
				setRowError(void 0);
				try {
					await props.renameSession(editing.sessionId, editing.title.trim());
					setEditing(void 0);
				} catch (error) {
					setRowError(error instanceof Error ? error.message : String(error));
				}
			};
			const directoryFlow = {
				open: directoryFlowOpen,
				busy: creatingWorkspace,
				onPicked: (path) => {
					setCreatingWorkspace(true);
					setRowError(void 0);
					props.createWorkspace(path).then((workspaceId) => {
						setDirectoryFlowOpen(false);
						props.startWorkspaceSession(workspaceId);
					}).catch((error) => {
						setDirectoryFlowOpen(false);
						setRowError(error instanceof Error ? error.message : String(error));
					}).finally(() => {
						setCreatingWorkspace(false);
					});
				},
				onCancel: () => {
					setDirectoryFlowOpen(false);
				},
				onError: (message) => {
					setDirectoryFlowOpen(false);
					setRowError(message);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"aria-label": "工作区和对话",
				"data-wide": props.wide,
				children: [
					!props.wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: props.expandSidebar,
						"aria-label": "展开侧栏",
						children: "展开"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						"aria-label": "工作区",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "工作区" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									props.startWorkspaceSession();
								},
								children: "新建对话"
							}),
							directoryFlowAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: creatingWorkspace,
								onClick: () => {
									setRowError(void 0);
									setDirectoryFlowOpen(true);
								},
								children: "添加工作区"
							})
						] }), workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								props.startWorkspaceSession(workspace.workspaceId);
							},
							children: workspace.title ?? workspace.path
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: workspace.sessionIds.length })] }, workspace.workspaceId))]
					}),
					props.renderSlot("sidebar.workspaces.directoryFlow", directoryFlow),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						"aria-label": "对话",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "对话" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: query,
								placeholder: "搜索对话",
								onChange: (event) => {
									setQuery(event.currentTarget.value);
								}
							})] }),
							visibleAutomatic.map((row) => {
								const status = row.pendingInteraction !== void 0 ? "等待处理" : row.running ? "运行中" : row.completed === true ? "已完成" : void 0;
								const editingRow = editing?.sessionId === row.id ? editing : void 0;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									draggable: true,
									"data-selected": sessions.current === row.id,
									onDragStart: () => {
										setDragged(row.id);
									},
									onDragOver: (event) => {
										event.preventDefault();
									},
									onDrop: () => {
										drop(row.id);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											"aria-current": sessions.current === row.id ? "page" : void 0,
											onClick: () => {
												props.openSession(row.id);
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.displayTitle }),
												status !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													"aria-label": status,
													children: status
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
													dateTime: new Date(row.updatedAt).toISOString(),
													children: relativeUpdatedAt(row.updatedAt)
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
												"aria-label": `${row.displayTitle} 的菜单`,
												children: "更多"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													setEditing({
														sessionId: row.id,
														title: row.displayTitle
													});
													setRowError(void 0);
												},
												children: "重命名"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													setRowError(void 0);
													props.forkSession(row.id).catch((error) => {
														setRowError(error instanceof Error ? error.message : String(error));
													});
												},
												children: "分叉"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													setRowError(void 0);
													props.archiveSession(row.id).catch((error) => {
														setRowError(error instanceof Error ? error.message : String(error));
													});
												},
												children: "归档"
											})
										] }),
										editingRow !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
											onSubmit: (event) => {
												event.preventDefault();
												rename();
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													"aria-label": "对话标题",
													value: editingRow.title,
													onChange: (event) => {
														const title = event.currentTarget.value;
														setEditing((current) => {
															if (current === void 0 || current.sessionId !== row.id) return current;
															return {
																sessionId: current.sessionId,
																title
															};
														});
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "submit",
													children: "保存标题"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														setEditing(void 0);
													},
													children: "取消"
												})
											]
										})
									]
								}, row.id);
							}),
							searching && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "status",
								children: "正在搜索"
							}),
							rowError !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								children: rowError
							}),
							visibleAutomatic.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "暂无对话" })
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/WorkspacePicker.tsx
		/** Extends the official workspace picker with the pre-session just-chat choice. */
		function WorkspacePicker(props) {
			const workspaces = props.useWorkspaces((state) => state.items);
			const flowAvailable = props.useDirectoryFlow((occupied) => occupied);
			const [flowOpen, setFlowOpen] = (0, react.useState)(false);
			const [picking, setPicking] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (!flowAvailable) setFlowOpen(false);
			}, [flowAvailable]);
			const closeMenu = () => {
				props.onClose();
			};
			const chooseWorkspace = (workspaceId) => {
				props.chooseWorkspace();
				props.onPick(workspaceId);
				closeMenu();
			};
			const chooseJustChat = () => {
				props.chooseJustChat();
				closeMenu();
			};
			const directoryFlow = {
				open: flowOpen,
				busy: picking,
				onPicked: (path) => {
					setPicking(true);
					props.createWorkspace({ path }).then((workspace) => {
						setFlowOpen(false);
						props.onPick(workspace.workspaceId);
					}).catch((reason) => {
						setFlowOpen(false);
						setError(reason instanceof Error ? reason.message : String(reason));
					}).finally(() => {
						setPicking(false);
					});
				},
				onCancel: () => {
					setFlowOpen(false);
				},
				onError: (message) => {
					setFlowOpen(false);
					setError(message);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"aria-label": "工作区选择",
				"data-open": props.open,
				children: [
					props.open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "menu",
						children: [
							workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "menuitem",
								disabled: picking,
								onClick: () => {
									chooseWorkspace(workspace.workspaceId);
								},
								children: workspace.title ?? workspace.path
							}, workspace.workspaceId)),
							flowAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "menuitem",
								disabled: picking,
								onClick: () => {
									setError(void 0);
									setFlowOpen(true);
									closeMenu();
								},
								children: "添加工作区"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "menuitem",
								disabled: picking,
								onClick: chooseJustChat,
								children: "不在项目中工作"
							})
						]
					}),
					props.renderSlot("conversation.hero.workspace.directoryFlow", directoryFlow),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error
					})
				]
			});
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
			let composerTakeover;
			const releaseComposer = () => {
				if (composerTakeover === void 0) throw new Error("composer takeover is not active");
				composerTakeover.release();
			};
			const directoryFlow = {
				getSnapshot: () => ctx.slots.entries("conversation.hero.workspace.directoryFlow").length > 0,
				subscribe: (listener) => ctx.slots.subscribe("conversation.hero.workspace.directoryFlow", listener)
			};
			const sidebarDirectoryFlow = {
				getSnapshot: () => ctx.slots.entries("sidebar.workspaces.directoryFlow").length > 0,
				subscribe: (listener) => ctx.slots.subscribe("sidebar.workspaces.directoryFlow", listener)
			};
			const injected = () => ({
				chooseWorkspace: () => {
					const current = pendingDraftStore.getSnapshot();
					setPendingDraft(pendingDraftStore, "workspace", current.draft);
				},
				chooseJustChat: () => {
					const current = pendingDraftStore.getSnapshot();
					setPendingDraft(pendingDraftStore, "just-chat", current.draft);
				},
				createWorkspace: (input) => ctx.workspaces.create(input),
				hooks: { directoryFlow }
			});
			const composerInjected = () => ({
				hooks: {
					pendingDraft: pendingDraftStore,
					view: viewStore
				},
				controller,
				completePendingHandoff: () => {
					clearPendingDraft(pendingDraftStore);
				},
				releaseComposer,
				updatePendingDraft: (draft) => {
					const current = pendingDraftStore.getSnapshot();
					setPendingDraft(pendingDraftStore, current.mode, draft);
				},
				startPreparation: (text) => controller.startPreparation(text)
			});
			const refreshConversationRecords = async () => {
				setConversationRecords(viewStore, await api.listConversations());
			};
			const sidebarInjected = () => ({
				hooks: {
					view: viewStore,
					order: conversationOrderStore,
					directoryFlow: sidebarDirectoryFlow
				},
				refreshConversationRecords,
				searchMessages: async (query, signal) => {
					const response = await ctx.sessions.search(query, signal);
					if (!response.ok) throw new Error(response.error.message);
					return response.value.items;
				},
				openSession: (sessionId) => ctx.sessions.open(sessionId),
				createWorkspace: async (path) => (await ctx.workspaces.create({ path })).workspaceId,
				startWorkspaceSession: (workspaceId) => {
					ctx.workspaces.startSession(workspaceId);
				},
				archiveSession: (sessionId) => ctx.workspaces.archiveSession(sessionId),
				renameSession: async (sessionId, title) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
					const response = await session.rename(title);
					if (!response.ok) throw new Error(response.error.message);
				},
				forkSession: async (sessionId) => {
					const childId = await ctx.sessions.fork({
						sessionId,
						increaseTitle: true
					});
					ctx.sessions.open(childId);
				},
				setManualOrder: (sessionId, beforeSessionId) => {
					setConversationOrder(conversationOrderStore, sessionId, beforeSessionId);
				}
			});
			const settingsInjected = () => ({
				hooks: { settings },
				api,
				saveSettings
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "conversation-directory",
				order: 30,
				label: "对话目录",
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
			ctx.slots.inject("conversation.composer.bar", () => {
				const takeover = createComposerTakeover({
					pending: pendingDraftStore,
					sessions: ctx.sessions.list,
					register: () => ctx.slots.register({
						name: "conversation.composer.bar",
						priority: -1,
						inject: composerInjected
					}, ComposerBar)
				});
				composerTakeover = takeover;
				return () => {
					if (composerTakeover === takeover) composerTakeover = void 0;
					takeover.dispose();
				};
			});
			ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register({
				name: "conversation.hero.workspace",
				priority: -1,
				children: { "conversation.hero.workspace.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				inject: injected
			}, WorkspacePicker));
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				priority: -1,
				children: { "sidebar.workspaces.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				inject: sidebarInjected
			}, SidebarBrowser));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
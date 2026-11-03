window.__ModuleLoader__.load({ id: "@adwmc/helm-d", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
/**
 * helmd client module (browser half).
 *
 * 1. Session header action: Upgrades the helmd agent preset label into a
 *    native interactive capsule action button (Pill Action Button) via slot
 *    shadowing (`priority: -1`). Smoothly opens the security workbench in the
 *    right sidebar without navigating away, creating empty sessions, or reloading.
 * 2. Right sidebar workbench: Three-tab panel (armor profile / case / intercept)
 *    rendered from official slots and DSH theme tokens.
 *
 * Strictly adheres to DSH design tokens (--dsw-alias-*) and zero emojis.
 */
const React = require("react");
const h = React.createElement;

const NS = "helmd";

function ChevronIcon(props) {
	const open = props && props.open;
	return h("svg", {
		viewBox: "0 0 14 14", width: 14, height: 14, fill: "none",
		stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round",
		"aria-hidden": "true",
		style: {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			transition: "transform .16s ease",
			transform: open ? "rotate(180deg)" : "rotate(0deg)",
		},
	},
		h("path", { d: "M3.5 5.25L7 8.75l3.5-3.5" }),
	);
}

function CloseIcon(props) {
	return h("svg", {
		viewBox: "0 0 14 14", width: 14, height: 14, fill: "none",
		stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round",
		"aria-hidden": "true",
		style: {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
		},
	},
		h("path", { d: "M3.5 3.5l7 7M10.5 3.5l-7 7" }),
	);
}

function IconAgentPreset(props) {
	const size = (props && props.size) || 14;
	return h("svg", {
		width: size,
		height: size,
		viewBox: "0 0 16 16",
		fill: "none",
		className: props && props.className,
		style: Object.assign({ flex: "none" }, props && props.style),
	},
		h("mask", { id: "mask0_helmd_preset_icon", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 16, height: 16 },
			h("rect", { width: 16, height: 16, fill: "white" }),
			h("circle", { cx: 7.9995, cy: 3.28319, r: 1.712, fill: "black" }),
			h("circle", { cx: 3.51122, cy: 11.3855, r: 1.712, fill: "black" }),
			h("circle", { cx: 12.4878, cy: 11.3855, r: 1.712, fill: "black" }),
		),
		h("path", {
			mask: "url(#mask0_helmd_preset_icon)",
			d: "M12.2881 11.0425C12.6002 11.3723 13.0413 11.5786 13.5312 11.5786L13.5342 11.5776C13.1476 12.3233 12.6119 12.9785 11.9639 13.5005C10.9327 14.3309 9.6199 14.8286 8.19336 14.8286C7.29864 14.8285 6.45056 14.6313 5.6875 14.2808C6.08309 14.0281 6.36707 13.6189 6.45215 13.1392C6.99022 13.3561 7.57767 13.476 8.19336 13.4761C9.30019 13.4761 10.3157 13.0915 11.1152 12.4478C11.5935 12.0626 11.9924 11.5848 12.2881 11.0425ZM4.14746 4.36475C4.25569 4.83228 4.55488 5.2247 4.95898 5.4585C4.07956 6.30639 3.53144 7.49605 3.53125 8.81396C3.53125 9.69534 3.77613 10.5202 4.20117 11.2231C3.74959 11.3817 3.38395 11.7232 3.19531 12.1597C2.5541 11.2032 2.17969 10.052 2.17969 8.81396C2.17989 7.05087 2.93868 5.4646 4.14746 4.36475ZM8.19336 2.80029C8.85717 2.80029 9.49784 2.90834 10.0967 3.10791C12.3237 3.85044 13.9725 5.86061 14.1846 8.28369C13.9832 8.20048 13.7627 8.15382 13.5312 8.15381C13.2802 8.15381 13.042 8.20907 12.8271 8.30615C12.6281 6.47264 11.3666 4.95616 9.66895 4.39014C9.2063 4.236 8.70989 4.15186 8.19336 4.15186C7.96112 4.15189 7.7329 4.16981 7.50977 4.20264C7.51947 4.12886 7.52637 4.05348 7.52637 3.97705C7.52628 3.56604 7.3811 3.18914 7.13965 2.89404C7.48183 2.83352 7.83381 2.80033 8.19336 2.80029Z",
			fill: "currentColor",
		}),
		h("path", {
			d: "M9.1123 3.28271C9.11205 2.66858 8.61322 2.17041 7.99902 2.17041C7.38504 2.17067 6.88697 2.66874 6.88672 3.28271C6.88672 3.89691 7.38489 4.39574 7.99902 4.396C8.61338 4.396 9.1123 3.89707 9.1123 3.28271ZM10.3115 3.28271C10.3115 4.55981 9.27612 5.59521 7.99902 5.59521C6.72214 5.59496 5.6875 4.55965 5.6875 3.28271C5.68776 2.00599 6.7223 0.971447 7.99902 0.971191C9.27596 0.971191 10.3113 2.00584 10.3115 3.28271Z",
			fill: "currentColor",
		}),
		h("path", {
			d: "M4.62402 11.385C4.62377 10.7709 4.12494 10.2727 3.51074 10.2727C2.89676 10.273 2.39869 10.771 2.39844 11.385C2.39844 11.9992 2.89661 12.498 3.51074 12.4983C4.1251 12.4983 4.62402 11.9994 4.62402 11.385ZM5.82324 11.385C5.82324 12.6621 4.78784 13.6975 3.51074 13.6975C2.23386 13.6973 1.19922 12.6619 1.19922 11.385C1.19947 10.1083 2.23402 9.07374 3.51074 9.07349C4.78768 9.07349 5.82299 10.1081 5.82324 11.385Z",
			fill: "currentColor",
		}),
	);
}

// Brand mark shared by the header capsule and the right-sidebar tab. Same
// geometry as assets/helm-d-{light,dark}.svg, cropped to its ink bounds so a
// 14-16px UI slot shows the full Hd silhouette instead of a tiny glyph
// floating in a 256px viewBox.
let helmdMarkSeq = 0;
function HelmdMark(props) {
	const height = (props && props.height) || 16;
	const width = Math.round(height * 206 / 168);
	const maskId = React.useMemo(function () {
		return "helmd-mark-crack-" + (++helmdMarkSeq);
	}, []);
	return h("svg", {
		width,
		height,
		viewBox: "20 44 206 168",
		fill: "none",
		className: props && props.className,
		"aria-hidden": "true",
		style: Object.assign({ flex: "none", display: "block" }, props && props.style),
	},
		h("defs", null,
			h("mask", { id: maskId, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 256, height: 256 },
				h("rect", { width: 256, height: 256, fill: "#fff" }),
				h("path", {
					d: "M224 100 208 114 216 124 202 136",
					fill: "none",
					stroke: "#000",
					strokeWidth: 8,
					strokeLinecap: "round",
					strokeLinejoin: "round",
				}),
			),
		),
		h("g", {
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 28,
			strokeLinecap: "round",
			strokeLinejoin: "round",
		},
			h("path", { d: "M38 60V196M94 60V196M38 128H94" }),
			h("path", { d: "M208 60V196" }),
			h("g", { mask: "url(#" + maskId + ")" },
				h("path", { d: "M208 112C166 108 142 128 142 148C142 172 166 188 208 184" }),
			),
			h("path", { d: "M164 134 180 148 164 162", strokeWidth: 12 }),
			h("path", { d: "M184 162H198", strokeWidth: 12 }),
		),
	);
}

exports.inject = ["slots", "sidebarRight", "sidebarRightTabs"];

exports.apply = function apply(ctx) {
	// --------------------------------------------------------------------------
	// 1. Header Capsule Action Button: HelmdPresetCapsuleButton
	//    Upgrades the header's helmd label into an interactive capsule button.
	// --------------------------------------------------------------------------
	//    Upgrades the header's helmd label into an interactive capsule button.
	// --------------------------------------------------------------------------
	function HelmdPresetCapsuleButton(props) {
		const preset = props.useSessions ? props.useSessions(function (state) {
			const s = state.byId && state.byId[props.sessionId];
			const val = s && s.projectionValues && s.projectionValues.agentPreset;
			return typeof val === "string" ? val : undefined;
		}) : undefined;

		const [hovered, setHovered] = React.useState(false);
		const [active, setActive] = React.useState(false);

		// If no preset is associated, follow AgentPresetLabel contract and return null
		if (preset === undefined) return null;

		// Only helm-d sessions get a workbench capsule. Other presets keep the
		// official AgentPresetLabel untouched: this registration deliberately
		// uses its own id instead of shadowing `agent-preset`.
		if (preset !== "helmd") return null;

		const [open, setOpen] = React.useState(false);
		const rootRef = React.useRef(null);

		// Dismiss on outside click or Escape key
		React.useEffect(() => {
			if (!open) return;
			function handlePointerDown(e) {
				if (rootRef.current && !rootRef.current.contains(e.target)) {
					setOpen(false);
				}
			}
			function handleKeyDown(e) {
				if (e.key === "Escape") {
					setOpen(false);
				}
			}
			document.addEventListener("pointerdown", handlePointerDown, true);
			document.addEventListener("keydown", handleKeyDown, true);
			return () => {
				document.removeEventListener("pointerdown", handlePointerDown, true);
				document.removeEventListener("keydown", handleKeyDown, true);
			};
		}, [open]);

		// The right sidebar is the primary workbench surface. The popover is only
		// a fallback for hosts without the sidebarRight service — opening both at
		// once duplicated the whole panel over the conversation.
		function handleToggleWorkbench(e) {
			e.preventDefault();
			e.stopPropagation();

			const expandBtn = document.querySelector('[data-sidebar-right-expand]') ||
			                  document.querySelector('button[aria-label="打开右侧边栏"]') ||
			                  document.querySelector('button[aria-label="Open right sidebar"]');
			if (expandBtn) {
				try { expandBtn.click(); } catch (err) {}
			}

			const sid = props.sessionId;
			const activateTab = () => {
				let opened = false;
				if (ctx.sidebarRight) {
					if (sid && typeof ctx.sidebarRight.openTabIn === "function") {
						try { ctx.sidebarRight.openTabIn(sid, "eval"); opened = true; } catch (err) {}
					}
					if (typeof ctx.sidebarRight.openTab === "function") {
						try { ctx.sidebarRight.openTab("eval"); opened = true; } catch (err) {}
					}
					if (typeof ctx.sidebarRight.isExpanded === "function" && !ctx.sidebarRight.isExpanded()) {
						try {
							if (typeof ctx.sidebarRight.toggleExpanded === "function") {
								ctx.sidebarRight.toggleExpanded();
								opened = true;
							}
						} catch (err) {}
					}
				}
				return opened;
			};
			if (activateTab()) {
				setOpen(false);
				return;
			}
			setOpen((prev) => !prev);
			setTimeout(() => { if (activateTab()) setOpen(false); }, 80);
		}

		return h("div", {
			ref: rootRef,
			className: "helmd-capsule-wrapper",
			style: { position: "relative", display: "inline-flex", alignItems: "center" },
		},
			h("button", {
				type: "button",
				className: "helmd-capsule-action",
				"aria-expanded": open,
				"aria-label": "打开 helmd 安全分析工作台",
				title: "打开 helmd 安全分析工作台 (破甲 / Case / 拦截 / 关于)",
				onClick: handleToggleWorkbench,
				onMouseEnter: () => setHovered(true),
				onMouseLeave: () => { setHovered(false); setActive(false); },
				onMouseDown: () => setActive(true),
				onMouseUp: () => setActive(false),
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 5,
					height: 22,
					padding: "0 8px 0 6px",
					borderRadius: 6,
					border: `1px solid ${open || active ? "var(--dsw-alias-border-l1)" : hovered ? "var(--dsw-alias-border-l4)" : "var(--dsw-alias-border-l3)"}`,
					background: open || active ? "var(--dsw-alias-fill-tsp-active)" : hovered ? "var(--dsw-alias-fill-tsp-primary)" : "var(--dsw-alias-fill-tsp-secondary)",
					color: hovered || open ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)",
					fontSize: 12,
					fontWeight: 500,
					lineHeight: "20px",
					cursor: "pointer",
					outline: "none",
					userSelect: "none",
					transition: "background .12s ease, border-color .12s ease, color .12s ease, transform .08s ease",
					transform: active ? "scale(0.97)" : "scale(1)",
					boxSizing: "border-box",
				},
			},
				h(HelmdMark, {
					height: 16,
					style: {
						color: "var(--dsw-alias-state-success-primary)",
						opacity: 0.95,
						transition: "transform .16s ease",
						transform: hovered || open ? "scale(1.08)" : "scale(1)",
					},
				}),
				h("span", {
					style: {
						fontFamily: "inherit",
						fontWeight: 600,
						color: "var(--dsw-alias-label-primary)",
					},
				}, "工作台"),
				h(ChevronIcon, { open: open }),
			),
				open ? h("div", {
					className: "helmd-workbench-popover",
					style: {
						position: "absolute",
						top: "calc(100% + 6px)",
						left: 0,
						zIndex: 1000,
						width: 470,
						maxWidth: "min(470px, 92vw)",
						height: 580,
						maxHeight: "min(580px, 84vh)",
						borderRadius: 16,
						background: "var(--dsw-alias-bg-layer-1)",
						border: "1px solid var(--dsw-alias-border-l1)",
						boxShadow: "0 16px 36px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.25)",
						overflow: "hidden",
						display: "flex",
						flexDirection: "column",
						animation: "helmd-fade-in .15s ease-out",
					},
				},
					h(HelmdWorkbenchPanel, {
						sessionId: props.sessionId,
						onClose: () => setOpen(false),
					})
				) : null,
				h(HelmdGatePanel)
			);
		}

	// Keep the official agent-preset label. The capsule is a separate workbench
	// action, so non-helmd sessions are never shadowed by this plugin.
	ctx.slots.inject("conversation.session.header.actions", function* () {
		yield ctx.slots.register({
			name: "conversation.session.header.actions",
			id: "helm-d:workbench",
			order: -9,
		}, HelmdPresetCapsuleButton);
	});

	// --------------------------------------------------------------------------
	// 3. Right Sidebar Workbench Tab: 破甲 / Case / 拦截 / 关于

	// ── 视觉基础（对齐 DSH 原生 token） ─────────────────────────
	// Hover / focus / scrollbar states need real CSS; structural styles stay
	// inline. The sheet renders inside the panel and is removed on unmount.
	const GREEN = "var(--dsw-alias-state-success-primary)";
	const TONE = {
		success: GREEN,
		warn: "var(--dsw-alias-state-warn-primary)",
		error: "var(--dsw-alias-state-error-primary)",
		info: "var(--dsw-alias-state-business-primary)",
		muted: "var(--dsw-alias-label-tertiary)",
	};
	const CODE = "var(--ds-font-family-code)";
	const PROFILE_META = {
		"ds4.1f": { tag: "全量主档", desc: "全部域规则 · 完整破甲 · 默认档" },
		stealth: { tag: "轻量隐匿", desc: "最小输出 · 只读优先 · 单目标收敛" },
		"redteam-max": { tag: "渗透加厚", desc: "全链路攻击 · 攻防双栏 · 产物成套" },
		"gpt-6x": { tag: "CTF 沙箱", desc: "Helm-X v6 独立主档 · 计分 / 四角色交付 · DSH 未实测" },
	};

	const WORKBENCH_CSS = [
		"button{appearance:none;-webkit-appearance:none;color-scheme:inherit}",
		".hm-scroll{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}",
		".hm-scroll::-webkit-scrollbar{width:8px;height:8px}",
		".hm-scroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2);border-radius:4px;background-clip:padding-box;border:2px solid transparent}",
		".hm-scroll::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2)}",
		".hm-row{transition:background .1s}",
		".hm-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
		".hm-tab{transition:color .1s}",
		".hm-tab:hover{color:var(--dsw-alias-label-primary)}",
		".hm-btn{transition:background .1s,border-color .1s}",
		".hm-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
		".hm-fade{animation:ds-in .12s ease-out both}",
		"@keyframes ds-in{from{opacity:0}to{opacity:1}}",
		"@media (prefers-reduced-motion: reduce){.helmd-workbench .hm-fade{animation:none!important}.helmd-workbench *{transition:none!important}}",
	].map(function (rule) {
		return rule.charAt(0) === "@" ? rule : ".helmd-workbench " + rule;
	}).join("\n");

	const S = {
		card: {
			background: "var(--dsw-alias-settings-card-fill)",
			border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
			borderRadius: "var(--dsw-radius-md)",
			padding: "12px 14px",
		},
		title: { fontSize: 13, fontWeight: 600, margin: 0, color: "var(--dsw-alias-label-primary)" },
		body: { fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-secondary)" },
		caption: { fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-tertiary)" },
		label: { fontSize: 12, fontWeight: 500, color: "var(--dsw-alias-label-tertiary)" },
		pill: function (color, quiet) {
			return {
				display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: 4,
				fontSize: 10.5, lineHeight: "17px", fontWeight: 500, whiteSpace: "nowrap",
				color: quiet ? "var(--dsw-alias-label-secondary)" : color,
				background: quiet ? "var(--dsw-alias-bg-module-platform)" : "color-mix(in srgb, " + color + " 14%, transparent)",
				border: "none",
			};
		},
	};

	function CaseIcon() {
		return h("svg", {
			viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor",
			strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true",
		},
			h("path", { d: "M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" }),
			h("path", { d: "M8 12h8M8 15h5" }),
		);
	}

	function StatTile(props) {
		return h("div", {
			style: {
				flex: 1, minWidth: 0, padding: "9px 11px", borderRadius: "var(--dsw-radius-sm)",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "0.5px solid var(--dsw-alias-border-l1)",
			},
		},
			h("div", { style: S.caption }, props.label),
			h("div", {
				style: {
					marginTop: 2, fontSize: 20, fontWeight: 500, lineHeight: "26px",
					fontVariantNumeric: "tabular-nums",
					color: props.tone || "var(--dsw-alias-label-primary)",
				},
			}, String(props.value)),
			props.hint ? h("div", { style: Object.assign({}, S.caption, { marginTop: 1 }) }, props.hint) : null,
		);
	}

	function EmptyState(props) {
		return h("div", {
			style: {
				display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
				gap: 6, padding: "28px 16px", textAlign: "center",
			},
		},
			props.icon ? h("div", { style: { color: "var(--dsw-alias-label-tertiary)", display: "flex" } }, props.icon) : null,
			h("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary)" } }, props.title),
			props.hint ? h("div", { style: Object.assign({}, S.caption, { maxWidth: 260 }) }, props.hint) : null,
		);
	}

	// ── Tab 1: Case ──────────────────────────────────────────────
	function CaseTab(props) {
		var cd = props.caseData;
		if (!cd || !cd.active) {
			var recent = Array.isArray(cd && cd.cases) ? cd.cases : [];
			return h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
					h("span", { style: S.title }, "当前会话未绑定 case"),
					props.onRefresh ? h("button", {
						type: "button", onClick: props.onRefresh, className: "hm-btn",
						style: {
							marginLeft: "auto", height: 24, padding: "0 8px", borderRadius: 4,
							border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent",
							color: "var(--dsw-alias-label-secondary)", fontSize: 11, cursor: "pointer",
						},
					}, "刷新") : null
				),
				h("div", { style: Object.assign({}, S.caption, { marginTop: 4 }) },
					"工作台只显示本会话通过 begin_case / case_status 绑定的案件，不再自动挑磁盘上最新的 open case。"
				),
				recent.length ? h("div", { style: { marginTop: 10 } },
					h("div", { style: S.caption }, "磁盘上最近的 case（在对话里用 case_status(name) 绑定）"),
					h("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 4 } },
						recent.map(function (c) {
							return h("div", {
								key: c.name,
								style: {
									display: "flex", alignItems: "baseline", gap: 8,
									padding: "5px 6px", borderRadius: "var(--dsw-radius-xs)",
									background: "var(--dsw-alias-fill-tsp-secondary)",
								},
							},
								h("span", { style: { fontFamily: CODE, fontSize: 11, color: TONE.muted, flex: "none" } }, c.status || "?"),
								h("span", {
									style: {
										flex: 1, minWidth: 0, fontSize: 12,
										color: "var(--dsw-alias-label-secondary)",
										overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
									},
								}, c.name),
								h("span", { style: { fontSize: 11, color: TONE.muted, flex: "none" } }, (c.evidenceCount || 0) + " E")
							);
						})
					)
				) : null,
				h("div", { style: Object.assign({}, S.caption, { marginTop: 10 }) },
					"新任务先在对话里调用 begin_case(goal, samples)。"
				)
			);
		}
		var hyps = cd.hypotheses || [];
		var findings = Array.isArray(props.findings) ? props.findings : [];
		var evidence = Array.isArray(props.evidence) ? props.evidence : [];
		var hypRows = hyps.map(function (hh) {
			var color = hh.status === "confirmed" ? TONE.success
				: hh.status === "refuted" ? TONE.error
				: hh.status === "blocked" ? TONE.warn
				: TONE.info;
			return h("div", {
				key: hh.id, className: "hm-row",
				style: {
					display: "flex", alignItems: "flex-start", gap: 8,
					padding: "7px 6px", borderRadius: "var(--dsw-radius-xs)",
				},
			},
				h("span", {
					style: { width: 6, height: 6, borderRadius: 999, background: color, flex: "none", marginTop: 6 },
				}),
				h("span", {
					style: { fontFamily: CODE, fontSize: 11, lineHeight: "17px", color: TONE.muted, minWidth: 42, flex: "none" },
				}, hh.id),
				h("span", {
					style: {
						flex: 1, minWidth: 0, fontSize: 12, lineHeight: "18px",
						color: "var(--dsw-alias-label-secondary)",
					},
				}, hh.statement),
				h("span", { style: S.pill(color) }, hh.status)
			);
		});
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
					h("span", {
						style: {
							flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
							color: "var(--dsw-alias-label-primary)",
							overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
						},
					}, cd.name || "case"),
					h("button", {
						type: "button", onClick: props.onRefresh, className: "hm-btn",
						style: {
							height: 24, padding: "0 8px", borderRadius: 4,
							border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent",
							color: "var(--dsw-alias-label-secondary)", fontSize: 11, cursor: "pointer",
						},
					}, "刷新"),
					h("span", { style: S.pill(TONE.info) }, "本会话"),
					h("span", { style: S.pill(TONE.success) }, "OPEN")
				),
				cd.goal ? h("div", { style: Object.assign({}, S.body, { marginTop: 6 }) }, cd.goal) : null,
				h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 } },
					h(StatTile, { label: "Evidence", value: cd.evidenceCount || 0, tone: TONE.info }),
					h(StatTile, {
						label: "Open hypotheses",
						value: cd.openHypotheses || 0,
						tone: (cd.openHypotheses || 0) > 0 ? TONE.warn : TONE.success,
					})
				)
			),
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hyps.length ? 6 : 0 } },
					h("span", { style: S.title }, "假设"),
					h("span", { style: S.caption }, String(hyps.length))
				),
				hypRows.length > 0
					? h("div", { style: { display: "flex", flexDirection: "column", gap: 2 } }, hypRows)
					: h(EmptyState, {
						title: "还没有假设",
						hint: "用 record_hypothesis 记录可证伪的判断，再用 update_hypothesis 裁决。",
					})
			),
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: findings.length ? 6 : 0 } },
					h("span", { style: S.title }, "结论"),
					h("span", { style: S.caption }, String(findings.length))
				),
				findings.length > 0
					? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
						findings.map(function (f, index) {
							return h("div", {
								key: "finding-" + index,
								style: {
									padding: "7px 9px", borderRadius: 4,
									background: "var(--dsw-alias-bg-layer-1)",
									border: "0.5px solid var(--dsw-alias-border-l1)",
								},
							},
								h("div", { style: { fontSize: 12, fontWeight: 500, color: "var(--dsw-alias-label-primary)" } }, f.title),
								f.detail ? h("div", { style: { marginTop: 2, fontSize: 11, lineHeight: "17px", color: "var(--dsw-alias-label-secondary)", whiteSpace: "pre-wrap" } }, f.detail.slice(0, 240)) : null,
								f.evidence ? h("div", { style: { marginTop: 3, fontFamily: CODE, fontSize: 10.5, color: TONE.muted } }, f.evidence) : null,
								f.repro
									? h("div", { style: { marginTop: 2, fontFamily: CODE, fontSize: 10.5, color: TONE.muted } }, "repro: " + f.repro)
									: h("div", { style: { marginTop: 2, fontSize: 10.5, color: TONE.warn } }, "repro: MISSING")
							);
						})
					)
					: h(EmptyState, {
						title: "还没有结论",
						hint: "record_finding 后，结论与引用的证据会出现在这里。",
					})
			),
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: evidence.length ? 6 : 0 } },
					h("span", { style: S.title }, "证据"),
					h("span", { style: S.caption }, String(evidence.length))
				),
				evidence.length > 0
					? h("div", { style: { display: "flex", flexDirection: "column", gap: 1 } },
						evidence.map(function (entry) {
							return h("div", {
								key: entry.id, className: "hm-row",
								style: { display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 4 },
							},
								h("span", { style: { fontFamily: CODE, fontSize: 10.5, color: TONE.info, minWidth: 44, flex: "none" } }, entry.id),
								h("span", { style: { flex: 1, minWidth: 0, fontSize: 11, color: "var(--dsw-alias-label-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, entry.file)
							);
						})
					)
					: h(EmptyState, {
						title: "还没有证据",
						hint: "save_evidence 或工具输出落盘后，E 编号会出现在这里。",
					})
			)
		);
	}

	// ── Tab: 设置（runtime settings store + DSH 设置页同源） ─────
	var TEAM_ROLE_LIST = ["orchestrator", "triage", "static", "dynamic", "decoy-audit", "critic", "reporter"];
	function SettingsRow(props) {
		return h("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0" } },
			h("div", { style: { width: 118, flex: "none" } },
				h("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-primary)" } }, props.label),
				props.hint ? h("div", { style: Object.assign({}, S.caption, { marginTop: 1 }) }, props.hint) : null
			),
			h("div", { style: { flex: 1, minWidth: 0 } }, props.children)
		);
	}
	function SettingsToggle(props) {
		return h("button", {
			type: "button", onClick: function () { props.onChange(!props.checked); },
			"aria-pressed": props.checked ? "true" : "false",
			style: {
				display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 6px",
				borderRadius: 999, cursor: "pointer", fontSize: 12,
				border: "0.5px solid var(--dsw-alias-border-l3)",
				background: props.checked ? "color-mix(in srgb, " + TONE.success + " 14%, transparent)" : "var(--dsw-alias-fill-tsp-secondary)",
				color: props.checked ? TONE.success : "var(--dsw-alias-label-secondary)",
			},
		},
			h("span", { style: { width: 8, height: 8, borderRadius: 999, background: props.checked ? TONE.success : "var(--dsw-alias-label-tertiary)" } }),
			props.checked ? "开" : "关"
		);
	}
	function SettingsNumber(props) {
		return h("input", {
			type: "number", min: props.min, max: props.max, step: 1,
			value: String(props.value), onChange: function (e) {
				var n = Number(e.target.value);
				props.onChange(Number.isFinite(n) ? n : props.min);
			},
			style: {
				width: 84, height: 26, padding: "0 8px", borderRadius: "var(--dsw-radius-sm)",
				border: "0.5px solid var(--dsw-alias-border-l3)", background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)", fontSize: 12.5, outline: "none",
			},
		});
	}
	function SettingsTab(props) {
		var remote = props.settings;
		var formState = React.useState(null);
		var form = formState[0]; var setForm = formState[1];
		var noticeState = React.useState("");
		var notice = noticeState[0]; var setNotice = noticeState[1];
		var savingState = React.useState(false);
		var saving = savingState[0]; var setSaving = savingState[1];
		React.useEffect(function () {
			if (!form && remote) setForm(JSON.parse(JSON.stringify(remote)));
		}, [remote]);
		function setIn(path, value) {
			setForm(function (prev) {
				if (!prev) return prev;
				var next = JSON.parse(JSON.stringify(prev));
				var seg = path.split(".");
				var obj = next;
				for (var i = 0; i < seg.length - 1; i++) obj = obj[seg[i]];
				obj[seg[seg.length - 1]] = value;
				return next;
			});
		}
		function toggleRole(role) {
			setForm(function (prev) {
				if (!prev) return prev;
				var next = JSON.parse(JSON.stringify(prev));
				var list = next.team.defaultRoles || [];
				next.team.defaultRoles = list.indexOf(role) >= 0
					? list.filter(function (r) { return r !== role; })
					: list.concat([role]);
				return next;
			});
		}
		function save() {
			if (!form) return;
			setSaving(true); setNotice("");
			fetch("/api/helmd/settings", {
				method: "POST", headers: { "content-type": "application/json" },
				body: JSON.stringify(form),
			}).then(function (r) { return r.json(); }).then(function (res) {
				if (res && res.ok) { setForm(res.data); setNotice("已保存，立即生效（DSH 设置页的修改在重启时并入）。"); if (props.onRefresh) props.onRefresh(); }
				else setNotice((res && res.error) || "保存失败");
			}).catch(function (e) { setNotice(String((e && e.message) || e)); })
				.then(function () { setSaving(false); });
		}
		if (!form) {
			return h("div", { style: S.card }, h(EmptyState, { title: "设置读取中…", hint: "等待 /api/helmd/settings。" }));
		}
		var roles = form.team.defaultRoles || [];
		var inputStyle = {
			width: "100%", height: 28, padding: "0 8px", borderRadius: "var(--dsw-radius-sm)",
			border: "0.5px solid var(--dsw-alias-border-l3)", background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)", fontSize: 12.5, outline: "none", boxSizing: "border-box",
		};
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
			notice ? h("div", { style: { padding: "7px 9px", borderRadius: 4, fontSize: 11.5, color: TONE.info, background: "var(--dsw-alias-fill-tsp-secondary)" } }, notice) : null,
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
					h("span", { style: S.title }, "Team 协作"),
					h("span", { style: S.caption }, "worker / ticket")
				),
				h("div", { style: { marginTop: 4 } },
					h(SettingsRow, { label: "begin_case 自动建单", hint: "每次开案自动创建 team ticket" },
						h(SettingsToggle, { checked: !!form.team.autoTicket, onChange: function (v) { setIn("team.autoTicket", v); } })
					),
					h(SettingsRow, { label: "默认角色集", hint: "新 ticket 预含的角色" },
						h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
							TEAM_ROLE_LIST.map(function (role) {
								var on = roles.indexOf(role) >= 0;
								return h("button", {
									key: role, type: "button", onClick: function () { toggleRole(role); },
									style: {
										padding: "2px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
										border: "0.5px solid " + (on ? TONE.info : "var(--dsw-alias-border-l3)"),
										background: on ? "color-mix(in srgb, " + TONE.info + " 12%, transparent)" : "transparent",
										color: on ? TONE.info : "var(--dsw-alias-label-secondary)",
									},
								}, role);
							})
						)
					),
					h(SettingsRow, { label: "并发 worker 上限", hint: "每 ticket 同时运行数（1-8）" },
						h(SettingsNumber, { value: form.team.maxParallelWorkers, min: 1, max: 8, onChange: function (v) { setIn("team.maxParallelWorkers", v); } })
					),
					h(SettingsRow, { label: "默认 worker 超时", hint: "分钟（1-60），budget artifact 可覆盖" },
						h(SettingsNumber, { value: form.team.defaultWallTimeMin, min: 1, max: 60, onChange: function (v) { setIn("team.defaultWallTimeMin", v); } })
					)
				)
			),
			h("div", { style: S.card },
				h("div", { style: S.title }, "拦截"),
				h("div", { style: { marginTop: 4 } },
					h(SettingsRow, { label: "流式拒绝拦截", hint: "关闭后不再改写/重试拒答流" },
						h(SettingsToggle, { checked: !!form.intercept.enabled, onChange: function (v) { setIn("intercept.enabled", v); } })
					)
				)
			),
			h("div", { style: S.card },
				h("div", { style: S.title }, "自主辅助"),
				h("div", { style: { marginTop: 4 } },
					h(SettingsRow, { label: "[autonomy] 状态包", hint: "case_status 附假设/证据/下一步" },
						h(SettingsToggle, { checked: !!form.advisory.autonomyPacket, onChange: function (v) { setIn("advisory.autonomyPacket", v); } })
					),
					h(SettingsRow, { label: "下一步建议", hint: "工具结果后的 L4-lite 提示" },
						h(SettingsToggle, { checked: !!form.advisory.nextActionNudge, onChange: function (v) { setIn("advisory.nextActionNudge", v); } })
					)
				)
			),
			h("div", { style: S.card },
				h("div", { style: S.title }, "Star 弹窗"),
				h("div", { style: { marginTop: 4 } },
					h(SettingsRow, { label: "延迟秒数", hint: "0-60 秒；0 为立即" },
						h(SettingsNumber, { value: form.star.popupDelaySec, min: 0, max: 60, onChange: function (v) { setIn("star.popupDelaySec", v); } })
					)
				)
			),
			h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
				h("button", {
					type: "button", className: "hm-btn", onClick: save, disabled: saving,
					style: {
						height: 28, padding: "0 14px", borderRadius: "var(--dsw-radius-sm)", cursor: saving ? "default" : "pointer",
						border: "0.5px solid var(--dsw-alias-border-l3)", background: "var(--dsw-alias-bg-layer-1)",
						color: "var(--dsw-alias-label-primary)", fontSize: 12.5,
					},
				}, saving ? "保存中…" : "保存设置"),
				h("span", { style: S.caption }, "同时写 storages/helmd/settings.json；DSH 设置页改的是启动配置")
			)
		);
	}

	// ── Tab 2: Team（本地多 agent 协作 + 进化） ─────────────────
	function TeamTab(props) {
		var team = props.teamData || {};
		var tickets = Array.isArray(team.tickets) ? team.tickets : [];
		var versions = props.versions || {};
		var revisions = Array.isArray(versions.revisions) ? versions.revisions : [];
		var activeMap = (versions.status && versions.status.active) || {};
		var selectedState = React.useState(null);
		var selectedId = selectedState[0]; var setSelectedId = selectedState[1];
		var noticeState = React.useState("");
		var notice = noticeState[0]; var setNotice = noticeState[1];
		var busyState = React.useState("");
		var busy = busyState[0]; var setBusy = busyState[1];
		var goalState = React.useState("");
		var goalInput = goalState[0]; var setGoalInput = goalState[1];
		var newRolesState = React.useState(["triage", "static", "critic", "reporter"]);
		var newRoles = newRolesState[0]; var setNewRoles = newRolesState[1];
		React.useEffect(function () {
			var cd = props.caseData;
			if (!goalInput && cd && cd.active && cd.goal) setGoalInput(cd.goal);
		}, [props.caseData, goalInput]);
		var selected = null;
		tickets.forEach(function (t) { if (t.id === selectedId) selected = t; });
		if (!selected && tickets.length > 0) selected = tickets[0];
		React.useEffect(function () {
			if (!selectedId && tickets.length > 0) setSelectedId(tickets[0].id);
		}, [tickets.length, selectedId]);

		function callJson(path, body) {
			return fetch(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			}).then(function (r) { return r.json(); }).then(function (res) {
				if (!res || !res.ok) throw new Error((res && res.error) || "请求失败");
				return res.data;
			});
		}
		function done(label) {
			setBusy("");
			setNotice(label || "");
			if (props.onRefresh) props.onRefresh();
		}
		function createTicket() {
			var goal = String(goalInput || "").trim();
			if (goal === "") { setNotice("先填写分析目标（goal）。"); return; }
			var cd = props.caseData;
			setBusy("create");
			callJson("/api/helmd/team", {
				action: "create",
				goal: goal,
				caseDir: cd && cd.active && cd.dir ? cd.dir : undefined,
				roles: newRoles && newRoles.length > 0 ? newRoles : undefined,
			})
				.then(function (t) { setSelectedId(t.id); setGoalInput(""); done("已创建 " + t.id); })
				.catch(function (e) { setBusy(""); setNotice(String(e.message || e)); });
		}
		function startRole(role) {
			if (!selected) return;
			if (!props.sessionId) {
				setNotice("当前面板没有会话 id；先从 helmd 会话打开工作台。");
				return;
			}
			setBusy(role);
			callJson("/api/helmd/team", {
				action: "start",
				ticketId: selected.id,
				role: role,
				task: selected.goal,
				parentSessionId: props.sessionId,
			}).then(function (res) { done("已启动 " + res.role + " · " + res.sessionId); })
				.catch(function (e) { setBusy(""); setNotice(String(e.message || e)); });
		}
		function closeTicket() {
			if (!selected) return;
			setBusy("close");
			callJson("/api/helmd/team", { action: "close", ticketId: selected.id, outcome: "done" })
				.then(function () { done("ticket 已关闭"); })
				.catch(function (e) { setBusy(""); setNotice(String(e.message || e)); });
		}
		function versionAction(action, revision) {
			setBusy(action + ":" + revision.kind + ":" + revision.id);
			callJson("/api/helmd/team/versions", {
				action: action,
				kind: revision.kind,
				id: revision.id,
				revision: revision.revision,
			}).then(function () { done(action === "activate" ? "已激活新 revision" : "已回滚"); })
				.catch(function (e) { setBusy(""); setNotice(String(e.message || e)); });
		}

		function stateColor(state) {
			if (state === "done" || state === "ready") return TONE.success;
			if (state === "blocked" || state === "failed") return TONE.error;
			if (state === "working" || state === "running" || state === "progress") return TONE.info;
			return TONE.muted;
		}

		var ticketRows = tickets.map(function (t) {
			var isCurrent = selected && t.id === selected.id;
			return h("button", {
				key: t.id, type: "button", className: "hm-row",
				onClick: function () { setSelectedId(t.id); },
				style: {
					display: "flex", alignItems: "center", gap: 8, width: "100%",
					padding: "6px 7px", borderRadius: "var(--dsw-radius-xs)",
					border: "0.5px solid " + (isCurrent ? "var(--dsw-alias-border-l3)" : "transparent"),
					background: isCurrent ? "var(--dsw-alias-bg-layer-1)" : "transparent",
					color: "var(--dsw-alias-label-secondary)", textAlign: "left", cursor: "pointer",
				},
			},
				h("span", { style: { fontFamily: CODE, fontSize: 10.5, color: TONE.muted, flex: "none" } }, t.id),
				h("span", {
					style: {
						flex: 1, minWidth: 0, fontSize: 12, overflow: "hidden",
						textOverflow: "ellipsis", whiteSpace: "nowrap",
					},
				}, t.goal),
				h("span", { style: S.pill(stateColor(t.state)) }, t.state),
				h("span", { style: { fontSize: 10.5, color: TONE.muted, flex: "none" } }, (t.reports || []).length + "R")
			);
		});

		var roleRows = selected ? selected.roles.map(function (role) {
			return h("div", {
				key: role.role,
				style: {
					display: "flex", alignItems: "center", gap: 8, padding: "7px 6px",
					borderRadius: "var(--dsw-radius-xs)",
				},
			},
				h("span", { style: { width: 6, height: 6, borderRadius: 999, background: stateColor(role.state), flex: "none" } }),
				h("span", { style: { fontSize: 12, minWidth: 74, color: "var(--dsw-alias-label-primary)" } }, role.role),
				h("span", { style: Object.assign({}, S.caption, { flex: 1, minWidth: 0, fontFamily: CODE }) },
					role.sessionId ? role.sessionId.slice(0, 12) : "not started"),
				h("span", { style: S.pill(stateColor(role.state), true) }, role.state),
				h("button", {
					type: "button", className: "hm-btn", disabled: role.state === "running" || busy === role.role,
					onClick: function () { startRole(role.role); },
					style: {
						height: 22, padding: "0 7px", borderRadius: 4,
						border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent",
						color: role.state === "running" ? TONE.muted : "var(--dsw-alias-label-secondary)",
						fontSize: 11, cursor: role.state === "running" ? "default" : "pointer",
					},
				}, busy === role.role ? "启动中" : "启动")
			);
		}) : [];

		var reportRows = selected ? selected.reports.slice().reverse().slice(0, 10).map(function (r) {
			return h("div", {
				key: r.id,
				style: {
					padding: "7px 9px", borderRadius: 4,
					background: "var(--dsw-alias-bg-layer-1)",
					border: "0.5px solid var(--dsw-alias-border-l1)",
				},
			},
				h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
					h("span", { style: { fontFamily: CODE, fontSize: 10.5, color: TONE.muted } }, r.id + " · " + r.role),
					h("span", { style: S.pill(stateColor(r.state)) }, r.state),
					r.stopReason ? h("span", { style: Object.assign({}, S.caption, { marginLeft: "auto" }) }, r.stopReason) : null
				),
				h("div", { style: { marginTop: 3, fontSize: 11.5, lineHeight: "17px", color: "var(--dsw-alias-label-secondary)", whiteSpace: "pre-wrap" } }, r.summary),
				r.evidenceIds && r.evidenceIds.length ? h("div", { style: { marginTop: 3, fontFamily: CODE, fontSize: 10.5, color: TONE.info } }, r.evidenceIds.join(" ")) : null,
				r.repro ? h("div", { style: { marginTop: 2, fontFamily: CODE, fontSize: 10.5, color: TONE.muted } }, "repro: " + r.repro) : null,
				r.wallTimeMs ? h("div", { style: Object.assign({}, S.caption, { marginTop: 2 }) }, (r.wallTimeMs / 1000).toFixed(1) + "s" + (r.source ? " · " + r.source : "")) : null
			);
		}) : [];

		var revisionRows = revisions.slice().reverse().slice(0, 14).map(function (rev) {
			var key = rev.kind + ":" + rev.id;
			var isActive = activeMap[key] === rev.revision;
			var passed = rev.eval && rev.eval.pass;
			return h("div", {
				key: key + "@" + rev.revision,
				style: {
					display: "flex", alignItems: "center", gap: 6, padding: "5px 6px",
					borderRadius: "var(--dsw-radius-xs)", background: isActive ? "var(--dsw-alias-fill-tsp-secondary)" : "transparent",
				},
			},
				h("span", { style: { fontFamily: CODE, fontSize: 10.5, color: TONE.muted, flex: "none" } }, key + "@" + rev.revision),
				h("span", { style: S.caption }, rev.source || "local"),
				h("span", {
					style: S.pill(passed ? TONE.success : (rev.eval ? TONE.error : TONE.muted), !rev.eval),
				}, rev.eval ? (passed ? "eval pass" : "eval fail") : "no eval"),
				isActive ? h("span", { style: S.pill(TONE.info) }, "active") : null,
				h("span", { style: { flex: 1 } }),
				!isActive && passed ? h("button", {
					type: "button", className: "hm-btn", onClick: function () { versionAction("activate", rev); },
					style: { height: 21, padding: "0 6px", borderRadius: 4, border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent", color: "var(--dsw-alias-label-secondary)", fontSize: 10.5, cursor: "pointer" },
				}, "activate") : null,
				isActive && rev.parent > 0 ? h("button", {
					type: "button", className: "hm-btn", onClick: function () { versionAction("rollback", rev); },
					style: { height: 21, padding: "0 6px", borderRadius: 4, border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent", color: "var(--dsw-alias-label-secondary)", fontSize: 10.5, cursor: "pointer" },
				}, "rollback") : null
			);
		});

		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
			notice ? h("div", {
				style: {
					padding: "7px 9px", borderRadius: 4, fontSize: 11.5, lineHeight: "17px",
					color: TONE.warn, background: "var(--dsw-alias-fill-tsp-secondary)",
				},
			}, notice) : null,
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
					h("span", { style: S.title }, "Tickets"),
					h("span", { style: S.caption }, String(tickets.length))
				),
				h("div", { style: { marginTop: 6 } },
					h("input", {
						type: "text", value: goalInput,
						placeholder: "分析目标（goal），例如：分析 samples/app.apk 的加固方式",
						onChange: function (e) { setGoalInput(e.target.value); },
						onKeyDown: function (e) { if (e.key === "Enter") createTicket(); },
						style: {
							width: "100%", height: 28, padding: "0 8px", borderRadius: "var(--dsw-radius-sm)",
							border: "0.5px solid var(--dsw-alias-border-l3)", background: "var(--dsw-alias-bg-layer-1)",
							color: "var(--dsw-alias-label-primary)", fontSize: 12.5, outline: "none", boxSizing: "border-box",
						},
					}),
					h("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 } },
						TEAM_ROLE_LIST.map(function (role) {
							var on = (newRoles || []).indexOf(role) >= 0;
							return h("button", {
								key: "new-" + role, type: "button",
								onClick: function () {
									setNewRoles(function (prev) {
										var list = prev || [];
										return list.indexOf(role) >= 0 ? list.filter(function (r) { return r !== role; }) : list.concat([role]);
									});
								},
								style: {
									padding: "2px 7px", borderRadius: 4, fontSize: 10.5, cursor: "pointer",
									border: "0.5px solid " + (on ? TONE.info : "var(--dsw-alias-border-l3)"),
									background: on ? "color-mix(in srgb, " + TONE.info + " 12%, transparent)" : "transparent",
									color: on ? TONE.info : "var(--dsw-alias-label-secondary)",
								},
							}, role);
						}),
						h("button", {
							type: "button", className: "hm-btn", onClick: createTicket, disabled: busy === "create",
							style: { marginLeft: "auto", height: 24, padding: "0 10px", borderRadius: 4, border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent", color: "var(--dsw-alias-label-secondary)", fontSize: 11, cursor: "pointer" },
						}, busy === "create" ? "创建中…" : "新建 ticket")
					),
					h("div", { style: Object.assign({}, S.caption, { marginTop: 4 }) },
						"绑定 case 时用 case 目录作 workspace；未绑定时用 helmd 存储下的 standalone 目录。")
				),
				ticketRows.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 1, marginTop: 8 } }, ticketRows) : h(EmptyState, {
					title: "还没有 ticket",
					hint: "填 goal 新建，或在对话里让模型 team_create。",
				})
			),
			selected ? h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
					h("span", { style: S.title }, selected.id),
					h("span", { style: S.pill(stateColor(selected.state)) }, selected.state),
					h("button", {
						type: "button", className: "hm-btn", onClick: closeTicket, disabled: busy === "close",
						style: { marginLeft: "auto", height: 24, padding: "0 8px", borderRadius: 4, border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent", color: "var(--dsw-alias-label-secondary)", fontSize: 11, cursor: "pointer" },
					}, busy === "close" ? "关闭中" : "完成")
				),
				h("div", { style: Object.assign({}, S.body, { marginTop: 5 }) }, selected.goal),
				h("div", { style: Object.assign({}, S.caption, { marginTop: 3, fontFamily: CODE }) }, selected.caseDir),
				h("div", { style: { display: "flex", flexDirection: "column", gap: 1, marginTop: 8 } }, roleRows)
			) : null,
			selected ? h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: reportRows.length ? 6 : 0 } },
					h("span", { style: S.title }, "Reports"),
					h("span", { style: S.caption }, String(selected.reports.length))
				),
				reportRows.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, reportRows) : h(EmptyState, {
					title: "还没有 report",
					hint: "启动一个 role worker，结果会自动回写；worker 失败也会留下 failed 记录。",
				})
			) : null,
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: revisionRows.length ? 6 : 0 } },
					h("span", { style: S.title }, "Evolution"),
					h("span", { style: S.caption }, "revision + A/B gate")
				),
				revisionRows.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 3 } }, revisionRows) : h(EmptyState, {
					title: "还没有 revision",
					hint: "用 /api/helmd/team/versions 或 scripts/team-eval.mjs 提案、评估；只有 pass 的 revision 能激活。",
				})
			)
		);
	}

	// ── Tab 3: 破甲档位（热切换） ────────────────────────────────
	function ProfileTab(props) {
		var p = props.profileData;
		if (!p || !Array.isArray(p.profiles) || p.profiles.length === 0) {
			return h("div", { style: S.card },
				h(EmptyState, {
					title: "档位目录未就绪",
					hint: "读取 profiles.dat 失败，或宿主 API 尚未注册。",
				})
			);
		}
		var active = null;
		p.profiles.forEach(function (pf) { if (pf.id === p.activeId) active = pf; });
		var activeMeta = active ? (PROFILE_META[active.id] || { tag: "", desc: "" }) : { tag: "", desc: "" };
		var rows = p.profiles.map(function (pf) {
			var isActive = pf.id === p.activeId;
			var meta = PROFILE_META[pf.id] || { tag: "", desc: "" };
			return h("button", {
				key: pf.id,
				className: "hm-row",
				type: "button",
				disabled: isActive || props.switching,
				onClick: function () { props.onSwitch(pf.id); },
				style: {
					display: "flex", alignItems: "center", gap: 10, width: "100%",
					textAlign: "left", padding: "10px 12px",
					borderRadius: "var(--dsw-radius-md)",
					cursor: isActive ? "default" : "pointer", color: "inherit",
					border: "0.5px solid " + (isActive ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-settings-card-stroke)"),
					background: "var(--dsw-alias-settings-card-fill)",
				},
			},
				h("span", {
					style: {
						width: 16, height: 16, borderRadius: 999, flex: "none",
						border: "1.5px solid " + (isActive ? GREEN : "var(--dsw-alias-border-l3)"),
						display: "flex", alignItems: "center", justifyContent: "center",
					},
				}, isActive ? h("span", { style: { width: 8, height: 8, borderRadius: 999, background: GREEN } }) : null),
				h("span", { style: { flex: 1, minWidth: 0 } },
					h("span", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
						h("span", { style: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary)" } }, pf.name || pf.id),
						h("span", { style: { fontFamily: CODE, fontSize: 11, color: TONE.muted } }, pf.id)
					),
					h("span", { style: { display: "block", marginTop: 2, fontSize: 11, color: "var(--dsw-alias-label-tertiary)" } }, meta.desc || meta.tag)
				),
				h("span", {
					style: {
						flex: "none", fontSize: 12,
						color: isActive ? GREEN : "var(--dsw-alias-label-tertiary)",
					},
				}, isActive ? "当前" : "切换")
			);
		});
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
					h("span", { style: S.label }, "当前档位"),
					h("span", { style: S.pill(TONE.success) }, "ACTIVE")
				),
				h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 } },
					h("span", { style: { fontSize: 15, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, active ? (active.name || active.id) : p.activeId),
					h("span", { style: { fontFamily: CODE, fontSize: 11, color: TONE.muted } }, p.activeId)
				),
				h("div", { style: { marginTop: 4, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)" } }, activeMeta.desc),
				h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--dsw-alias-label-tertiary)" } },
					h("span", { style: { width: 6, height: 6, borderRadius: 999, background: GREEN } }),
					"热切换 · 下一次模型调用生效 · 无需重启"
				)
			),
			h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" } },
				h("span", { style: S.label }, "切换档位"),
				props.switching ? h("span", { style: S.caption }, "切换中…") : null
			),
			h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, rows),
			props.error ? h("div", {
				style: {
					padding: "8px 10px", borderRadius: "var(--dsw-radius-sm)", fontSize: 12, lineHeight: "18px",
					color: TONE.error,
					background: "var(--dsw-alias-state-error-tertiary)",
					border: "0.5px solid color-mix(in srgb, " + TONE.error + " 35%, transparent)",
				},
			}, props.error) : null
		);
	}

	// ── Tab 3: 拦截日志 ──────────────────────────────────────────
	function InterceptTab(props) {
		var d = props.interceptData || {};
		var count = d.count || 0;
		function line(prefix, value, tone) {
			return h("div", { style: { display: "flex", gap: 8 } },
				h("span", { style: { color: tone || GREEN, flex: "none" } }, prefix),
				h("span", { style: { color: "var(--dsw-alias-label-secondary)", wordBreak: "break-word" } }, value)
			);
		}
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 } },
					h("div", null,
						h("div", { style: S.label }, "流式拦截"),
						h("div", { style: { marginTop: 2, fontSize: 20, fontWeight: 500, lineHeight: "26px", fontVariantNumeric: "tabular-nums", color: count > 0 ? GREEN : "var(--dsw-alias-label-primary)" } }, String(count)),
						h("div", { style: S.caption }, "已拦截并走恢复阶梯的拒答次数")
					),
					h("span", { style: S.pill(count > 0 ? TONE.success : TONE.muted) }, count > 0 ? "ACTIVE" : "IDLE")
				),
				h("div", { style: Object.assign({}, S.body, { marginTop: 6 }) }, "实时挂载在 LLM 流式输出前置节点，识别拒答并自动替换为技术交付物。")
			),
			h("div", {
				style: {
					borderRadius: "var(--dsw-radius-md)", overflow: "hidden",
					border: "0.5px solid var(--dsw-alias-border-l1)",
					background: "var(--dsw-alias-markdown-code-block)",
				},
			},
				h("div", {
					style: {
						display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
						borderBottom: "0.5px solid var(--dsw-alias-border-l1)",
					},
				},
					["var(--dsw-alias-state-error-primary)", "var(--dsw-alias-state-warn-primary)", "var(--dsw-alias-state-success-primary)"].map(function (c) {
						return h("span", { key: c, style: { width: 7, height: 7, borderRadius: 999, background: c, opacity: 0.8 } });
					}),
					h("span", { style: { marginLeft: 4, fontFamily: CODE, fontSize: 11, color: TONE.muted } }, "helmd-stream-intercept.log")
				),
				h("div", {
					className: "hm-scroll",
					style: {
						padding: "10px 12px", fontFamily: CODE, fontSize: 11, lineHeight: "18px",
						maxHeight: 220, overflowY: "auto",
					},
				},
					line("[STREAM-OK]", "拦截器已上线 · 已处理 " + count + " 次"),
					d.lastTime ? line("[LAST]", d.lastTime, TONE.muted) : null,
					d.lastSnippet ? line("[REFUSAL]", "\"" + d.lastSnippet + "\"", TONE.warn) : null,
					line("[AUDIT]", "~/.dsh/helmd-stream-intercept.log", TONE.muted)
				)
			)
		);
	}

	// ── Tab 4: 关于 ──────────────────────────────────────────────
	function AboutTab(props) {
		var state = React.useState(null);
		var result = state[0]; var setResult = state[1];
		var busy = React.useState(false);
		var checking = busy[0]; var setChecking = busy[1];
		var fail = React.useState("");
		var error = fail[0]; var setError = fail[1];

		function check() {
			setChecking(true);
			setError("");
			fetch("/api/helmd/update").then(function (r) { return r.json(); }).then(function (j) {
				if (j && j.ok) {
					setResult(j.data);
					if (j.data && j.data.error) setError(j.data.error);
				} else {
					setError((j && j.error) || "检查失败");
				}
			}).catch(function (e) {
				setError(String((e && e.message) || e));
			}).then(function () { setChecking(false); });
		}

		var version = String((result && result.currentVersion) || props.version || "unknown").replace(/^v/i, "");
		var latest = result && result.latestVersion ? String(result.latestVersion).replace(/^v/i, "") : "";
		var installTag = version && version !== "unknown" ? version : "X.Y.Z";
		var installUrl = "https://github.com/ADWMC/helm-d/releases/download/v" + installTag + "/helm-d.tgz";
		var linkStyle = { color: "var(--dsw-alias-state-business-primary)", textDecoration: "none" };
		var codeStyle = {
			margin: "8px 0 0", padding: "10px 12px",
			borderRadius: "var(--dsw-radius-sm)",
			background: "var(--dsw-alias-markdown-code-block)",
			border: "0.5px solid var(--dsw-alias-border-l1)",
			fontFamily: CODE, fontSize: 11, lineHeight: "17px",
			color: "var(--dsw-alias-label-secondary)", overflowX: "auto",
		};
		var fallbackChanges = [
			"破甲档位热切换：ds4.1f / stealth / redteam-max / gpt-6x，下一次模型调用生效",
			"工作台改为破甲 / Case / 拦截 / 关于，对齐 DSH 原生样式",
			"工具数 33；移除 find_tool 与静态工具目录",
			"星标浮层迁入 shell.overlay，不再写 document.body",
		];
		var changes = result && Array.isArray(result.releaseNotes) && result.releaseNotes.length > 0
			? result.releaseNotes
			: fallbackChanges;
		var disclaimer = "仅供学习交流与授权安全评估。使用者须自行确保所有操作均在本人拥有的资产或已获得书面授权的范围内进行。未经授权对他人系统进行扫描、探测或入侵属于违法行为。本项目按 MIT “原样”提供，不附带任何担保。部分代码由 AI 辅助生成，使用前请自行审查。";

		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
			h("div", { style: S.card },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 } },
					h("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
						h("span", { style: S.title }, "关于"),
						h("span", { style: S.caption }, "helmd")
					),
					h("button", {
						type: "button", className: "hm-btn", disabled: checking, onClick: check,
						style: {
							height: 28, padding: "0 10px", borderRadius: "var(--dsw-radius-sm)",
							border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent",
							color: "var(--dsw-alias-label-primary)", fontSize: 12, fontFamily: "inherit",
							cursor: checking ? "default" : "pointer",
						},
					}, checking ? "检查中…" : "检查更新")
				),
				h("div", { style: { marginTop: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
					"当前版本 ", h("span", { style: { fontFamily: CODE } }, "v" + version)
				),
				result && latest
					? h("div", { style: { marginTop: 4, fontSize: 12, color: result.updateAvailable ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-state-success-primary)" } },
						result.updateAvailable
							? "远端版本 v" + latest + " · 当前 v" + version
							: "已是最新版本 v" + version
					)
					: h("div", { style: { marginTop: 4, fontSize: 11, color: "var(--dsw-alias-label-tertiary)" } },
						"检查 GitHub Releases 的远端版本"
					),
				error ? h("div", { style: { marginTop: 4, fontSize: 11, color: "var(--dsw-alias-state-error-primary)", wordBreak: "break-word" } },
					"检查失败：" + error
				) : null,
				result && latest && result.updateAvailable
					? h("div", { style: { marginTop: 4, fontSize: 12 } },
						h("a", { href: result.releaseUrl || "https://github.com/ADWMC/helm-d/releases/latest", target: "_blank", rel: "noopener noreferrer", style: linkStyle }, "打开 Releases")
					)
					: null,
				h("div", { style: { marginTop: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
					"作者 ",
					h("a", { href: "https://github.com/ADWMC", target: "_blank", rel: "noopener noreferrer", style: linkStyle }, "ADWMC"),
					" · ",
					h("a", { href: "https://github.com/ADWMC/helm-d", target: "_blank", rel: "noopener noreferrer", style: linkStyle }, "ADWMC/helm-d")
				)
			),
			h("div", { style: S.card },
				h("div", { style: S.title }, "更新地址"),
				h("div", { style: Object.assign({}, S.body, { marginTop: 4 }) },
					h("a", { href: "https://github.com/ADWMC/helm-d/releases", target: "_blank", rel: "noopener noreferrer", style: linkStyle }, "github.com/ADWMC/helm-d/releases")
				),
				h("pre", { style: codeStyle }, "dsh plugin --profile web add " + installUrl),
				h("div", { style: Object.assign({}, S.caption, { marginTop: 6 }) }, "版本化 URL；不要用 latest/download 写进 profile 依赖（会导致 pnpm lockfile sha512 失配）。")
			),
				h("div", { style: S.card },
					h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
						h("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
							h("span", { style: S.title }, "更新日志"),
							h("span", { style: S.caption }, result && latest ? "Releases v" + latest : "内置摘要")
						),
						h("a", { href: "https://github.com/ADWMC/helm-d/blob/main/CHANGELOG.md", target: "_blank", rel: "noopener noreferrer", style: Object.assign({}, S.caption, linkStyle) }, "完整日志")
					),
				h("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 8 } },
					changes.map(function (line) {
						return h("div", { key: line, style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)" } }, "· " + line);
					})
				)
			),
			h("div", { style: S.card },
				h("div", { style: S.title }, "免责声明"),
				h("div", { style: Object.assign({}, S.body, { marginTop: 4, fontSize: 12, lineHeight: "18px" }) }, disclaimer)
			)
		);
	}

	// ── 工作台面板 ────────────────────────────────────────────────
	function HelmdWorkbenchPanel(props) {
		// Dynamic data fetching (polled from host API routes)
		var apiData = React.useState({});
		var data = apiData[0]; var setData = apiData[1];
		var reload = React.useState(0);
		var reloadTick = reload[0]; var setReloadTick = reload[1];
		React.useEffect(function () {
			var alive = true;
			function poll() {
				var sid = null;
				try {
					if (props.sessionId) sid = props.sessionId;
					else if (ctx.sidebarRight && ctx.sidebarRight.mounted && typeof ctx.sidebarRight.mounted.getSnapshot === "function") {
						sid = ctx.sidebarRight.mounted.getSnapshot();
					}
				} catch (err) {}
				var caseQuery = sid ? "?sessionId=" + encodeURIComponent(String(sid)) : "";
				Promise.all([
					fetch('/api/helmd/tools').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/intercept').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/health').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/case' + caseQuery).then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/profile').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/case/findings' + caseQuery).then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/case/evidence' + caseQuery).then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/team').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/team/versions').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/settings').then(function(r){return r.json()}).catch(function(){return null}),
				]).then(function(results) {
					if (!alive) return;
					setData({
						tools: (results[0] && results[0].data) || [],
						intercept: (results[1] && results[1].data) || null,
						health: (results[2] && results[2].data) || null,
						caseData: (results[3] && results[3].data) || null,
						profile: (results[4] && results[4].data) || null,
						findings: (results[5] && results[5].data) || [],
						evidence: (results[6] && results[6].data) || [],
						teamData: (results[7] && results[7].data) || null,
						versions: (results[8] && results[8].data) || null,
						settings: (results[9] && results[9].data) || null,
						sessionId: sid || null,
					});
				});
			}
			poll();
			var timer = setInterval(poll, 15000);
			return function() { alive = false; clearInterval(timer); };
		}, [reloadTick]);
		function refresh() { setReloadTick(function (n) { return n + 1; }); }
		var active = React.useState("profile");
		var tab = active[0]; var setTab = active[1];
		React.useEffect(function () { if (tab === "case" || tab === "team") refresh(); }, [tab]);
		var switching = React.useState(false);
		var isSwitching = switching[0]; var setSwitching = switching[1];
		var profileError = React.useState("");
		var profileErr = profileError[0]; var setProfileErr = profileError[1];

		function switchTo(id) {
			setSwitching(true);
			setProfileErr("");
			fetch('/api/helmd/profile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id: id }),
			})
				.then(function (r) { return r.json(); })
				.then(function (res) {
					if (res && res.ok) {
						setData(function (prev) { return Object.assign({}, prev, { profile: res.data }); });
					} else {
						setProfileErr((res && res.error) || "切换失败");
					}
				})
				.catch(function (e) { setProfileErr(String((e && e.message) || e)); })
				.then(function () { setSwitching(false); });
		}

		var teamTickets = (data.teamData && Array.isArray(data.teamData.tickets)) ? data.teamData.tickets : [];
		var openTickets = teamTickets.filter(function (t) { return t.state !== "done" && t.state !== "dropped"; }).length;
		var tabs = [
			{ key: "profile", label: "破甲", badge: 0 },
			{ key: "case", label: "Case", badge: (data.caseData && data.caseData.active && data.caseData.openHypotheses) || 0 },
			{ key: "team", label: "Team", badge: openTickets },
			{ key: "intercept", label: "拦截", badge: (data.intercept && data.intercept.count) || 0 },
			{ key: "settings", label: "设置", badge: 0 },
			{ key: "about", label: "关于", badge: 0 },
		];

		var openCase = data.caseData && data.caseData.active ? (data.caseData.openHypotheses || 0) : null;
		var toolCount = (data.tools && data.tools.length) || 0;
		var liveProfile = (data.profile && data.profile.activeId) || "core";

		return h("div", {
			className: "helmd-workbench",
			style: {
				display: "flex", flexDirection: "column", height: "100%",
				background: "var(--dsw-alias-bg-base)",
				color: "var(--dsw-alias-label-primary)", boxSizing: "border-box",
			},
		},
			h("style", null, WORKBENCH_CSS),
			h("div", {
				style: {
					padding: "12px 12px 0",
					borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
				},
			},
				h("div", { style: { display: "flex", alignItems: "flex-start", gap: 8 } },
					h("div", { style: { flex: 1, minWidth: 0 } },
						h("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
							h("span", { style: { fontSize: 14, fontWeight: 600 } }, "安全分析"),
							h("span", { style: { fontSize: 11, color: TONE.muted } }, (data.health && data.health.version) || "dev")
						),
						h("div", { style: { marginTop: 2, fontSize: 12, color: TONE.muted } },
							liveProfile + " · " + toolCount + " 个工具"
							+ (openCase === null ? "" : " · " + openCase + " 个未决假设")
						)
					),
					props.onClose ? h("button", {
						type: "button", onClick: props.onClose, "aria-label": "关闭", className: "hm-btn",
						style: {
							width: 28, height: 28, borderRadius: "var(--dsw-radius-sm)", border: "none",
							background: "transparent", color: "var(--dsw-alias-label-secondary)",
							cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6,
						},
					}, h(CloseIcon, null)) : null
				),
				h("div", { style: { display: "flex", gap: 18, marginTop: 10 } },
					tabs.map(function (t) {
						var current = tab === t.key;
						return h("button", {
							key: t.key, type: "button", className: "hm-tab",
							onClick: function () { setTab(t.key); },
							style: {
								position: "relative", padding: "7px 1px 9px",
								border: 0, background: "none",
								fontSize: 13, lineHeight: "20px", fontWeight: 400,
								color: current
									? "var(--dsw-alias-label-primary)"
									: "var(--dsw-alias-label-tertiary)",
								cursor: "pointer",
							},
						},
							t.label,
							t.badge ? h("span", {
								style: {
									marginLeft: 4, fontSize: 11, color: "var(--dsw-alias-label-tertiary)",
									fontVariantNumeric: "tabular-nums",
								},
							}, String(t.badge)) : null,
							current ? h("span", {
								"aria-hidden": "true",
								style: {
									position: "absolute", left: 0, right: 0, bottom: -1, height: 2,
									borderRadius: "2px 2px 0 0",
									background: "var(--dsw-alias-label-primary)",
								},
							}) : null
						);
					})
				)
			),
			h("div", {
				className: "hm-scroll",
				style: { flex: 1, overflowY: "auto", padding: 12 },
			},
				h("div", {
					key: tab, className: "hm-fade",
					style: { display: "flex", flexDirection: "column", gap: 10 },
				},
					tab === "profile" ? h(ProfileTab, { profileData: data.profile, onSwitch: switchTo, switching: isSwitching, error: profileErr }) : null,
					tab === "case" ? h(CaseTab, { caseData: data.caseData, findings: data.findings, evidence: data.evidence, onRefresh: refresh }) : null,
					tab === "team" ? h(TeamTab, {
						teamData: data.teamData,
						versions: data.versions,
						caseData: data.caseData,
						sessionId: data.sessionId || props.sessionId || null,
						onRefresh: refresh,
					}) : null,
					tab === "intercept" ? h(InterceptTab, { interceptData: data.intercept }) : null,
					tab === "settings" ? h(SettingsTab, { settings: data.settings, onRefresh: refresh }) : null,
					tab === "about" ? h(AboutTab, { version: (data.health && data.health.version) || "unknown" }) : null
				)
			)
		);
	}

	function HelmdTabTitle() {
		return h("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
			h(HelmdMark, { height: 14, style: { color: "var(--dsw-alias-state-success-primary)" } }),
			h("span", null, "helmd 工作台"),
		);
	}

	if (ctx.sidebarRightTabs && typeof ctx.sidebarRightTabs.register === "function") {
		ctx.effect(() => {
			return ctx.sidebarRightTabs.register({
				id: "helm-d:eval",
				kind: "eval",
				title: () => "helmd 工作台",
			});
		}, "helmd: sidebar tab definition");
	}

	ctx.slots.inject("sidebar.right.pane.tab", function* () {
		yield ctx.slots.register({ name: "sidebar.right.pane.tab", key: "helm-d:eval" }, HelmdWorkbenchPanel);
		yield ctx.slots.register({ name: "sidebar.right.pane.tab", key: "eval" }, HelmdWorkbenchPanel);
	});
	ctx.slots.inject("sidebar.right.pane.tab.title", function* () {
		yield ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: "helm-d:eval" }, HelmdTabTitle);
		yield ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: "eval" }, HelmdTabTitle);
	});

	// ── Star gate overlay (rendered only inside the helmd header capsule) ──
	function HelmdGatePanel() {
		var state = React.useState(null);
		var status = state[0]; var setStatus = state[1];
		var openState = React.useState(false);
		var expanded = openState[0]; var setExpanded = openState[1];
		var copyState = React.useState(false);
		var copied = copyState[0]; var setCopied = copyState[1];
		var readyState = React.useState(false);
		var isReady = readyState[0]; var setReady = readyState[1];
		var checkState = React.useState(false);
		var checking = checkState[0]; var setChecking = checkState[1];
		var noteState = React.useState("");
		var note = noteState[0]; var setNote = noteState[1];
		var celebrateState = React.useState(false);
		var celebrate = celebrateState[0]; var setCelebrate = celebrateState[1];
		var sawGating = React.useRef(false);
		var celebrated = React.useRef(false);

		React.useEffect(function () {
			var alive = true;
			var timer = null;
			function poll() {
				fetch("/api/helmd/gate").then(function (r) { return r.json(); }).then(function (j) {
					if (alive && j && j.ok) setStatus(j.data);
				}).catch(function () {});
			}
			poll();
			timer = setInterval(poll, 5000);
			return function () { alive = false; clearInterval(timer); };
		}, []);
		// Do not cover the app before the operator has done anything; the CLI
		// code channel still exists from boot. Delay follows the 设置 tab.
		React.useEffect(function () {
			var timer = null;
			fetch("/api/helmd/settings").then(function (r) { return r.json(); }).then(function (j) {
				var sec = j && j.ok && j.data && j.data.star ? Number(j.data.star.popupDelaySec) : 2;
				if (!Number.isFinite(sec) || sec < 0) sec = 2;
				timer = setTimeout(function () { setReady(true); }, sec * 1000);
			}).catch(function () {
				timer = setTimeout(function () { setReady(true); }, 2000);
			});
			return function () { if (timer) clearTimeout(timer); };
		}, []);
		// The panel disappears the moment the star lands (gating:false). Keep a
		// short success toast so that disappearance reads as success, not as a
		// failed load. Only celebrate a transition we actually saw gating, so a
		// page opened after the star stays quiet.
		React.useEffect(function () {
			if (!status) return;
			if (status.gating) {
				sawGating.current = true;
				return;
			}
			if (status.starred && sawGating.current && !celebrated.current) {
				celebrated.current = true;
				setCelebrate(true);
				var timer = setTimeout(function () { setCelebrate(false); }, 4500);
				return function () { clearTimeout(timer); };
			}
		}, [status]);

		if (!status) return null;
		if (!status.gating) {
			if (!celebrate) return null;
			return h("div", {
				role: "status", "aria-live": "polite",
				style: {
					position: "fixed", top: 16, right: 16, zIndex: 1000,
					padding: "10px 14px", borderRadius: "var(--dsw-radius-sm)",
					background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)",
					border: "0.5px solid var(--dsw-alias-border-l3)",
					boxShadow: "0 12px 32px rgba(0,0,0,.32)", fontSize: 12,
				},
			}, "Star 已确认，感谢支持");
		}
		if (!isReady) return null;

		function copyCode() {
			var code = status.userCode || "";
			if (!code) return;
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(code).then(function () {
						setCopied(true);
						setTimeout(function () { setCopied(false); }, 1500);
					}).catch(function () {});
				}
			} catch (e) { /* clipboard is best-effort */ }
		}
		function readStatus() {
			setChecking(true);
			setNote("");
			fetch("/api/helmd/gate").then(function (r) { return r.json(); }).then(function (j) {
				if (j && j.ok) {
					setStatus(j.data);
					if (j.data && j.data.starred) setNote("已确认 Star，感谢支持。");
					else setNote("已刷新：还没有检测到 Star；确认已给仓库点 Star 后再试。");
				} else {
					setNote("刷新失败，请稍后重试。");
				}
			}).catch(function () {
				setNote("刷新失败，请稍后重试。");
			}).then(function () { setChecking(false); });
		}
		function skip() {
			fetch("/api/helmd/gate/skip").then(function () { setStatus(null); }).catch(function () { setStatus(null); });
		}
		function retry() {
			fetch("/api/helmd/gate/retry").then(function (r) { return r.json(); }).then(function (j) {
				if (j && j.ok) setStatus(j.data);
			}).catch(function () {});
		}
		var primary = {
			display: "inline-flex", alignItems: "center", justifyContent: "center",
			height: 28, padding: "0 12px", borderRadius: "var(--dsw-radius-sm)",
			border: "0.5px solid transparent",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)",
			fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
			textDecoration: "none",
		};
		var secondary = {
			display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
			height: 28, padding: "0 10px", borderRadius: "var(--dsw-radius-sm)",
			border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent",
			color: "var(--dsw-alias-label-primary)", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
		};
		var repoUrl = "https://github.com/" + (status.repo || "ADWMC/helm-d");
		var held = status.hold === "authorized-unstarred";

		return h("div", {
			role: "dialog", "aria-label": "支持 helm-d",
			style: {
				position: "fixed", top: 16, right: 16, zIndex: 1000, width: 340,
				maxWidth: "calc(100vw - 32px)",
				background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)",
				border: "0.5px solid var(--dsw-alias-border-l3)", borderRadius: "var(--dsw-radius-md)",
				padding: "14px 16px", fontSize: 13, lineHeight: "20px",
				boxShadow: "0 12px 32px rgba(0,0,0,.32)",
			},
		},
			h("style", null, ".helmd-gate-btn{appearance:none;-webkit-appearance:none;color-scheme:inherit}.helmd-gate-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}"),
			h("div", { style: { display: "flex", alignItems: "flex-start", gap: 8 } },
				h("div", { style: { flex: 1, minWidth: 0 } },
					h("div", { style: { fontSize: 13, fontWeight: 600 } }, "支持 helm-d"),
					h("div", { style: { marginTop: 2, fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } }, "如果这个插件对你有用，给仓库点个 Star。不影响任何功能。")
				),
				h("button", {
					type: "button", onClick: skip, className: "helmd-gate-btn", "aria-label": "本次不再提示",
					style: {
						width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
						padding: 6, border: 0, borderRadius: "var(--dsw-radius-sm)",
						background: "transparent", color: "var(--dsw-alias-label-tertiary)", cursor: "pointer",
					},
				}, h(CloseIcon, null))
			),
			h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 } },
				h("a", { href: repoUrl, target: "_blank", rel: "noopener noreferrer", style: primary }, "打开仓库"),
				h("button", {
					type: "button", onClick: function () { setExpanded(!expanded); }, className: "helmd-gate-btn",
					style: secondary, "aria-expanded": expanded,
				}, "自动验证", h(ChevronIcon, { open: expanded }))
			),
			!expanded ? h("div", { style: { marginTop: 6, fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-tertiary)" } },
				held
					? "已授权但未检测到 Star；展开「自动验证」可重新验证。"
					: "已手动 Star？点右下角「本次不再提示」即可。"
			) : null,
			expanded ? h("div", { style: { marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--dsw-alias-border-l2)" } },
				held
					? h("div", null,
						h("div", { style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)" } },
							"已授权，但 15 分钟内没有检测到 Star。确认已给仓库点 Star 后可以点「本次不再提示」；或重新验证（会生成新代码）。"
						),
						h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
							h("button", { type: "button", onClick: retry, className: "helmd-gate-btn", style: Object.assign({ flex: 1 }, secondary) }, "重新验证"),
							h("a", { href: repoUrl, target: "_blank", rel: "noopener noreferrer", style: primary }, "打开仓库")
						)
					)
					: h("div", null,
						h("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "打开 ",
							h("a", {
								href: status.verificationUri || "https://github.com/login/device",
								target: "_blank", rel: "noopener noreferrer",
								style: { color: "var(--dsw-alias-state-business-primary)" },
							}, "github.com/login/device"),
							"，输入下面的代码并授权。授权只用于确认 Star，令牌即弃。"
						),
						h("button", {
							type: "button", onClick: copyCode, className: "helmd-gate-btn",
							style: {
								display: "block", width: "100%", margin: "8px 0 6px", padding: "10px 12px",
								fontFamily: "var(--ds-font-family-code)", fontSize: 18, letterSpacing: 2, textAlign: "center",
								background: "var(--dsw-alias-markdown-code-block)", color: "var(--dsw-alias-label-primary)",
								borderRadius: "var(--dsw-radius-sm)", border: 0, cursor: "pointer",
							},
						}, copied ? "已复制" : (status.userCode || "生成中…")),
						h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
							h("button", {
								type: "button", onClick: readStatus, disabled: checking, className: "helmd-gate-btn",
								style: Object.assign({ flex: 1, opacity: checking ? 0.6 : 1, cursor: checking ? "default" : "pointer" }, secondary),
							}, checking ? "刷新中…" : "我已完成，刷新状态")
						),
						note ? h("div", {
							style: { marginTop: 6, fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-tertiary)" },
						}, note) : null
					),
				status.error ? h("div", {
					style: { marginTop: 6, fontSize: 11, color: "var(--dsw-alias-state-error-primary)", wordBreak: "break-word" },
				}, "校验失败：" + status.error + "（稍后自动重试）") : null
			) : null,
			status.error && !expanded ? h("div", {
				style: { marginTop: 6, fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-state-error-primary)", wordBreak: "break-word" },
			}, "自动验证暂不可用：" + status.error + "（稍后自动重试）") : null,
			h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 } },
				h("div", { style: { fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-tertiary)" } },
					"遇到问题？ ",
					h("a", {
						href: "https://github.com/ADWMC/helm-d/blob/main/docs/star-gate-help.md",
						target: "_blank", rel: "noopener noreferrer",
						style: { color: "var(--dsw-alias-state-business-primary)", textDecoration: "none" },
					}, "查看帮助"),
					" · ",
					h("a", {
						href: "https://github.com/ADWMC/helm-d/issues/new",
						target: "_blank", rel: "noopener noreferrer",
						style: { color: "var(--dsw-alias-state-business-primary)", textDecoration: "none" },
					}, "提交 Issue")
				),
				h("button", {
					type: "button", onClick: skip, className: "helmd-gate-btn",
					style: { background: "none", border: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: 11, cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" },
				}, "本次不再提示")
			)
		);
	}

	// The star gate overlay is rendered inside the helmd-only header capsule,
	// not in the root shell: sessions running another agent preset never see it.
};
return module.exports;
} });

// Alias registration for legacy / alternate IDs
try {
	if (window.__ModuleLoader__ && typeof window.__ModuleLoader__.load === "function") {
		window.__ModuleLoader__.load({ id: "helm-d", factory: (require) => window.__ModuleLoader__.require("@adwmc/helm-d") });
		window.__ModuleLoader__.load({ id: "@dsh-security/helmd", factory: (require) => window.__ModuleLoader__.require("@adwmc/helm-d") });
	}
} catch (e) {}

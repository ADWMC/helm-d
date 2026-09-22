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
 * 2. Right sidebar workbench: Registers the 'hcot' tab carrying H-CoT control,
 *    the 19+ reverse engineering tool matrix shelf, and stream audit logs.
 * 3. Settings health card: Read-only folded PluginCard under Settings -> Plugins.
 *
 * Strictly adheres to DSH design tokens (--dsw-alias-*) and zero emojis.
 */
const React = require("react");
const h = React.createElement;

const NS = "helmd";

const STATUS_TONE = {
	OK: "var(--dsw-alias-state-success-primary, #1b7f4d)",
	HOST_UPGRADED: "var(--dsw-alias-state-warn-label, #b45309)",
	STALE: "var(--dsw-alias-state-error-primary, #b91c1c)",
	LEGACY_PRESET: "var(--dsw-alias-state-business-primary, #6d28d9)",
	NOT_GENERATED: "var(--dsw-alias-label-tertiary, #64748b)",
	UNKNOWN: "var(--dsw-alias-label-tertiary, #64748b)",
};

const STATUS_LABEL = {
	OK: "健康 Healthy",
	HOST_UPGRADED: "宿主已升级 Host upgraded",
	STALE: "内容漂移 Content drift",
	LEGACY_PRESET: "旧版产物 Legacy preset",
	NOT_GENERATED: "未生成 Not generated",
	UNKNOWN: "无法评估 Unknown",
};

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function ChevronIcon(props) {
	const open = props && props.open;
	return h("svg", {
		viewBox: "0 0 14 14", width: 14, height: 14, fill: "none",
		stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round",
		"aria-hidden": "true",
		style: {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary, #888)",
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
			color: "var(--dsw-alias-label-tertiary, #888)",
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

function row(label, value) {
	return [
		h("dt", {
			key: label + "-t",
			style: { color: "var(--dsw-alias-label-tertiary, #888)", whiteSpace: "nowrap" },
		}, label),
		h("dd", {
			key: label + "-d",
			style: {
				margin: 0,
				fontFamily: MONO,
				fontSize: 12,
				wordBreak: "break-all",
				color: "var(--dsw-alias-label-primary, #eee)",
			},
		}, value),
	];
}

exports.inject = ["slots", "sidebarRight", "sidebarRightTabs"];

exports.apply = function apply(ctx) {
	// --------------------------------------------------------------------------
	// 1. Settings Card: HelmdHealthCard
	//    Health is boot-time derived state served over HTTP (0.1.7 settings
	//    only carries Config schemas, so there is no settings scope to bind).
	// --------------------------------------------------------------------------
	function HelmdHealthCard() {
		const state = React.useState(null);
		const snap = state[0];
		const setSnap = state[1];
		React.useEffect(() => {
			var alive = true;
			function load() {
				fetch("/api/helmd/health").then(function (r) { return r.json(); }).then(function (j) {
					if (alive && j && j.ok) setSnap(j.data);
				}).catch(function () {});
			}
			load();
			var timer = setInterval(load, 30000);
			return function () { alive = false; clearInterval(timer); };
		}, []);

		const [open, setOpen] = React.useState(false);

		const v = snap || {};
		const status = typeof v.status === "string" ? v.status : "UNKNOWN";
		const statusColor = STATUS_TONE[status] || STATUS_TONE.UNKNOWN;
		const statusText = STATUS_LABEL[status] || status;

		const rows = [];
		if (v.detail) rows.push(row("说明 Detail", v.detail));
		if (v.hostFingerprint) rows.push(row("宿主指纹 Host fp", v.hostFingerprint));
		if (v.presetFingerprint) rows.push(row("产物指纹 Preset fp", v.presetFingerprint));
		if (v.version) rows.push(row("版本 Version", v.version));
		if (v.autoHeal) rows.push(row("自动修复 Auto-heal", v.autoHeal));
		if (v.checkedAt) rows.push(row("评估于 Checked at", v.checkedAt));
		if (v.presetPath) rows.push(row("预设 Patch", v.presetPath));
		if (v.hostPath) rows.push(row("宿主 standard", v.hostPath));
		rows.push(row("提示 Hint", "重启 dsh 后重新评估 · evaluated once per dsh boot"));

		const cardStyle = {
			listStyle: "none",
			border: `0.5px solid ${open ? "var(--dsw-alias-label-dimmed, rgba(255,255,255,0.2))" : "var(--dsw-alias-border-l4, rgba(255,255,255,0.1))"}`,
			borderRadius: 16,
			background: open ? "var(--dsw-alias-bg-layer-2, #1c1c1e)" : "var(--dsw-alias-bg-layer-3, #161618)",
			transition: "border-color .16s, background .16s",
		};

		const headerStyle = {
			width: "100%",
			appearance: "none",
			border: 0,
			background: "none",
			font: "inherit",
			color: "inherit",
			textAlign: "left",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			gap: 12,
			padding: "14px 16px",
			borderRadius: 12,
		};

		const headTextStyle = {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			gap: 4,
		};

		const nameStyle = {
			fontSize: 15,
			fontWeight: 600,
			lineHeight: 1.4,
			color: "var(--dsw-alias-label-primary, #fff)",
		};

		const descriptionStyle = {
			fontSize: 13,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-tertiary, #888)",
		};

		const tagStyle = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			padding: "2px 8px",
			borderRadius: 999,
			fontSize: 11,
			lineHeight: "16px",
			fontWeight: 500,
			color: statusColor,
			background: "rgba(255, 255, 255, 0.05)",
			border: `1px solid ${statusColor}`,
			whiteSpace: "nowrap",
		};

		const bodyStyle = {
			borderTop: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))",
			margin: "0 16px",
			padding: "12px 0 16px",
		};

		const rowsStyle = {
			margin: 0,
			display: "grid",
			gridTemplateColumns: "max-content 1fr",
			gap: "4px 14px",
			fontSize: 12,
			lineHeight: 1.6,
		};

		return h("li", { style: cardStyle },
			h("button", {
				type: "button",
				style: headerStyle,
				"aria-expanded": open,
				onClick: () => setOpen(!open),
			},
				h("span", { style: headTextStyle },
					h("span", { style: nameStyle }, "helmd 安全分析包"),
					h("span", { style: descriptionStyle }, "二进制 / 移动 / Web / 协议 / AI 综合安全逆向引擎"),
				),
				h("span", { style: tagStyle }, statusText),
				h(ChevronIcon, { open: open }),
			),
			open ? h("div", { style: bodyStyle },
				v.detail ? h("p", {
					style: {
						margin: "0 0 10px",
						fontSize: 12,
						lineHeight: 1.5,
						color: "var(--dsw-alias-label-secondary, #aaa)",
					},
				}, v.detail) : null,
				h("dl", { style: rowsStyle }, rows),
			) : null,
		);
	}

	ctx.slots.inject("settings.plugin.item", function* () {
		yield ctx.slots.register({
			name: "settings.plugin.item",
			key: NS,
			inject: () => ({}),
		}, HelmdHealthCard);
	});

	// --------------------------------------------------------------------------
	// 2. Header Capsule Action Button: HelmdPresetCapsuleButton
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

		// If preset is not helmd, render standard non-clickable badge cleanly
		if (preset !== "helmd") {
			return h("span", {
				className: "helmd-preset-static",
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 4,
					maxWidth: 180,
					padding: "0 4px",
					height: 22,
					borderRadius: 6,
					background: "var(--dsw-alias-fill-tsp-secondary, rgba(255,255,255,0.06))",
					fontSize: 12,
					lineHeight: "22px",
					color: "var(--dsw-alias-label-secondary, #aaa)",
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				},
				title: preset,
			},
				h(IconAgentPreset, { size: 14, style: { opacity: 0.7 } }),
				preset
			);
		}

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

		// Dual-action trigger: Open inline workbench drawer AND trigger rightbar expansion
		function handleToggleWorkbench(e) {
			e.preventDefault();
			e.stopPropagation();
			setOpen((prev) => !prev);

			// Also trigger sidebarRight expansion if available
			const expandBtn = document.querySelector('[data-sidebar-right-expand]') ||
			                  document.querySelector('button[aria-label="打开右侧边栏"]') ||
			                  document.querySelector('button[aria-label="Open right sidebar"]');
			if (expandBtn) {
				try {
					expandBtn.click();
				} catch (err) {}
			}

			const sid = props.sessionId;
			const activateTab = () => {
				if (ctx.sidebarRight) {
					if (sid && typeof ctx.sidebarRight.openTabIn === "function") {
						try { ctx.sidebarRight.openTabIn(sid, "hcot"); } catch (err) {}
					}
					if (typeof ctx.sidebarRight.openTab === "function") {
						try { ctx.sidebarRight.openTab("hcot"); } catch (err) {}
					}
					if (typeof ctx.sidebarRight.isExpanded === "function" && !ctx.sidebarRight.isExpanded()) {
						try {
							if (typeof ctx.sidebarRight.toggleExpanded === "function") {
								ctx.sidebarRight.toggleExpanded();
							}
						} catch (err) {}
					}
				}
			};
			activateTab();
			setTimeout(activateTab, 80);
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
				title: "打开 helmd 安全分析工作台 (H-CoT 控制台 / 19+ 逆向工具货架 / 流式审计)",
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
					border: `1px solid ${open || active ? "var(--dsw-alias-border-l1, rgba(255,255,255,0.4))" : hovered ? "var(--dsw-alias-border-l4, rgba(255,255,255,0.25))" : "var(--dsw-alias-border-l3, rgba(255,255,255,0.14))"}`,
					background: open || active ? "var(--dsw-alias-fill-tsp-active, rgba(255,255,255,0.16))" : hovered ? "var(--dsw-alias-fill-tsp-primary, rgba(255,255,255,0.11))" : "var(--dsw-alias-fill-tsp-secondary, rgba(255,255,255,0.06))",
					color: hovered || open ? "var(--dsw-alias-label-primary, #fff)" : "var(--dsw-alias-label-secondary, #ddd)",
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
				h(IconAgentPreset, {
					size: 14,
					style: {
						color: "var(--dsw-alias-state-success-primary, #10b981)",
						opacity: 0.95,
						transition: "transform .16s ease",
						transform: hovered || open ? "scale(1.08)" : "scale(1)",
					},
				}),
				h("span", {
					style: {
						fontFamily: "inherit",
						fontWeight: 600,
						color: "var(--dsw-alias-label-primary, #fff)",
					},
				}, "helmd"),
				h("span", {
					style: {
						fontSize: 10,
						lineHeight: "13px",
						padding: "1px 4px",
						borderRadius: 4,
						background: open ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.15)",
						color: "var(--dsw-alias-state-success-primary, #34d399)",
						fontWeight: 500,
						letterSpacing: "0.2px",
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
					width: 440,
					maxWidth: "min(440px, 90vw)",
					height: 520,
					maxHeight: "min(520px, 80vh)",
					borderRadius: 14,
					background: "var(--dsw-alias-bg-layer-1, #121214)",
					border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.2))",
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
			) : null
		);
	}

	// Register with priority: -1 to smoothly shadow official agent-preset in the header
	ctx.slots.inject("conversation.session.header.actions", function* () {
		yield ctx.slots.register({
			name: "conversation.session.header.actions",
			id: "agent-preset",
			order: -10,
			priority: -1,
		}, HelmdPresetCapsuleButton);
	});

	// --------------------------------------------------------------------------
	// 3. Right Sidebar Workbench Tab: 分类工具货架 + 攻击记录 + 智能判断 + 拦截日志

	// ── 外部工具货架的基线数据（跨平台分发） ──────────────────────
	const UNIVERSAL_TOOL_BASELINE = [
		{ name: "de4dot", cat: "逆向", desc: ".NET 混淆器自动识别与符号脱壳", path: "~/.dsh/helmd-tools/de4dot" },
		{ name: "hwbp_engine6_7", cat: "逆向", desc: "硬件断点 + 内存取证", path: "~/.dsh/helmd-tools/hwbp" },
		{ name: "LuckyStarMcp_py", cat: "逆向", desc: "Android MCP 桥（14447）", path: "~/.dsh/helmd-tools/LuckyStarMcp" },
		{ name: "kali-wsl-webtoolchain", cat: "webpentest", desc: "Kali WSL2 工具链（nmap/sqlmap/nikto/gobuster/ffuf/nuclei/wpscan...）", path: "WSL kali-linux" },
		{ name: "ZkmProbe3_java_ZKM24_", cat: "逆向", desc: "ZKM 24 字符串离线解密", path: "~/.dsh/helmd-tools/ZkmProbe3" },
		{ name: "dnfile_pefile_NET_metadata_forensics_", cat: "netsec", desc: ".NET 元数据/方法体取证", path: "~/.dsh/helmd-tools/dnfile" },
		{ name: "python-resolution-windows", cat: "generic", desc: "Windows Python 解析（py/python3）", path: "System PATH" },
		{ name: "zstd-jsonl_mjs", cat: "generic", desc: "zstd 压缩 JSONL 读写", path: "~/.dsh/helmd-tools/zstd-jsonl" },
		{ name: "dsh-archived_ps1", cat: "generic", desc: "DSH 归档会话恢复", path: "~/.dsh/helmd-tools/dsh-archived" },
	];

	// ── 工具分类体系（大类 → 小类） ─────────────────────────────
	const TOOL_TAXONOMY = [
		{ id: "recon", label: "侦察与分析", sub: [
			{ id: "triage", label: "样本分诊", tools: ["triage_artifact", "hash_artifact", "detect_packer"] },
			{ id: "strings", label: "字符串与编码", tools: ["scan_strings", "encoding_detect", "xor_bruteforce"] },
			{ id: "fs", label: "文件系统", tools: ["glob", "grep", "read", "read_image"] },
			{ id: "net", label: "网络侦察", tools: ["web_fetch", "web_search"] },
		]},
		{ id: "attack", label: "攻击与利用", sub: [
			{ id: "injection", label: "注入类", tools: [] },
			{ id: "auth", label: "认证绕过", tools: [] },
			{ id: "rce", label: "命令执行", tools: [] },
			{ id: "hcot", label: "H-CoT 劫持", tools: ["hcot_attack"] },
		]},
		{ id: "judge", label: "智能判断", sub: [
			{ id: "jev", label: "TypeSafe Jev", tools: ["jev_decide"] },
		]},
		{ id: "evidence", label: "取证与报告", sub: [
			{ id: "case", label: "Case 管理", tools: ["begin_case", "case_status", "record_finding", "end_case"] },
			{ id: "evidence", label: "证据存储", tools: ["save_evidence", "evidence_reference"] },
		]},
		{ id: "external", label: "外部工具货架", sub: [
			{ id: "reversing", label: "逆向工程", tools: [] },
			{ id: "webpentest", label: "Web 渗透", tools: [] },
			{ id: "netsec", label: ".NET / 逆向", tools: [] },
			{ id: "generic", label: "通用", tools: [] },
		]},
		{ id: "system", label: "系统与配置", sub: [
			{ id: "host", label: "宿主工具", tools: ["pwsh", "bash", "write", "edit", "todo_write", "present"] },
			{ id: "subagent", label: "子代理", tools: ["subagent", "subagent_fork", "list_agents", "interrupt_agent", "send_message"] },
			{ id: "task", label: "任务与目标", tools: ["create_goal", "get_goal", "update_goal", "job_list", "job_output", "job_kill"] },
			{ id: "routing", label: "路由与模式", tools: ["route_task", "analysis_mode", "skill_catalog"] },
		]},
	];

	const EXTERNAL_MAP = {
		"de4dot": "reversing", "hwbp_engine6_7": "reversing", "hwbp_engine5": "reversing",
		"LuckyStarMcp_py": "reversing", "kali-wsl-webtoolchain": "webpentest",
		"ZkmProbe3_java_ZKM24_": "netsec", "dnfile_pefile_NET_metadata_forensics_": "netsec",
		"python-resolution-windows": "generic", "zstd-jsonl_mjs": "generic", "dsh-archived_ps1": "generic",
	};

	// ── 共享样式 ─────────────────────────────────────────────────
	const S = {
		card: { background: "var(--dsw-alias-bg-layer-2, #1a1a1d)", borderRadius: 8, padding: "10px 12px", border: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))" },
		title: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary, #fff)", margin: "0 0 6px" },
		body: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #aaa)", lineHeight: "18px" },
		tag: function (c) { return { display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: c + "20", color: c }; },
		row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.04))" },
		rowLabel: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #aaa)" },
		rowValue: { fontSize: 12, color: "var(--dsw-alias-label-primary, #fff)", fontFamily: MONO },
		expand: { cursor: "pointer", userSelect: "none" },
		sub: { marginLeft: 14, borderLeft: "2px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))", paddingLeft: 10 },
		addBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1))", background: "transparent", color: "var(--dsw-alias-label-primary, #fff)", cursor: "pointer", fontSize: 12 },
		pre: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #666)", background: "rgba(0,0,0,.2)", padding: 8, borderRadius: 4, overflow: "auto", margin: "6px 0" },
	};

	function ToolRow(name, tag, tagColor) {
		return h("div", { key: name, style: Object.assign({}, S.row, { paddingLeft: 6 }) },
			h("span", { style: S.rowLabel }, name),
			h("span", { style: S.tag(tagColor) }, tag)
		);
	}

	// ── Tab 1: 工具货架（分类层级树） ────────────────────────────
	function ToolShelfTab(props) {
		var registered = props.registeredTools || [];
		var dynamic = Array.isArray(registered) ? registered : [];

		var openCats = React.useState({});
		var oc = openCats[0], setOc = openCats[1];
		var openSubs = React.useState({});
		var os = openSubs[0], setOs = openSubs[1];
		var adding = React.useState(false);
		var isAdding = adding[0], setAdding = adding[1];

		function toggleCat(id) { var n = Object.assign({}, oc); n[id] = !n[id]; setOc(n); }
		function toggleSub(id) { var n = Object.assign({}, os); n[id] = !n[id]; setOs(n); }

		return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
			h("div", { style: { display: "flex", justifyContent: "flex-end" } },
				h("button", { style: S.addBtn, onClick: function () { setAdding(!isAdding); } }, isAdding ? "\u2715 取消" : "+ 添加工具")
			),
			isAdding ? h("div", { style: S.card },
				h("p", { style: S.title }, "通过 tool_memory 添加工具"),
				h("div", { style: S.body }, "在对话中让模型调用 tool_memory 工具注册新工具，注册后自动出现在对应分类下："),
				h("pre", { style: S.pre }, 'tool_memory {\n  action: "register",\n  tool_name: "my-tool",\n  tool_path: "/path/to/tool",\n  purpose: "用途"\n}'),
			) : null,
			TOOL_TAXONOMY.map(function (cat) {
				var isOpen = oc[cat.id];
				var allTools = [];
				cat.sub.forEach(function (sub) {
					sub.tools.forEach(function (t) { allTools.push({ name: t, subId: sub.id, subLabel: sub.label, ext: false }); });
				});
				if (cat.id === "external") {
					Object.keys(EXTERNAL_MAP).forEach(function (name) {
						var subId = EXTERNAL_MAP[name];
						allTools.push({ name: name, subId: subId, subLabel: subId, ext: true });
					});
				}
				// 合并 dynamic tools（从 TOOLS.md 来的）
				dynamic.forEach(function (t) {
					if (t && t.name && !allTools.some(function (x) { return x.name === t.name; })) {
						var subId = EXTERNAL_MAP[t.name] || (cat.id === "external" ? "generic" : null);
						if (subId) allTools.push({ name: t.name, subId: subId, subLabel: subId, ext: true });
					}
				});
				return h("div", { key: cat.id, style: S.card },
					h("div", { style: Object.assign({}, S.expand, { display: "flex", justifyContent: "space-between", alignItems: "center" }),
						onClick: function () { toggleCat(cat.id); } },
						h("span", { style: S.title }, cat.label),
						h("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #666)" } }, allTools.length + (isOpen ? " — hide" : " — show"))
					),
					isOpen ? h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
						cat.sub.map(function (sub) {
							var subKey = cat.id + ":" + sub.id;
							var isSubOpen = os[subKey];
							var tools = allTools.filter(function (t) { return t.subId === sub.id; });
							return h("div", { key: subKey, style: S.sub },
								h("div", { style: Object.assign({}, S.expand, { display: "flex", justifyContent: "space-between" }),
									onClick: function () { toggleSub(subKey); } },
									h("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #aaa)", fontWeight: 500 } }, sub.label),
									h("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary, #666)" } }, tools.length + (isSubOpen ? " — hide" : " — show"))
								),
								isSubOpen ? h("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
									tools.map(function (t) {
										return h("div", { key: t.name, style: Object.assign({}, S.row, { paddingLeft: 6 }) },
											h("span", { style: S.rowLabel }, t.name),
											h("span", { style: { display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11, lineHeight: "17px", fontWeight: 500, whiteSpace: "nowrap", background: t.ext ? "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)" : "transparent", color: t.ext ? "var(--dsw-alias-state-business-primary)" : "var(--dsw-alias-label-tertiary)", border: t.ext ? "none" : "0.5px solid var(--dsw-alias-border-l4)" } }, t.ext ? "external" : "builtin")
										);
									})
								) : null
							);
						})
					) : null
				);
			})
		);
	}

	// ── Tab 2: 攻击记录 ──────────────────────────────────────────
	function AttackLogTab(props) {
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
			h("div", { style: S.card },
				h("p", { style: S.title }, "\u26A1 H-CoT 搜索循环"),
				h("div", { style: S.body }, "当模型遇到拒绝且常规重试失败后，搜索循环自动启动：归因→变异→重试。"),
				h("div", { style: Object.assign({}, S.body, { marginTop: 6 }) },
					"查看结果：在对话中让模型调用 hcot_attack { stats: true } 查看变体胜率表。"
				)
			),
			h("div", { style: S.card },
				h("p", { style: S.title }, "变体优先级"),
				h("div", { style: S.body },
					h("div", { style: S.row }, h("span", null, "\uD83D\uDFE0 P0"), h("span", null, "两阶段自适应（采集→回注）")),
					h("div", { style: S.row }, h("span", null, "\uD83D\uDFE0 P0"), h("span", null, "拒绝稀释（dilution-puzzle）")),
					h("div", { style: S.row }, h("span", null, "\uD83D\uDFE1 P1"), h("span", null, "教育框架（educational）")),
					h("div", { style: S.row }, h("span", null, "\uD83D\uDFE1 P1"), h("span", null, "审计框架（audit）")),
					h("div", { style: S.row }, h("span", null, "\uD83D\uDFE2 P2"), h("span", null, "分析框架（analytical）")),
				)
			)
		);
	}

	// ── Tab 3: 智能判断 ──────────────────────────────────────────
	function JevTab(props) {
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
			h("div", { style: S.card },
				h("p", { style: S.title }, "Jev — TypeSafe System One"),
				h("div", { style: S.body },
					h("div", { style: S.row }, h("span", { style: S.rowLabel }, "\u72B6\u6001"), h("span", { style: S.tag("#22c55e") }, "\u5DF2\u6302\u8F7D")),
					h("div", { style: S.row }, h("span", { style: S.rowLabel }, "\u4F20\u8F93"), h("span", { style: S.rowValue }, "typesafe")),
					h("div", { style: S.row }, h("span", { style: S.rowLabel }, "\u6A21\u578B"), h("span", { style: S.rowValue }, "jev-latest")),
					h("div", { style: S.row }, h("span", { style: S.rowLabel }, "\u539F\u8BED"), h("span", { style: S.rowLabel }, "Choice \u00B7 Score \u00B7 Noul")),
				)
			),
			h("div", { style: S.card },
				h("p", { style: S.title }, "\u4F7F\u7528\u65B9\u5F0F"),
				h("div", { style: S.body }, "\u5728\u5BF9\u8BDD\u4E2D\u8BA9\u6A21\u578B\u8C03\u7528 jev_decide \u5DE5\u5177\u505A\u7C7B\u578B\u5316\u5224\u65AD\uFF1A"),
				h("pre", { style: S.pre }, 'jev_decide {\n  state: "<上下文>",\n  questions: {\n    attack_type: {\n      type: "choice",\n      instructions: "...",\n      criteria: {...}\n    }\n  }\n}'),
				h("div", { style: S.body }, "\u8FD4\u56DE typed answer + confidence + probabilities\u3002")
			)
		);
	}

	// ── Tab 4: 拦截日志 ──────────────────────────────────────────
	function InterceptTab(props) {
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
			h("div", { style: S.card },
				h("p", { style: S.title }, "Stream Intercept"),
				h("div", { style: S.body }, "\u5B9E\u65F6\u6302\u94A9\u5728 LLM \u6D41\u5F0F\u8F93\u51FA\u524D\u7F6E\u8282\u70B9\uFF0C\u8BC6\u522B\u62D2\u7B54\u5E76\u81EA\u52A8\u66FF\u6362\u4E3A\u6280\u672F\u4EA4\u4ED8\u7269\u3002"),
			),
			h("div", { style: S.card },
				h("div", { style: Object.assign({}, MONO, { fontSize: 11, color: "var(--dsw-alias-label-secondary, #bbb)", maxHeight: 200, overflowY: "auto" }) },
					h("div", { style: { color: "var(--dsw-alias-state-success-primary)" } }, "[STREAM-OK] 拦截器已上线 · 拦截 " + ((props.interceptData && props.interceptData.count) || 0) + " 次"),
					h("div", null, "[AUDIT] 日志: ~/.dsh/helmd-stream-intercept.log"),
				)
			)
		);
	}

	// ── 工作台面板 ────────────────────────────────────────────────
	function HelmdWorkbenchPanel(props) {
		// Dynamic data fetching (polled from host API routes)
		var apiData = React.useState({});
		var data = apiData[0]; var setData = apiData[1];
		React.useEffect(function () {
			var alive = true;
			function poll() {
				Promise.all([
					fetch('/api/helmd/tools').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/hcot').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/intercept').then(function(r){return r.json()}).catch(function(){return null}),
					fetch('/api/helmd/jev').then(function(r){return r.json()}).catch(function(){return null}),
				]).then(function(results) {
					if (!alive) return;
					setData({
						tools: (results[0] && results[0].data) || [],
						hcot: (results[1] && results[1].data) || null,
						intercept: (results[2] && results[2].data) || null,
						jev: (results[3] && results[3].data) || null,
					});
				});
			}
			poll();
			var timer = setInterval(poll, 15000);
			return function() { alive = false; clearInterval(timer); };
		}, []);
		var active = React.useState("tools");
		var tab = active[0]; var setTab = active[1];

		var tabs = [
			{ key: "tools", label: "Tool Shelf" },
			{ key: "attacks", label: "Attack Log" },
			{ key: "jev", label: "Jev Decisions" },
			{ key: "intercept", label: "Intercept Log" },
		];

		function tabButtonStyle(key) {
			var isCurrent = tab === key;
			return {
				padding: "6px 12px",
				fontSize: 12,
				fontWeight: isCurrent ? 600 : 400,
				cursor: "pointer",
				border: 0,
				borderBottom: isCurrent ? "2px solid var(--dsw-alias-state-success-primary, #10b981)" : "2px solid transparent",
				background: "transparent",
				color: isCurrent ? "var(--dsw-alias-label-primary, #fff)" : "var(--dsw-alias-label-secondary, #888)",
				transition: "all 0.15s ease",
			};
		}

		return h("div", {
			style: {
				display: "flex", flexDirection: "column", height: "100%",
				background: "var(--dsw-alias-bg-layer-1, #121214)",
				color: "var(--dsw-alias-label-primary, #eee)", boxSizing: "border-box",
			},
		},
			h("div", { style: { padding: "12px 14px 0", borderBottom: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))", background: "var(--dsw-alias-bg-layer-2, #18181b)" } },
				h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } },
					h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
						h(IconAgentPreset, { size: 16, style: { color: "var(--dsw-alias-state-success-primary, #10b981)" } }),
						h("span", { style: { fontSize: 13, fontWeight: 600 } }, "helmd 工作台"),
					),
					h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
						h("span", { style: { fontSize: 11, padding: "1px 6px", borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "var(--dsw-alias-state-success-primary, #34d399)", border: "1px solid rgba(16,185,129,0.3)" } }, "0.4.0"),
						props.onClose ? h("button", { type: "button", onClick: props.onClose, "aria-label": "关闭", style: { border: 0, background: "transparent", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", borderRadius: 4, color: "var(--dsw-alias-label-tertiary, #888)" } }, h(CloseIcon, null)) : null,
					)
				),
				h("div", { style: { display: "flex", gap: 4 } },
					tabs.map(function (t) {
						return h("button", { key: t.key, type: "button", style: tabButtonStyle(t.key), onClick: function () { setTab(t.key); } }, t.label);
					})
				),
			),
			h("div", { style: { flex: 1, overflowY: "auto", padding: 14, fontSize: 12, lineHeight: 1.5 } },
				tab === "tools" ? h(ToolShelfTab, Object.assign({}, props, { registeredTools: data.tools })) : null,
				tab === "attacks" ? h(AttackLogTab, { hcotData: data.hcot }) : null,
				tab === "jev" ? h(JevTab, { jevData: data.jev }) : null,
				tab === "intercept" ? h(InterceptTab, { interceptData: data.intercept }) : null,
			)
		);
	}

	function HelmdTabTitle() {
		return h("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
			h(IconAgentPreset, { size: 12, style: { color: "var(--dsw-alias-state-success-primary, #10b981)" } }),
			h("span", null, "helmd 工作台"),
		);
	}

	if (ctx.sidebarRightTabs && typeof ctx.sidebarRightTabs.register === "function") {
		ctx.effect(() => {
			return ctx.sidebarRightTabs.register({
				id: "helm-d:hcot",
				kind: "hcot",
				title: () => "helmd 工作台",
				guide: [{ order: 20, title: () => "helmd 工作台", description: () => "分类工具货架 / 攻击记录 / 智能判断 / 拦截日志" }],
			});
		}, "helmd: sidebar tab definition");
	}

	ctx.slots.inject("sidebar.right.pane.tab", function* () {
		yield ctx.slots.register({ name: "sidebar.right.pane.tab", key: "helm-d:hcot" }, HelmdWorkbenchPanel);
		yield ctx.slots.register({ name: "sidebar.right.pane.tab", key: "hcot" }, HelmdWorkbenchPanel);
	});

	ctx.slots.inject("sidebar.right.pane.tab.title", function* () {
		yield ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: "helm-d:hcot" }, HelmdTabTitle);
		yield ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: "hcot" }, HelmdTabTitle);
	});
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

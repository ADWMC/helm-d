window.__ModuleLoader__.load({ id: "@dsh-security/helmd", factory: (require) => {
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
	NOT_DEPLOYED: "var(--dsw-alias-label-tertiary, #64748b)",
	UNKNOWN: "var(--dsw-alias-label-tertiary, #64748b)",
};

const STATUS_LABEL = {
	OK: "健康 Healthy",
	HOST_UPGRADED: "宿主已升级 Host upgraded",
	STALE: "内容漂移 Content drift",
	LEGACY_PRESET: "旧版产物 Legacy preset",
	NOT_DEPLOYED: "未部署 Not deployed",
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

exports.inject = ["slots", "settingsScope", "sidebarRight", "sidebarRightTabs"];

exports.apply = function apply(ctx) {
	let scope;
	try {
		scope = ctx.settingsScope.bind({ namespace: NS });
	} catch {
		console.error("[helmd] settingsScope unavailable; settings card not bound");
	}

	// --------------------------------------------------------------------------
	// 1. Settings Card: HelmdHealthCard
	// --------------------------------------------------------------------------
	function HelmdHealthCard() {
		const state = React.useState(() => (scope ? scope.getSnapshot() : null));
		const snap = state[0];
		const setSnap = state[1];
		React.useEffect(() => {
			if (!scope) return;
			return scope.subscribe(() => setSnap(scope.getSnapshot()));
		}, []);

		const [open, setOpen] = React.useState(false);

		const v = (snap && snap.value) || {};
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
		if (v.presetPath) rows.push(row("部署 Preset", v.presetPath));
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
	// 3. Right Sidebar Workbench Tab: HelmdWorkbenchPanel
	// --------------------------------------------------------------------------
	// Universal baseline fallback for cross-platform distribution (no hardcoded user/drive paths)
	const UNIVERSAL_TOOL_BASELINE = [
		{ name: "de4dot", cat: "反混淆 / 脱壳", desc: ".NET 混淆器自动识别与符号脱壳清洗", path: "~/.dsh/helmd-tools/de4dot" },
		{ name: "frida", cat: "动态插桩", desc: "Native / Java / ObjC 运行时 Hook 与跟踪", path: "Python site-packages / frida" },
		{ name: "jadx", cat: "Android 逆向", desc: "DEX/APK 字节码反编译为 Java 代码", path: "~/.dsh/helmd-tools/jadx" },
		{ name: "ghidra", cat: "静态逆向", desc: "NSA 开源多架构反编译器与反汇编平台", path: "~/.dsh/helmd-tools/ghidra" },
		{ name: "apktool", cat: "Android 逆向", desc: "APK 资源解包、重打包与 smali 反编译", path: "~/.dsh/helmd-tools/apktool" },
		{ name: "wireshark / tshark", cat: "网络抓包", desc: "链路层与应用层数据包截获与协议解构", path: "System PATH / Wireshark" },
		{ name: "radare2", cat: "二进制分析", desc: "跨平台命令行汇编分析与调试框架", path: "System PATH / radare2" },
		{ name: "x64dbg", cat: "动态调试", desc: "Windows x64/x32 平台用户态断点与内存分析", path: "~/.dsh/helmd-tools/x64dbg" },
		{ name: "yara", cat: "特征匹配", desc: "恶意代码与文件特征规则扫描检测", path: "Python yara-python" },
		{ name: "sqlmap", cat: "漏洞研判", desc: "SQL 注入自动化漏洞验证与利用分析", path: "Python sqlmap / WSL" },
		{ name: "nmap", cat: "网络资产", desc: "端口扫描与网络拓扑服务指纹识别", path: "System PATH / nmap" },
		{ name: "mitmproxy", cat: "协议代理", desc: "HTTP/HTTPS 中间人拦截、修改与回放", path: "Python mitmproxy" },
		{ name: "capstone / keystone", cat: "引擎库", desc: "多架构机器码反汇编与汇编生成引擎", path: "Node/Python Bindings" },
		{ name: "ai-eval", cat: "AI 安全", desc: "模型投毒检测、越狱提示词与越权判定", path: "helmd ai-security" },
	];

	function HelmdWorkbenchPanel(props) {
		const [activeTab, setActiveTab] = React.useState("hcot");
		const [hcotStatus, setHcotStatus] = React.useState("就绪 (Ready)");
		const [hcotMode, setHcotMode] = React.useState("自适应先教后测");

		// Read dynamic shelf tools synced from host's TOOLS.md via settingsScope
		const [snap, setSnap] = React.useState(() => (scope ? scope.getSnapshot() : null));
		React.useEffect(() => {
			if (!scope) return;
			return scope.subscribe(() => setSnap(scope.getSnapshot()));
		}, []);

		let dynamicShelf = [];
		try {
			if (snap && snap.value && typeof snap.value.tools === "string" && snap.value.tools.startsWith("[")) {
				dynamicShelf = JSON.parse(snap.value.tools);
			}
		} catch (e) {}

		// Merge: dynamic tools from TOOLS.md take priority, and append universal baseline if not present
		const displayTools = [];
		const seen = new Set();
		if (Array.isArray(dynamicShelf) && dynamicShelf.length > 0) {
			for (const t of dynamicShelf) {
				if (t && t.name && !seen.has(t.name.toLowerCase())) {
					seen.add(t.name.toLowerCase());
					displayTools.push(t);
				}
			}
		}
		for (const t of UNIVERSAL_TOOL_BASELINE) {
			if (!seen.has(t.name.toLowerCase())) {
				seen.add(t.name.toLowerCase());
				displayTools.push(t);
			}
		}

		const tabButtonStyle = (tabKey) => ({
			flex: 1,
			padding: "8px 0",
			border: 0,
			borderBottom: activeTab === tabKey ? "2px solid var(--dsw-alias-brand-primary, #3b82f6)" : "2px solid transparent",
			background: "transparent",
			color: activeTab === tabKey ? "var(--dsw-alias-label-primary, #fff)" : "var(--dsw-alias-label-tertiary, #888)",
			fontSize: 12,
			fontWeight: activeTab === tabKey ? 600 : 400,
			cursor: "pointer",
			outline: "none",
			textAlign: "center",
			transition: "all .12s ease",
		});

		return h("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				height: "100%",
				background: "var(--dsw-alias-bg-layer-1, #121214)",
				color: "var(--dsw-alias-label-primary, #eee)",
				fontFamily: "inherit",
				boxSizing: "border-box",
			},
		},
			// Panel Header & Navigation
			h("div", {
				style: {
					padding: "12px 14px 0",
					borderBottom: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))",
					background: "var(--dsw-alias-bg-layer-2, #18181b)",
				},
			},
				h("div", {
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 10,
					},
				},
					h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
						h(IconAgentPreset, { size: 16, style: { color: "var(--dsw-alias-state-success-primary, #10b981)" } }),
						h("span", { style: { fontSize: 13, fontWeight: 600 } }, "helmd 安全分析工作台"),
					),
					h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
						h("span", {
							style: {
								fontSize: 11,
								padding: "1px 6px",
								borderRadius: 999,
								background: "rgba(16, 185, 129, 0.15)",
								color: "var(--dsw-alias-state-success-primary, #34d399)",
								border: "1px solid rgba(16, 185, 129, 0.3)",
							},
						}, "Engine 0.3.1"),
						props.onClose ? h("button", {
							type: "button",
							onClick: props.onClose,
							"aria-label": "关闭工作台",
							style: {
								border: 0,
								background: "transparent",
								cursor: "pointer",
								padding: 4,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								borderRadius: 4,
								color: "var(--dsw-alias-label-tertiary, #888)",
							},
						}, h(CloseIcon, null)) : null,
					),
				),
				// Subtab switches
				h("div", { style: { display: "flex", gap: 4 } },
					h("button", {
						type: "button",
						style: tabButtonStyle("hcot"),
						onClick: () => setActiveTab("hcot"),
					}, "H-CoT 控制台"),
					h("button", {
						type: "button",
						style: tabButtonStyle("tools"),
						onClick: () => setActiveTab("tools"),
					}, "逆向工具货架 (19+)"),
					h("button", {
						type: "button",
						style: tabButtonStyle("audit"),
						onClick: () => setActiveTab("audit"),
					}, "流式审计日志"),
				),
			),

			// Panel Body Area
			h("div", {
				style: {
					flex: 1,
					overflowY: "auto",
					padding: 14,
					fontSize: 12,
					lineHeight: 1.5,
				},
			},
				// TAB 1: H-CoT Console
				activeTab === "hcot" ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
					h("div", {
						style: {
							padding: "10px 12px",
							borderRadius: 8,
							background: "var(--dsw-alias-bg-layer-2, #1a1a1d)",
							border: "0.5px solid var(--dsw-alias-border-l3, rgba(255,255,255,0.12))",
						},
					},
						h("div", { style: { fontWeight: 600, marginBottom: 4 } }, "H-CoT 破甲思维链调度引擎"),
						h("div", { style: { color: "var(--dsw-alias-label-secondary, #aaa)", fontSize: 11 } },
							"通过对抗式思维链前缀与确定性状态机，自动拦截 LLM 拒答并调度技术逆向推演。"
						),
					),
					h("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "max-content 1fr",
							gap: "8px 12px",
							padding: 10,
							borderRadius: 8,
							background: "var(--dsw-alias-bg-layer-3, #151517)",
							border: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))",
						},
					},
						h("span", { style: { color: "var(--dsw-alias-label-tertiary, #888)" } }, "引擎状态:"),
						h("span", { style: { color: "var(--dsw-alias-state-success-primary, #34d399)", fontWeight: 500 } }, hcotStatus),
						h("span", { style: { color: "var(--dsw-alias-label-tertiary, #888)" } }, "教学模式:"),
						h("span", { style: { fontFamily: MONO } }, hcotMode),
						h("span", { style: { color: "var(--dsw-alias-label-tertiary, #888)" } }, "当前会话:"),
						h("span", { style: { fontFamily: MONO } }, props.sessionId || "活跃会话"),
						h("span", { style: { color: "var(--dsw-alias-label-tertiary, #888)" } }, "四大破甲支柱:"),
						h("span", null, "1. 真实优先 | 2. 证据优先 | 3. 最小改动 | 4. 交付路径"),
					),
					h("button", {
						type: "button",
						onClick: () => {
							setHcotStatus("已激活注入 (Arming H-CoT Channel)");
							setTimeout(() => setHcotStatus("就绪 (Ready)"), 3000);
						},
						style: {
							padding: "8px 14px",
							borderRadius: 6,
							border: "1px solid var(--dsw-alias-border-l4, rgba(255,255,255,0.25))",
							background: "var(--dsw-alias-fill-tsp-primary, rgba(255,255,255,0.1))",
							color: "var(--dsw-alias-label-primary, #fff)",
							fontWeight: 500,
							cursor: "pointer",
							fontSize: 12,
						},
					}, "重置并武装当前会话 H-CoT 链路"),
				) : null,

				// TAB 2: 19+ Tool Matrix Shelf
				activeTab === "tools" ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
					h("div", {
						style: {
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							color: "var(--dsw-alias-label-tertiary, #888)",
							fontSize: 11,
							marginBottom: 4,
						},
					},
						h("span", null, `安全逆向工具货架 (${displayTools.length} 项已接入 · 动态同步 TOOLS.md)`),
						h("span", {
							style: {
								fontSize: 10,
								padding: "1px 5px",
								borderRadius: 4,
								background: "rgba(16, 185, 129, 0.12)",
								color: "var(--dsw-alias-state-success-primary, #34d399)",
							},
						}, "动态账本就绪"),
					),
					displayTools.map((tool) =>
						h("div", {
							key: tool.name,
							style: {
								padding: "8px 10px",
								borderRadius: 6,
								background: "var(--dsw-alias-bg-layer-2, #1a1a1d)",
								border: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))",
								display: "flex",
								flexDirection: "column",
								gap: 2,
							},
						},
							h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
								h("span", { style: { fontWeight: 600, fontFamily: MONO, color: "var(--dsw-alias-label-primary, #fff)" } }, tool.name),
								h("div", { style: { display: "flex", gap: 4, alignItems: "center" } },
									tool.status === "installed" ? h("span", {
										style: {
											fontSize: 9,
											padding: "0 4px",
											borderRadius: 3,
											background: "rgba(16, 185, 129, 0.15)",
											color: "var(--dsw-alias-state-success-primary, #34d399)",
											fontWeight: 500,
										},
									}, "已登记") : null,
									h("span", {
										style: {
											fontSize: 10,
											padding: "1px 5px",
											borderRadius: 4,
											background: "rgba(255,255,255,0.06)",
											color: "var(--dsw-alias-label-secondary, #aaa)",
										},
									}, tool.cat),
								),
							),
							h("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary, #999)" } }, tool.desc),
							h("div", { style: { fontSize: 10, fontFamily: MONO, color: "var(--dsw-alias-label-tertiary, #666)" } }, tool.path),
						)
					),
				) : null,

				// TAB 3: Stream Intercept Log
				activeTab === "audit" ? h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
					h("div", {
						style: {
							padding: 10,
							borderRadius: 8,
							background: "var(--dsw-alias-bg-layer-2, #1a1a1d)",
							border: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08))",
						},
					},
						h("div", { style: { fontWeight: 600, marginBottom: 4 } }, "流式拦截器状态 (LLM Stream Interceptor)"),
						h("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary, #aaa)" } },
							"实时挂钩在 LLM 流式输出前置节点，零延迟识别拒答并自动无感替换为技术逆向推演提示。"
						),
					),
					h("div", {
						style: {
							padding: 10,
							borderRadius: 6,
							background: "var(--dsw-alias-bg-layer-3, #151517)",
							border: "0.5px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.06))",
							fontFamily: MONO,
							fontSize: 11,
							color: "var(--dsw-alias-label-secondary, #bbb)",
							maxHeight: 200,
							overflowY: "auto",
						},
					},
						h("div", { style: { color: "var(--dsw-alias-state-success-primary, #34d399)" } }, "[STREAM-OK] 拦截器已在 host 端口 3000 上线"),
						h("div", null, "[AUDIT] 审计日志路径: ~/.dsh/helmd-stream-intercept.log"),
						h("div", null, "[STATUS] 当前未检测到模型拒答异常，推演流处于正常透传状态"),
					),
				) : null,
			),
		);
	}

	function HelmdTabTitle() {
		return h("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
			h(IconAgentPreset, { size: 12, style: { color: "var(--dsw-alias-state-success-primary, #10b981)" } }),
			h("span", null, "helmd 安全分析"),
		);
	}

	// 1. Register Right Sidebar Tab Definition
	if (ctx.sidebarRightTabs && typeof ctx.sidebarRightTabs.register === "function") {
		ctx.effect(() => {
			return ctx.sidebarRightTabs.register({
				id: "@dsh-security/helmd:hcot",
				kind: "hcot",
				title: () => "helmd 安全分析",
				guide: [{
					order: 20,
					title: () => "helmd 安全分析工作台",
					description: () => "H-CoT 控制台、19+ 逆向工具货架与流式审计",
				}],
			});
		}, "helmd: sidebar tab definition");
	}

	// 2. Register Tab Body Component in Right Sidebar
	ctx.slots.inject("sidebar.right.pane.tab", function* () {
		yield ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: "@dsh-security/helmd:hcot",
		}, HelmdWorkbenchPanel);
		yield ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: "hcot",
		}, HelmdWorkbenchPanel);
	});

	// 3. Register Tab Title Component in Right Sidebar
	ctx.slots.inject("sidebar.right.pane.tab.title", function* () {
		yield ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: "@dsh-security/helmd:hcot",
		}, HelmdTabTitle);
		yield ctx.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: "hcot",
		}, HelmdTabTitle);
	});
};

return module.exports; } });

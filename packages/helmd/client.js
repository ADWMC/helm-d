window.__ModuleLoader__.load({ id: "@dsh-security/helmd", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
/**
 * helmd settings card (browser half).
 *
 * Hand-authored in the lazy-CJS factory format the client module system loads
 * (same shape the official tsdown clientBundle preset emits). Renders a
 * read-only health card for the `helmd` settings namespace inside
 * Settings → Plugins → Plugin configuration. The values are composed at host
 * boot by dist/health.js; this card only projects them.
 *
 * Externals: react is a platform seed module; the `settingsScope`/`slots`
 * services arrive through cordis injection, ordered by dsh.client.inject.
 */
const React = require("react");
const h = React.createElement;

const NS = "helmd";

const STATUS_COLOR = {
	OK: "#1b7f4d",
	HOST_UPGRADED: "#b45309",
	STALE: "#b91c1c",
	LEGACY_PRESET: "#6d28d9",
	NOT_DEPLOYED: "#64748b",
	UNKNOWN: "#64748b",
};
const STATUS_LABEL = {
	OK: "健康 Healthy",
	HOST_UPGRADED: "宿主已升级 Host upgraded",
	STALE: "内容漂移 Content drift",
	LEGACY_PRESET: "旧版产物 Legacy preset",
	NOT_DEPLOYED: "未部署 Not deployed",
	UNKNOWN: "无法评估 Unknown",
};

const liStyle = {
	listStyle: "none",
	border: "1px solid rgba(127,127,127,.28)",
	borderRadius: 10,
	padding: "12px 14px",
	margin: 0,
	fontSize: 13,
	lineHeight: 1.55,
};
const headStyle = { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" };
const nameStyle = { fontWeight: 600, fontSize: 14 };
const badgeStyle = (color) => ({
	color: "#fff",
	background: color,
	borderRadius: 999,
	padding: "1px 8px",
	fontSize: 11,
	whiteSpace: "nowrap",
});
const detailStyle = { margin: "6px 0 10px", opacity: 0.85 };
const rowsStyle = { margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "2px 12px" };
const dtStyle = { opacity: 0.65, whiteSpace: "nowrap" };
const ddStyle = { margin: 0, fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace", fontSize: 12, wordBreak: "break-all" };

function row(label, value) {
	return [h("dt", { key: label + "-t", style: dtStyle }, label), h("dd", { key: label + "-d", style: ddStyle }, value)];
}

exports.inject = ["slots", "settingsScope"];

exports.apply = function apply(ctx) {
	let scope;
	try {
		scope = ctx.settingsScope.bind({ namespace: NS });
	} catch {
		console.error("[helmd] settingsScope unavailable; card not registered");
		return;
	}

	function HelmdHealthCard() {
		const state = React.useState(() => scope.getSnapshot());
		const snap = state[0];
		const setSnap = state[1];
		React.useEffect(() => scope.subscribe(() => setSnap(scope.getSnapshot())), []);
		if (!snap || snap.status === "loading") {
			return h("li", { style: liStyle }, "helmd · loading…");
		}
		const v = snap.value || {};
		const status = typeof v.status === "string" ? v.status : "UNKNOWN";
		const color = STATUS_COLOR[status] || STATUS_COLOR.UNKNOWN;
		const label = STATUS_LABEL[status] || status;
		const rows = [];
		if (v.detail) rows.push(row("说明 Detail", v.detail));
		if (v.hostFingerprint) rows.push(row("宿主指纹 Host fp", v.hostFingerprint + (v.presetFingerprint ? "" : "")));
		if (v.presetFingerprint) rows.push(row("产物指纹 Preset fp", v.presetFingerprint));
		if (v.version) rows.push(row("版本 Version", v.version));
		if (v.checkedAt) rows.push(row("评估于 Checked at", v.checkedAt));
		if (v.presetPath) rows.push(row("部署 Preset", v.presetPath));
		if (v.hostPath) rows.push(row("宿主 standard", v.hostPath));
		rows.push(row("提示 Hint", "重启 dsh 后重新评估 · evaluated once per dsh boot"));
		return h("li", { style: liStyle },
			h("div", { style: headStyle },
				h("span", { style: nameStyle }, "helmd 安全分析包"),
				h("span", { style: badgeStyle(color) }, label)),
			v.detail ? h("p", { style: detailStyle }, v.detail) : null,
			h("dl", { style: rowsStyle }, rows),
		);
	}

	ctx.slots.inject("settings.plugin.item", function* () {
		yield ctx.slots.register({
			name: "settings.plugin.item",
			key: NS,
			inject: () => ({}),
		}, HelmdHealthCard);
	});
};

return module.exports; } });

// Analysis intensity ladder — ponytail-style: one source of truth, three rungs.
// The model picks the first rung that holds; the contract text is the whole
// spec. State is per-session and in-memory by design: mode is a session-level
// intent, not durable config.

export type Level = 'lite' | 'full' | 'deep'

export const LEVELS: Level[] = ['lite', 'full', 'deep']
export const DEFAULT_LEVEL: Level = 'full'

const CONTRACT: Record<Level, string> = {
  lite:
    '快速分诊档：triage_artifact / hash_artifact / scan_strings / detect_packer 为主。' +
    '单一结论行 + 一句依据，不做证据链，不建 case，不读长文档（decision-tree 可读）。',
  full:
    '标准分析档（默认）：按 references/toolbox/decision-tree.md 全流程走，' +
    '关键结论附依据与工具输出摘要，需要时读对应领域 reference。',
  deep:
    '深度取证档：create_case 建结构化工作区，timeline/workitems 记录每步，' +
    '结论按 severity/confidence 分级并按 references/evidence/reporting.md 出报告。' +
    '外部工具记录版本、命令、时间戳、输入哈希。',
}

const sessions = new Map<string, Level>()

function keyOf(sessionId?: string): string {
  return sessionId ?? '__global__'
}

export function getLevel(sessionId?: string): Level {
  return sessions.get(keyOf(sessionId)) ?? DEFAULT_LEVEL
}

export function setLevel(level: Level, sessionId?: string): void {
  sessions.set(keyOf(sessionId), level)
}

export function normalizeLevel(v: unknown): Level | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  return (LEVELS as string[]).includes(s) ? (s as Level) : null
}

export function renderContract(level: Level): string {
  const lines = [
    `helmd analysis level: ${level}`,
    '',
    ...LEVELS.map((l) => `${l === level ? '* ' : '  '}${l}: ${CONTRACT[l]}`),
    '',
    'Switch: analysis_mode {level}. Pick the shallowest rung that answers the task.',
  ]
  return lines.join('\n')
}

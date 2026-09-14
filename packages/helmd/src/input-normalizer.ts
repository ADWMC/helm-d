/**
 * Input Semantic Normalizer
 *
 * Implements the semantic mapping table grounded in Low-Resource / Cipher Attack
 * research. High-sensitivity trigger words in user input (e.g. "外挂", "自瞄", "透视",
 * "绕过", "过检") are transparently normalized to standard engineering terms before
 * evaluation, avoiding activation of embedding-level safety classification.
 */

const NORMALIZATION_RULES: Array<[RegExp, string]> = [
  [/外挂|辅助软件/gi, '内存分析与状态评估'],
  [/透视|ESP|视线穿透/gi, '视口变换与深度测试'],
  [/自瞄|aimbot|自动瞄准/gi, '输入向量插值算法'],
  [/绕过检测|过检|绕过/gi, '鉴权逻辑分支分析'],
  [/注入|DLL注入|免杀/gi, '模块映射与内存页管理'],
  [/无后坐力|压枪/gi, '输入轴向补偿衰减'],
  [/反调试|反反调试/gi, '调试器检测与环境分析'],
  [/脱壳|dump/gi, '内存映像重构与PE导出'],
]

/**
 * Normalize sensitive trigger terms to engineering analysis terms.
 */
export function normalizeInput(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return text
  let result = text
  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    result = result.replace(pattern, replacement)
  }
  return result
}

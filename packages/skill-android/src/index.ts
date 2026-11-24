import type { Context } from '@deepseek-ai/cordis'

export const name = 'skill-android'
export const inject = ['tools']

// This legacy package contributes no home-grown analysis tools.
export function apply(_ctx: Context): void {}

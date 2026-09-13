export type PollType = 'regular' | 'multiple' | 'number' | 'ranked_choice'
export type PollResults = 'always' | 'on_vote' | 'on_close' | 'staff_only'
export type PollChart = 'bar' | 'pie'

export interface PollConfig {
  type: PollType
  results: PollResults
  public: boolean
  chartType: PollChart
  title: string
  /** One option per line. */
  optionsText: string
  /** Integers as typed; empty means the default for the type. */
  min: string
  max: string
  step: string
  /** `datetime-local` value; empty for no close time. */
  close: string
}

export type PollProblem = 'tooFewOptions' | 'tooManyOptions' | 'duplicate' | 'minMax' | 'number' | 'closePast'

/** The poll plugin's `poll_maximum_options` default; the site value isn't exposed to API clients. */
export const POLL_MAXIMUM_OPTIONS = 20

/** Defaults the web builder uses for number polls. */
const NUMBER_DEFAULTS = { min: 1, max: 10, step: 1 }

export function defaultPoll(): PollConfig {
  return {
    type: 'regular',
    results: 'always',
    public: false,
    chartType: 'bar',
    title: '',
    optionsText: '',
    min: '',
    max: '',
    step: '',
    close: ''
  }
}

function integer(value: string, fallback: number): number {
  const trimmed = value.trim()
  if (trimmed === '') return fallback
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

export function pollOptions(config: PollConfig): string[] {
  return config.optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function numberRange(config: PollConfig): { min: number; max: number; step: number } {
  return {
    min: integer(config.min, NUMBER_DEFAULTS.min),
    max: integer(config.max, NUMBER_DEFAULTS.max),
    step: integer(config.step, NUMBER_DEFAULTS.step)
  }
}

function multipleRange(config: PollConfig, optionCount: number): { min: number; max: number } {
  return { min: integer(config.min, 1), max: integer(config.max, optionCount) }
}

/** The poll plugin's server-side validation, mirrored so the builder never inserts a poll the server rejects. */
export function validatePoll(config: PollConfig, now: number = Date.now()): PollProblem | null {
  if (config.close && !(new Date(config.close).getTime() > now)) return 'closePast'

  if (config.type === 'number') {
    const { min, max, step } = numberRange(config)
    const valid = min >= 0 && max >= min && step > 0 && (max - min + 1) / step >= 2
    return valid ? null : 'number'
  }

  const options = pollOptions(config)
  if (options.length < 2) return 'tooFewOptions'
  if (options.length > POLL_MAXIMUM_OPTIONS) return 'tooManyOptions'
  if (new Set(options).size !== options.length) return 'duplicate'

  if (config.type === 'multiple') {
    const { min, max } = multipleRange(config, options.length)
    const invalid = Number.isNaN(min) || Number.isNaN(max) || min > max || min <= 0 || max > options.length || min >= options.length
    if (invalid) return 'minMax'
  }
  return null
}

/** Existing polls in a post; a second poll needs a unique `name`. */
export function countPolls(raw: string): number {
  return raw.match(/\[poll(?=[\s\]])/gi)?.length ?? 0
}

/** `[poll …]` Markdown in the same attribute order as the web builder. */
export function buildPollMarkdown(config: PollConfig, name?: string): string {
  const attributes: string[] = []
  if (name) attributes.push(`name=${name}`)
  attributes.push(`type=${config.type}`, `results=${config.results}`)

  const options = pollOptions(config)
  if (config.type === 'multiple') {
    const { min, max } = multipleRange(config, options.length)
    attributes.push(`min=${min}`, `max=${max}`)
  } else if (config.type === 'number') {
    const { min, max, step } = numberRange(config)
    attributes.push(`min=${min}`, `max=${max}`, `step=${step}`)
  }
  attributes.push(`public=${config.public}`)
  if (config.type !== 'number') attributes.push(`chartType=${config.chartType}`)
  if (config.close) attributes.push(`close=${new Date(config.close).toISOString()}`)

  const lines = [`[poll ${attributes.join(' ')}]`]
  if (config.title.trim()) lines.push(`# ${config.title.trim()}`)
  if (config.type !== 'number') lines.push(...options.map((option) => `* ${option}`))
  lines.push('[/poll]')
  return lines.join('\n')
}

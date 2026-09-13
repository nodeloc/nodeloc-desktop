import { apiRequest } from '../../api/client'

/** Form state; numbers stay strings while being typed. Shares are always random. */
export interface RedEnvelopeConfig {
  totalPoints: string
  totalCount: string
}

export type RedEnvelopeProblem = 'count' | 'points' | 'balance'

export const RED_ENVELOPE_MAX_COUNT = 100
/** Each share must average at least this many points (which also covers the 10-point minimum). */
export const RED_ENVELOPE_MIN_PER_SHARE = 10

export function defaultRedEnvelope(): RedEnvelopeConfig {
  return { totalPoints: '100', totalCount: '10' }
}

function integer(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN
}

/** discourse-red-envelope's checks; `balance` is the user's energy when known. */
export function validateRedEnvelope(config: RedEnvelopeConfig, balance?: number): RedEnvelopeProblem | null {
  const count = integer(config.totalCount)
  if (!(count >= 1 && count <= RED_ENVELOPE_MAX_COUNT)) return 'count'
  const points = integer(config.totalPoints)
  if (!(points >= RED_ENVELOPE_MIN_PER_SHARE && points >= count * RED_ENVELOPE_MIN_PER_SHARE)) return 'points'
  if (balance !== undefined && points > balance) return 'balance'
  return null
}

/** Must run after the topic is created and before anyone replies; one envelope per topic. */
export async function createRedEnvelope(topicId: number, config: RedEnvelopeConfig): Promise<void> {
  await apiRequest({
    method: 'POST',
    path: '/red-envelopes.json',
    form: [
      ['topic_id', topicId],
      ['total_points', integer(config.totalPoints)],
      ['total_count', integer(config.totalCount)]
    ],
    priority: 'user'
  })
}

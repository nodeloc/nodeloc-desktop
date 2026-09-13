import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import { RefusedError } from './errors'

export interface LotteryLevel {
  name: string
  prize: string
  /** Integer as typed. */
  quantity: string
}

/** Form state; numbers stay strings while being typed. */
export interface LotteryConfig {
  /** Empty uses the topic title. */
  title: string
  /** `datetime-local` value. */
  drawAt: string
  minParticipants: string
  /** 0 or less means unlimited. */
  maxParticipants: string
  minTickets: string
  maxTickets: string
  minTrustLevel: string
  levels: LotteryLevel[]
}

export type LotteryProblemKey = 'drawAt' | 'participants' | 'cap' | 'tickets' | 'trustLevel' | 'levels' | 'level' | 'banned'

export interface LotteryProblem {
  key: LotteryProblemKey
  values?: Record<string, string | number>
}

/** `GET /lottery/limits`. Non-staff `min_participants` must stay at or under the cap. */
export interface LotteryLimits {
  min_participants_cap: number | null
  median_days?: number
}

const DAY_MS = 86_400_000
const MAX_DRAW_DAYS = 30

/**
 * The plugin's banned prize words: Chinese terms match anywhere, Latin terms
 * on word boundaries, case-insensitive.
 */
const BANNED_PRIZE =
  /(现金|人民币|转账|提现|银行卡|支付宝|微信|红包|礼品卡|购物卡|话费|实物|包邮|快递|邮寄|Q币)|\b(usdt|cash|gift card|giftcard|voucher|paypal|venmo|alipay|wechat|bank transfer)\b/i

function integer(value: string): number {
  return /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN
}

/** A `datetime-local` input value in local time. */
export function localDateTimeValue(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The web UI's defaults: draw in a week, up to 10 tickets each, trust level 1. */
export function defaultLottery(): LotteryConfig {
  return {
    title: '',
    drawAt: localDateTimeValue(new Date(Date.now() + 7 * DAY_MS)),
    minParticipants: '1',
    maxParticipants: '0',
    minTickets: '1',
    maxTickets: '10',
    minTrustLevel: '1',
    levels: [{ name: '', prize: '', quantity: '1' }]
  }
}

/** Client-side checks before posting; `POST /lottery/validate` runs the server's. */
export function validateLottery(
  config: LotteryConfig,
  { cap, staff, now = Date.now() }: { cap: number | null; staff: boolean; now?: number }
): LotteryProblem | null {
  const drawAt = new Date(config.drawAt).getTime()
  if (!Number.isFinite(drawAt) || drawAt <= now || drawAt > now + MAX_DRAW_DAYS * DAY_MS) return { key: 'drawAt' }

  const minParticipants = integer(config.minParticipants)
  const maxParticipants = integer(config.maxParticipants)
  if (!(minParticipants >= 1) || Number.isNaN(maxParticipants) || (maxParticipants > 0 && minParticipants >= maxParticipants)) {
    return { key: 'participants' }
  }
  if (!staff && cap !== null && minParticipants > cap) return { key: 'cap', values: { cap } }

  const minTickets = integer(config.minTickets)
  const maxTickets = integer(config.maxTickets)
  if (!(minTickets >= 1) || !(maxTickets >= minTickets)) return { key: 'tickets' }

  const trustLevel = integer(config.minTrustLevel)
  if (!(trustLevel >= 0 && trustLevel <= 4)) return { key: 'trustLevel' }

  if (config.levels.length === 0) return { key: 'levels' }
  for (const level of config.levels) {
    if (!level.name.trim() || !level.prize.trim() || !(integer(level.quantity) >= 1)) return { key: 'level' }
    const banned = BANNED_PRIZE.exec(`${level.name} ${level.prize}`)
    if (banned) return { key: 'banned', values: { word: banned[0] } }
  }
  return null
}

/** The JSON body shared by validate and create (create adds `post_id`). */
export function lotteryBody(config: LotteryConfig, fallbackTitle: string) {
  return {
    title: config.title.trim() || fallbackTitle,
    min_participants: integer(config.minParticipants),
    max_participants: integer(config.maxParticipants),
    min_tickets_per_user: integer(config.minTickets),
    max_tickets_per_user: integer(config.maxTickets),
    min_trust_level: integer(config.minTrustLevel),
    draw_at: new Date(config.drawAt).toISOString(),
    levels: config.levels.map((level) => ({ name: level.name.trim(), prize: level.prize.trim(), quantity: integer(level.quantity) }))
  }
}

export type LotteryBody = ReturnType<typeof lotteryBody>

interface LotteryReply {
  success?: boolean
  error?: string
}

/** Participant, ticket and prize checks only; 422 or `success:false` when refused. */
export async function validateLotteryOnServer(body: LotteryBody): Promise<void> {
  const reply = await apiRequest<LotteryReply>({ method: 'POST', path: '/lottery/validate', json: body, priority: 'user' })
  if (reply.success === false) throw new RefusedError(reply.error ?? '')
}

/** After the post exists. Author or staff only; one lottery per post. */
export async function createLottery(postId: number, body: LotteryBody): Promise<void> {
  const reply = await apiRequest<LotteryReply>({ method: 'POST', path: '/lottery', json: { post_id: postId, ...body }, priority: 'user' })
  if (reply.success === false) throw new RefusedError(reply.error ?? '')
}

export function useLotteryLimits(enabled: boolean) {
  return useQuery({
    queryKey: ['lottery', 'limits'],
    queryFn: () => apiRequest<LotteryLimits>({ path: '/lottery/limits' }),
    enabled,
    staleTime: 10 * 60_000
  })
}

import { Trophy } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { useCategoryIndex } from '../../api/site'
import type { TopicView } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { showToast } from '../../components/toast-store'
import { CURRENT_USER_KEY, useCurrentUser } from '../account/use-session'
import styles from './PostDialogs.module.css'

/** `featured_topic_default_bonus_points` default; the setting itself isn't exposed to API clients. */
const DEFAULT_BONUS = 50
const MAX_BONUS = 99999

interface ToggleResponse {
  is_featured: boolean
  bonus_points: number
}

/**
 * discourse-featured-topic lets the site's featuring groups
 * (`current_user.can_feature_topics`) and anyone who can edit the topic's
 * node (`can_edit_community` on the category) feature it.
 */
export function useCanFeatureTopic(topic: TopicView | undefined): boolean {
  const user = useCurrentUser()
  const index = useCategoryIndex()
  if (!topic || !user || topic.archetype === 'private_message') return false
  return Boolean(user.can_feature_topics || index?.byId.get(topic.category_id)?.can_edit_community)
}

/**
 * `POST /discourse-featured-topic/toggle/:topicId` with optional
 * `bonus_points` for the author. Staff bonuses are minted by the system;
 * anyone else pays from their own balance. Unfeaturing takes the bonus back.
 */
export function FeatureTopicDialog({ topic, open, onClose }: { topic: TopicView; open: boolean; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const [bonus, setBonus] = useState(DEFAULT_BONUS)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const featured = Boolean(topic.is_featured)
  const ownTopic = user !== undefined && topic.user_id === user.id
  const staff = Boolean(user?.staff || user?.admin || user?.moderator)
  // The server moves no points when you feature your own topic.
  const showBonus = !featured && !ownTopic
  const validBonus = Number.isInteger(bonus) && bonus >= 0 && bonus <= MAX_BONUS

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (showBonus && !validBonus) return
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<ToggleResponse>({
        method: 'POST',
        path: `/discourse-featured-topic/toggle/${topic.id}`,
        form: [['bonus_points', showBonus ? bonus : 0]],
        priority: 'user'
      })
      showToast(
        result.is_featured
          ? result.bonus_points > 0
            ? t('interactions.feature.featuredWithPoints', { points: result.bonus_points })
            : t('interactions.feature.featured')
          : t('interactions.feature.unfeatured'),
        'success'
      )
      void queryClient.invalidateQueries({ queryKey: ['topic', topic.id] })
      if (result.bonus_points > 0 && !staff) void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={featured ? t('interactions.feature.unfeatureTitle') : t('interactions.feature.featureTitle')}
      width={420}
    >
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <p className={styles.text}>
          {featured ? t('interactions.feature.unfeatureDescription') : t('interactions.feature.featureDescription')}
        </p>
        {showBonus && (
          <label className={styles.field}>
            <span>{staff ? t('interactions.feature.bonus') : t('interactions.feature.bonusOwn')}</span>
            <input
              type="number"
              min={0}
              max={MAX_BONUS}
              step={1}
              value={Number.isFinite(bonus) ? bonus : ''}
              onChange={(event) => setBonus(Math.floor(Number(event.target.value)))}
            />
          </label>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || (showBonus && !validBonus)} icon={<Trophy />}>
            {featured ? t('interactions.feature.unfeature') : t('interactions.feature.feature')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

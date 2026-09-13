import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { paths } from '../lib/routes'

export function NotFoundPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={<Compass />}
      title={t('common.notFound')}
      action={
        <Button variant="primary" onClick={() => navigate(paths.home())}>
          {t('nav.home')}
        </Button>
      }
    />
  )
}

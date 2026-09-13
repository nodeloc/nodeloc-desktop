import { PenLine } from 'lucide-react'
import { Button } from '../../components/Button'
import { useRequireSignIn } from '../account/use-session'
import { useComposer } from '../composer/composer-store'
import styles from './NewTopicButton.module.css'

interface NewTopicButtonProps {
  label: string
  /** Preselects the node in the composer. */
  categoryId?: number
  disabled?: boolean
}

/** Full-width compose action at the top of a sidebar. Signed-out clicks open sign-in. */
export function NewTopicButton({ label, categoryId, disabled }: NewTopicButtonProps): React.JSX.Element {
  const requireSignIn = useRequireSignIn()

  const open = (): void => {
    if (!requireSignIn()) return
    useComposer.getState().openNewTopic(categoryId === undefined ? {} : { categoryId })
  }

  return (
    <div className={styles.wrap}>
      <Button
        variant="primary"
        icon={<PenLine strokeWidth={2.5} />}
        className={styles.button}
        disabled={disabled}
        onClick={open}
      >
        {label}
      </Button>
    </div>
  )
}

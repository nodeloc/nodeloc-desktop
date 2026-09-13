import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '../../components/Dialog'
import styles from './Shortcuts.module.css'
import { useShortcutsUi } from './shortcuts-store'

interface ShortcutRow {
  /** Each inner array is one chord; chords are pressed one after another. */
  keys: string[][]
  label: string
}

export function Kbd({ children }: { children: string }): React.JSX.Element {
  return <kbd className={styles.kbd}>{children}</kbd>
}

/** `?` — every shortcut the app handles (KEY-*). */
export function ShortcutHelpDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const open = useShortcutsUi((state) => state.helpOpen)
  const setOpen = useShortcutsUi((state) => state.setHelpOpen)

  const groups: Array<{ title: string; rows: ShortcutRow[] }> = [
    {
      title: t('shortcuts.help.groups.general'),
      rows: [
        { keys: [['Ctrl', 'K']], label: t('shortcuts.keys.quickSwitcher') },
        { keys: [['/']], label: t('shortcuts.keys.search') },
        { keys: [['Ctrl', 'Shift', 'F']], label: t('shortcuts.keys.searchSite') },
        { keys: [['N']], label: t('shortcuts.keys.newTopic') },
        { keys: [['Ctrl', ',']], label: t('shortcuts.keys.settings') },
        { keys: [['?']], label: t('shortcuts.keys.help') }
      ]
    },
    {
      title: t('shortcuts.help.groups.navigation'),
      rows: [
        { keys: [['G'], ['H']], label: t('shortcuts.keys.goHome') },
        { keys: [['G'], ['I']], label: t('shortcuts.keys.goInbox') },
        { keys: [['G'], ['C']], label: t('shortcuts.keys.goChat') }
      ]
    },
    {
      title: t('shortcuts.help.groups.reading'),
      rows: [
        { keys: [['J']], label: t('shortcuts.keys.next') },
        { keys: [['K']], label: t('shortcuts.keys.previous') },
        { keys: [['Enter']], label: t('shortcuts.keys.open') },
        { keys: [['R']], label: t('shortcuts.keys.reply') }
      ]
    }
  ]

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('shortcuts.help.title')} width={460}>
      <div className={styles.groups}>
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            {group.rows.map((row) => (
              <div key={row.label} className={styles.row}>
                <span>{row.label}</span>
                <span className={styles.keys}>
                  {row.keys.map((chord, index) => (
                    <Fragment key={index}>
                      {index > 0 && <span>{t('shortcuts.help.then')}</span>}
                      {chord.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </Fragment>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className={styles.hint}>{t('shortcuts.help.hint')}</p>
    </Dialog>
  )
}

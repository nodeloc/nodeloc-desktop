import { Bell, Search, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from '../../components/Avatar'
import { Button, IconButton } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { showToast } from '../../components/toast-store'
import { VoteRail } from '../vote/VoteRail'
import styles from './Gallery.module.css'

const CORE_COLORS = [
  'bg',
  'surface',
  'text',
  'divider',
  'accent',
  'accent-2',
  'selected',
  'hover',
  'highlight',
  'danger',
  'success',
  'love',
  'link'
]
const RAMPS = {
  neutral: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  accent: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  'accent-2': [100, 500, 600]
}
const TYPE_SCALE = [
  { size: 32, weight: 600, label: '设置页首 32' },
  { size: 26, weight: 700, label: '页面大标题 26' },
  { size: 24, weight: 600, label: '帖子标题 24' },
  { size: 16, weight: 400, label: '帖子正文 16' },
  { size: 14, weight: 400, label: '回复 14' },
  { size: 12, weight: 400, label: '元信息 12' }
]
const SPACES = ['1', '2', '3', '4', '6', '8']

/**
 * Development-only reference of every token and base component, in both
 * themes (use the appearance switch in the sidebar). Visual regressions show
 * up here first.
 */
export function Gallery(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>设计系统</h1>

      <Section title="核心色彩">
        <div className={styles.swatches}>
          {CORE_COLORS.map((name) => (
            <Swatch key={name} name={`--${name}`} />
          ))}
        </div>
      </Section>

      <Section title="色阶">
        {Object.entries(RAMPS).map(([ramp, steps]) => (
          <div key={ramp} className={styles.ramp}>
            {steps.map((step) => (
              <Swatch key={step} name={`--${ramp}-${step}`} compact />
            ))}
          </div>
        ))}
      </Section>

      <Section title="字体">
        {TYPE_SCALE.map(({ size, weight, label }) => (
          <p key={size} style={{ fontSize: size, fontWeight: weight, lineHeight: 1.3 }}>
            {label} · 自由、平等、友好、开放、有趣 NodeLoc
          </p>
        ))}
      </Section>

      <Section title="间距与圆角">
        <div className={styles.row}>
          {SPACES.map((space) => (
            <div key={space} className={styles.spaceSample}>
              <span style={{ width: `var(--space-${space})`, height: `var(--space-${space})` }} />
              space-{space}
            </div>
          ))}
        </div>
        <div className={styles.row}>
          {['sm', 'md', 'lg'].map((radius) => (
            <div key={radius} className={styles.radiusSample} style={{ borderRadius: `var(--radius-${radius})` }}>
              radius-{radius}
            </div>
          ))}
        </div>
      </Section>

      <Section title="加载动画">
        <div className={styles.row}>
          <Labeled label="Spinner 44 / 32 / 24 / 18 / 14">
            <div className={styles.row}>
              <Spinner size={44} />
              <Spinner size={32} />
              <Spinner size={24} />
              <Spinner size={18} />
              <Spinner size={14} />
            </div>
          </Labeled>
        </div>
      </Section>

      <Section title="按钮">
        <div className={styles.row}>
          <Button variant="primary">主要操作</Button>
          <Button>次要操作</Button>
          <Button variant="ghost">幽灵按钮</Button>
          <Button variant="primary" disabled>
            已禁用
          </Button>
          <Button size="sm" icon={<Bell />}>
            小按钮
          </Button>
          <IconButton label="搜索">
            <Search />
          </IconButton>
          <IconButton label="通知" size="sm">
            <Bell />
          </IconButton>
        </div>
      </Section>

      <Section title="投票条">
        <div className={styles.row}>
          <VoteRail score={128} count={140} direction="none" canVoteUp canVoteDown onVote={() => undefined} />
          <VoteRail score={42} count={50} direction="up" canVoteUp canVoteDown onVote={() => undefined} />
          <VoteRail score={-6} count={9} direction="down" canVoteUp canVoteDown onVote={() => undefined} />
          <VoteRail score={0} count={0} direction="none" canVoteUp={false} canVoteDown={false} />
        </div>
      </Section>

      <Section title="头像">
        <div className={styles.row}>
          <Avatar username="nodeloc" size={48} />
          <Avatar username="demo-user" size={40} />
          <Avatar username="游客" size={32} />
          <Avatar username="z" size={24} />
        </div>
      </Section>

      <Section title="骨架屏">
        <SkeletonGroup className={styles.skeleton}>
          <div className={styles.row}>
            <SkeletonCircle size={32} />
            <SkeletonLine width={0.3} />
          </div>
          <SkeletonLine width={0.9} height={16} />
          <SkeletonLine width={0.6} />
        </SkeletonGroup>
      </Section>

      <Section title="空状态">
        <EmptyState
          icon={<WifiOff />}
          title="网络不可用，请检查网络连接"
          action={<Button variant="primary">重试</Button>}
        />
      </Section>

      <Section title="Toast">
        <div className={styles.row}>
          <Button onClick={() => showToast('已保存书签')}>普通</Button>
          <Button onClick={() => showToast('签到成功，获得 5 能量', 'success')}>成功</Button>
          <Button onClick={() => showToast('操作太频繁，请稍后再试', 'danger')}>失败</Button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ name, compact = false }: { name: string; compact?: boolean }): React.JSX.Element {
  return (
    <div className={compact ? styles.swatchCompact : styles.swatch}>
      <span className={styles.chip} style={{ background: `var(${name})` }} />
      <code>{name}</code>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <figure className={styles.labeled}>
      {children}
      <figcaption>{label}</figcaption>
    </figure>
  )
}

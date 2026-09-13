import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import styles from './TopicRowSkeleton.module.css'

const TITLE_WIDTHS = [0.82, 0.64, 0.9, 0.56, 0.74]

export function TopicRowSkeleton({ count }: { count: number }): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.row}>
          <div className={styles.vote}>
            <SkeletonLine width={1} height={52} />
          </div>
          <div className={styles.body}>
            <div className={styles.meta}>
              <SkeletonCircle size={18} />
              <SkeletonLine width={0.3} height={11} />
            </div>
            <SkeletonLine width={TITLE_WIDTHS[index % TITLE_WIDTHS.length]} height={16} />
            <SkeletonLine width={0.2} height={11} />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  )
}

import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import styles from './ReaderSkeleton.module.css'

export function ReaderSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.skeleton}>
      <SkeletonLine width={0.25} height={12} />
      <SkeletonLine width={0.8} height={26} />
      <div className={styles.author}>
        <SkeletonCircle size={40} />
        <SkeletonLine width={0.2} height={14} />
      </div>
      {[0.95, 0.9, 0.97, 0.6, 0.85].map((width, index) => (
        <SkeletonLine key={index} width={width} height={14} />
      ))}
      <div className={styles.divider} />
      {[0, 1, 2].map((index) => (
        <div key={index} className={styles.reply}>
          <div className={styles.author}>
            <SkeletonCircle size={28} />
            <SkeletonLine width={0.18} height={12} />
          </div>
          <SkeletonLine width={0.7} height={13} />
          <SkeletonLine width={0.45} height={13} />
        </div>
      ))}
    </SkeletonGroup>
  )
}

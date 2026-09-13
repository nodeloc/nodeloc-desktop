import { useTranslation } from 'react-i18next'
import { useLightbox, type LightboxImage } from '../../media/lightbox-store'
import styles from './ContentImage.module.css'

interface ContentImageProps {
  image: LightboxImage
  srcSet?: string
  /** All images of the post, so the lightbox can page between them. */
  images: LightboxImage[]
  index: number
}

/**
 * A post image. Reserves its box from the known width/height so text doesn't
 * jump as it loads, and opens the lightbox on click. Rendered as a span:
 * images sit inside paragraphs.
 */
export function ContentImage({ image, srcSet, images, index }: ContentImageProps): React.JSX.Element {
  const { t } = useTranslation()
  const open = useLightbox((state) => state.open)
  const ratio = image.width && image.height ? `${image.width} / ${image.height}` : undefined

  return (
    <span
      className={styles.frame}
      style={{ maxWidth: image.width ? `min(100%, ${image.width}px)` : undefined, aspectRatio: ratio }}
    >
      <img
        className={styles.image}
        src={image.thumb ?? image.src}
        srcSet={srcSet}
        alt={image.alt ?? ''}
        width={image.width}
        height={image.height}
        loading="lazy"
        draggable={false}
        title={t('content.image.open')}
        onClick={() => open(images, index)}
      />
    </span>
  )
}

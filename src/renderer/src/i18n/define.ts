/**
 * Declares one feature's copy. Chinese is the source; the English object must
 * have the same shape, so a missing translation is a type error.
 *
 * Messages are mounted under their namespace key, e.g. `t('reader.reply')`.
 */
export interface FeatureMessages<T> {
  'zh-CN': T
  en: T
}

export function defineMessages<T>(messages: { 'zh-CN': T; en: NoInfer<T> }): FeatureMessages<T> {
  return messages
}

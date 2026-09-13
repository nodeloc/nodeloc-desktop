import type { AppLanguage, LanguagePreference } from '@shared/bridge'
import i18n from './index'

export function systemLanguage(locale: string = navigator.language): AppLanguage {
  return locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export function resolveLanguage(preference: LanguagePreference, locale?: string): AppLanguage {
  return preference === 'system' ? systemLanguage(locale) : preference
}

export async function applyLanguage(preference: LanguagePreference): Promise<AppLanguage> {
  const language = resolveLanguage(preference)
  document.documentElement.lang = language
  if (i18n.resolvedLanguage !== language) await i18n.changeLanguage(language)
  return language
}

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import zhCN from './locales/zh-CN'
import { featureMessages } from './registry'

const zhFeatures = Object.fromEntries(Object.entries(featureMessages).map(([ns, m]) => [ns, m['zh-CN']]))
const enFeatures = Object.fromEntries(Object.entries(featureMessages).map(([ns, m]) => [ns, m.en]))

export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: { ...zhCN, ...zhFeatures } },
    en: { translation: { ...en, ...enFeatures } }
  },
  lng: navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en',
  fallbackLng: 'en',
  supportedLngs: ['zh-CN', 'en'],
  interpolation: { escapeValue: false }
})

export default i18n

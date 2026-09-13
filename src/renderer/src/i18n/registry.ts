import account from '../features/account/i18n'
import apps from '../features/apps/i18n'
import chat from '../features/chat/i18n'
import composer from '../features/composer/i18n'
import content from '../features/content/i18n'
import customFeeds from '../features/custom-feeds/i18n'
import inbox from '../features/inbox/i18n'
import interactions from '../features/interactions/i18n'
import media from '../features/media/i18n'
import nodeMod from '../features/node-mod/i18n'
import nodeModExtra from '../features/node-mod/i18n-extra'
import nodes from '../features/nodes/i18n'
import profile from '../features/profile/i18n'
import reader from '../features/reader/i18n'
import search from '../features/search/i18n'
import settings from '../features/settings/i18n'
import shortcuts from '../features/shortcuts/i18n'
import social from '../features/social/i18n'
import windows from '../features/windows/i18n'
import type { FeatureMessages } from './define'

/**
 * Every feature's copy, mounted under its namespace (`t('nodes.title')`).
 * Add a feature by importing its `i18n.ts` and listing it here.
 */
export const featureMessages: Record<string, FeatureMessages<object>> = {
  account,
  apps,
  chat,
  composer,
  content,
  customFeeds,
  shortcuts,
  windows,
  inbox,
  interactions,
  media,
  nodeMod,
  nodeModExtra,
  nodes,
  profile,
  reader,
  search,
  settings,
  social
}

/** The forum every request goes to. */
export const SITE_ORIGIN = 'https://www.nodeloc.com'

/** Hosts whose links route inside the app instead of the system browser. */
export const SITE_HOSTS: readonly string[] = ['www.nodeloc.com', 'nodeloc.com']

/** Custom URL scheme; also carries the User API Key callback `nodeloc://auth_redirect`. */
export const APP_PROTOCOL = 'nodeloc'

/** Session partition shared by API calls, the in-app browser and app webviews. */
export const SESSION_PARTITION = 'persist:nodeloc'

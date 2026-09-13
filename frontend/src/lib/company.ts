/**
 * Mugheer-Tech company identity — single source of truth (spec Section 27).
 * The footer, Contact page and dashboard all import from here; no page may
 * display different contact details.
 */
export const COMPANY = {
  name: 'Mugheer-Tech',
  tagline: 'Build. Monitor. Automate. Everything, connected.',
  email: 'mughammugheer@gmail.com',
  phone: '+92 304 0405194',
} as const;

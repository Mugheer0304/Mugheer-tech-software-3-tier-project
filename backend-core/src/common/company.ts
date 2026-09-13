/**
 * Mugheer-Tech company identity — single source of truth (spec Section 27).
 * Every surface that displays company contact details (invoice templates,
 * incident emails, footers) must reference these constants — never retype
 * them in place.
 */
export const COMPANY = {
  name: 'Mugheer-Tech',
  tagline: 'Build. Monitor. Automate. Everything, connected.',
  email: 'mughammugheer@gmail.com',
  phone: '+92 304 0405194',
  website: 'https://mugheer-tech.com',
} as const;

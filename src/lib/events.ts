/**
 * Event name constants — single source of truth for analytics taxonomy
 *
 * Why constants: typos in PostHog become silent (event just shows up as a
 * new name in the dashboard, never alerts). String constants make refactor
 * safe and let us grep call sites.
 */

export const EVENTS = {
  // Acquisition funnel
  LANDING_VIEW: 'landing_view',
  REGISTER_START: 'register_start',
  REGISTER_SUCCESS: 'register_success',

  // Activation
  FIRST_LOGIN: 'first_login',

  // Engagement
  TOOL_OPENED: 'tool_opened',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export const CATEGORIES = [
  { value: 'course',           label: 'Course',                   director: 'Golf Director',              ceiling: 10 },
  { value: 'competitions',     label: 'Competitions & Matches',    director: 'Golf Director',              ceiling: 7  },
  { value: 'clubhouse',        label: 'Clubhouse',                 director: 'Estate Director',            ceiling: 8  },
  { value: 'grounds',          label: 'Grounds (non-course)',      director: 'Estate Director',            ceiling: 6  },
  { value: 'refreshments',     label: 'On-course Refreshments',    director: 'Estate & F&B Director',      ceiling: 4  },
  { value: 'restaurant',       label: 'Restaurant / Catering',     director: 'F&B Director',               ceiling: 5  },
  { value: 'bar',              label: 'Bar',                       director: 'F&B Director',               ceiling: 6  },
  { value: 'pro_shop',         label: 'Pro Shop',                  director: 'Commercial Director',        ceiling: 3  },
  { value: 'other',            label: 'Other',                     director: 'Club Manager',               ceiling: 5  },
] as const

export type CategoryValue = typeof CATEGORIES[number]['value']

export const IMPACT_OPTIONS = [
  { value: 8, label: 'Affects all or most members' },
  { value: 6, label: 'Affects regular golfers' },
  { value: 4, label: 'Affects specific groups (seniors, juniors, ladies, visitors etc.)' },
  { value: 2, label: 'Affects occasional or visiting users only' },
] as const

export const RECOGNITION_OPTIONS = [
  { value: 'named',     label: 'Yes — record my name (required for award eligibility)' },
  { value: 'anonymous', label: 'No — I prefer not to be identified (not eligible for recognition awards)' },
] as const

export const STATUS_LABELS: Record<string, string> = {
  new:                 'Awaiting Decision',
  under_consideration: 'Under Consideration',
  approved:            'Approved',
  in_plan:             'In Plan',
  implemented:         'Implemented',
  rejected:            'Not Progressed',
  withdrawn:           'Withdrawn',
}

/** Statuses that should prompt for a target date when set by a director */
export const TARGET_DATE_STATUSES = new Set(['under_consideration', 'approved', 'in_plan'])

const ALL_CATEGORIES = ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop', 'other']

export const DIRECTOR_CATEGORIES: Record<string, string[]> = {
  'Golf Director':       ['course', 'competitions'],
  'Estate Director':     ['clubhouse', 'grounds', 'refreshments'],
  'F&B Director':        ['restaurant', 'bar', 'refreshments'],
  'Commercial Director': ['pro_shop'],
  'Men\'s Captain':      ['course', 'competitions'],
  'Women\'s Captain':    ['course', 'competitions'],
  'Finance Director':    ALL_CATEGORIES,
  'Club Manager':        ALL_CATEGORIES,
  'Super Admin':         ALL_CATEGORIES,
  'Chair of the Board':  ALL_CATEGORIES,
  'Operations Manager':  ALL_CATEGORIES,
}

/**
 * Returns the category list for a role. Any role not explicitly mapped
 * defaults to all categories so a newly created custom role sees everything
 * until the admin configures it further.
 */
export function getCategoriesForRole(role: string): string[] {
  return DIRECTOR_CATEGORIES[role] ?? ALL_CATEGORIES
}

/** Returns true for roles that have full management permissions (score override etc.) */
export function isManager(role: string): boolean {
  return role === 'Club Manager' || role === 'Super Admin' || role === 'Operations Manager' || role === 'Chair of the Board'
}

/** Decision authority levels — higher number = higher authority */
export const AUTHORITY_LEVELS: Record<string, number> = {
  director:            1,
  operations_manager:  2,
  club_manager:        3,
  chairman:            4,
}

/** Map a director role to its decision authority key */
export function roleToAuthority(role: string): string {
  if (role === 'Operations Manager') return 'operations_manager'
  if (role === 'Club Manager' || role === 'Super Admin') return 'club_manager'
  if (role === 'Chair of the Board') return 'chairman'
  return 'director'
}

/** Returns true if the given role can overwrite the current decision authority */
export function canOverrideAuthority(role: string, currentAuthority: string | null): boolean {
  if (!currentAuthority) return true
  const myLevel = AUTHORITY_LEVELS[roleToAuthority(role)] ?? 0
  const currentLevel = AUTHORITY_LEVELS[currentAuthority] ?? 0
  return myLevel >= currentLevel
}

/**
 * Default spend signoff limits (£) per authority key.
 * Stored in the config table and editable via Admin — these are fallback defaults only.
 */
export const DEFAULT_SPEND_LIMITS: Record<string, number> = {
  director:            0,
  operations_manager:  2500,
  club_manager:        10000,
  chairman:            999999,
}

/**
 * Returns true if a decision at the given authority level is fully finalised —
 * i.e. the confirmed cost is within that authority's spend limit (or no confirmed
 * cost has been set yet, in which case authority level alone determines finality).
 */
export function isDecisionFinalised(
  authority: string | null,
  confirmedCost: number | null,
  spendLimits: Record<string, number> = DEFAULT_SPEND_LIMITS
): boolean {
  if (!authority) return false
  if (confirmedCost === null) return true  // no cost set — authority level alone is sufficient
  const limit = spendLimits[authority] ?? 0
  return confirmedCost <= limit
}

/** Human-readable label for an authority key */
export const AUTHORITY_LABELS: Record<string, string> = {
  director:            'Director',
  operations_manager:  'Operations Manager',
  club_manager:        'Club Manager',
  chairman:            'Chair of the Board',
}

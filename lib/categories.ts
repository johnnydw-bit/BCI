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
  implemented:         'Implemented',
  rejected:            'Not Progressed',
  in_plan:             'In Plan',
  withdrawn:           'Withdrawn',
}

/** Statuses that should prompt for a target date when set by a director */
export const TARGET_DATE_STATUSES = new Set(['under_consideration', 'approved', 'in_plan'])

export const DIRECTOR_CATEGORIES: Record<string, string[]> = {
  'Golf Director':       ['course', 'competitions'],
  'Estate Director':     ['clubhouse', 'grounds', 'refreshments'],
  'F&B Director':        ['restaurant', 'bar', 'refreshments'],
  'Commercial Director': ['pro_shop'],
  'Club Manager':        ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop', 'other'],
  'Super Admin':         ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop', 'other'],
  'Chairman':            ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop', 'other'],
  'Chair':               ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop', 'other'],
  'Operations Manager':  ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop', 'other'],
}

/** Returns true for roles that have full management permissions */
export function isManager(role: string): boolean {
  return role === 'Club Manager' || role === 'Super Admin'
}

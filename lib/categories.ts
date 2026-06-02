export const CATEGORIES = [
  { value: 'course',           label: 'Course',                   director: 'Golf Director',              ceiling: 10 },
  { value: 'competitions',     label: 'Competitions & Matches',    director: 'Golf Director',              ceiling: 7  },
  { value: 'clubhouse',        label: 'Clubhouse',                 director: 'Estate Director',            ceiling: 8  },
  { value: 'grounds',          label: 'Grounds (non-course)',      director: 'Estate Director',            ceiling: 6  },
  { value: 'refreshments',     label: 'On-course Refreshments',    director: 'Estate & F&B Director',      ceiling: 4  },
  { value: 'restaurant',       label: 'Restaurant / Catering',     director: 'F&B Director',               ceiling: 5  },
  { value: 'bar',              label: 'Bar',                       director: 'F&B Director',               ceiling: 6  },
  { value: 'pro_shop',         label: 'Pro Shop',                  director: 'Commercial Director',        ceiling: 3  },
] as const

export type CategoryValue = typeof CATEGORIES[number]['value']

export const IMPACT_OPTIONS = [
  { value: 8, label: 'Affects all or most members' },
  { value: 6, label: 'Affects regular golfers' },
  { value: 4, label: 'Affects specific groups (seniors, juniors, ladies, visitors etc.)' },
  { value: 2, label: 'Affects occasional or visiting users only' },
] as const

export const RECOGNITION_OPTIONS = [
  { value: 'public',    label: 'Public — happy for my name to be associated with this suggestion' },
  { value: 'private',   label: 'Private — share my name with the committee only' },
  { value: 'anonymous', label: 'Anonymous — do not share my name' },
] as const

export const STATUS_LABELS: Record<string, string> = {
  new:                 'Received',
  under_consideration: 'Under Consideration',
  approved:            'Approved',
  implemented:         'Implemented',
  rejected:            'Not Progressed',
}

export const DIRECTOR_CATEGORIES: Record<string, string[]> = {
  'Golf Director':       ['course', 'competitions'],
  'Estate Director':     ['clubhouse', 'grounds', 'refreshments'],
  'F&B Director':        ['restaurant', 'bar', 'refreshments'],
  'Commercial Director': ['pro_shop'],
  'Club Manager':        ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop'],
  'Chair':               ['course', 'competitions', 'clubhouse', 'grounds', 'refreshments', 'restaurant', 'bar', 'pro_shop'],
}

import type { ListingCategory } from './types';

// RULE: Never hardcode commission rate — always read from PLATFORM_COMMISSION_RATE env var
// These defaults are fallbacks only — production must set the env variable explicitly
export const PLATFORM_DEFAULTS = {
  // RULE: auto-cancel + full refund if seller does not ship within 3 business days
  SELLER_SHIP_DAYS: 3,
  // RULE: buyer has 14 days from delivery confirmation to open a dispute
  BUYER_DISPUTE_DAYS: 14,
  // RULE: seller has 72 hours to respond before admin can rule in buyer's favour
  SELLER_RESPONSE_HOURS: 72,
  // RULE: funds auto-release to seller after 7 days if buyer does not dispute
  AUTO_CONFIRM_DAYS: 7,
  // RULE: debounce search input at 300ms to keep results fast
  SEARCH_DEBOUNCE_MS: 300,
} as const;

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
export type ListingCondition = typeof LISTING_CONDITIONS[number];

// Categories where the item belongs to a specific school (uniform, team kit)
// vs generic items sold nationwide (shoes, bags, books, equipment)
export const SCHOOL_SPECIFIC_CATEGORIES = ['School Uniforms', 'School Sports Kit'] as const;
export const NATIONWIDE_CATEGORIES = ['Shoes', 'Sports Equipment', 'Books & Stationery', 'Bags & Accessories', 'Other'] as const;
export const ALL_CATEGORIES = [...SCHOOL_SPECIFIC_CATEGORIES, ...NATIONWIDE_CATEGORIES] as const;
// ListingCategory is exported from types.ts — do not re-export here

export const CATEGORY_EMOJI: Record<ListingCategory, string> = {
  'School Uniforms': '👕',
  'School Sports Kit': '🏆',
  'Shoes': '👟',
  'Sports Equipment': '⚽',
  'Books & Stationery': '📚',
  'Bags & Accessories': '🎒',
  'Other': '📦',
};

export const SUBCATEGORIES: Record<ListingCategory, string[]> = {
  'School Uniforms': ['Tops & Shirts', 'Bottoms', 'Dresses & Tunics', 'Blazers & Jackets', 'Jerseys & Hoodies', 'Ties & Accessories', 'Hats & Caps', 'Socks'],
  'School Sports Kit': ['Rugby', 'Soccer', 'Cricket', 'Hockey', 'Swimming', 'Athletics', 'Netball', 'Tennis', 'Other Sport'],
  'Shoes': ['Black School Shoes', 'PT / Takkies', 'Rugby Boots', 'Soccer Boots', 'Cricket Shoes', 'Hockey Shoes', 'Running Shoes', 'Other'],
  'Sports Equipment': ['Rackets & Bats', 'Balls', 'Protective Gear', 'Swimming Gear', 'Bags & Holdalls', 'Other'],
  'Books & Stationery': ['Textbooks', 'Study Guides', 'Stationery Sets', 'Calculators & Tech', 'Other'],
  'Bags & Accessories': ['Backpacks', 'Sports Bags', 'Lunch Boxes', 'Water Bottles', 'Other'],
  'Other': ['Other'],
};

export const SPORTS = ['Rugby', 'Soccer', 'Cricket', 'Hockey', 'Swimming', 'Athletics', 'Netball', 'Tennis', 'Other'] as const;
export type Sport = typeof SPORTS[number];

export const SA_PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
] as const;
// SaProvince is exported from types.ts — do not re-export here

export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '4', '6', '8', '10', '12', '14', '16', '18', '20'] as const;
export const SHOE_SIZES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

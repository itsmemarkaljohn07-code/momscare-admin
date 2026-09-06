// The exact 30 icon keys currently referenced across your 25 articles.
// Keeping this as a closed list (rather than free text) means an admin
// can never accidentally type a key that doesn't correspond to a real
// icon in the mobile app.
export const INSIGHT_ICON_KEYS = [
  'bag', 'bed', 'bone', 'brain', 'breath', 'chart', 'check', 'clock',
  'couple', 'doc', 'drop', 'ear', 'eye', 'fish', 'hand', 'heart',
  'labor', 'leaf', 'list', 'lunch', 'moon', 'person', 'pill', 'scan',
  'shield', 'star', 'sun', 'talk', 'vitamin', 'wave',
] as const;

// Derives the 5 rgba style variants from one base hex color, so a new
// article only needs one color chosen rather than 5 near-duplicate
// rgba strings typed by hand.
export function deriveArticleColors(hex: string) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16) || 0;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  return {
    accentBg: rgba(0.10),
    highlightBg: rgba(0.07),
    highlightBorder: rgba(0.20),
    tipBg: rgba(0.07),
    tipBorder: rgba(0.18),
    heroBg: `linear-gradient(135deg, ${rgba(0.15)} 0%, ${rgba(0.08)} 100%)`,
  };
}

export const INSIGHT_SECTIONS = [
  'popular', 'body', 'baby', 'nutrition', 'mind', 'birth',
] as const;
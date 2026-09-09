const PALETTE = [
  { bg: 'bg-[#fce8f3]', text: 'text-[#d9609a]' },
  { bg: 'bg-[#f0e6fb]', text: 'text-[#9b6fc4]' },
  { bg: 'bg-[#e0f5f2]', text: 'text-[#4fa89c]' },
  { bg: 'bg-[#fdf1e0]', text: 'text-[#d99a3a]' },
  { bg: 'bg-[#e3edfb]', text: 'text-[#4f7fc2]' },
];

export function getAvatarStyle(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
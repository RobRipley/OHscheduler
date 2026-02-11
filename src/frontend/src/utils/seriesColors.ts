// Deterministic color for event series based on title
// Returns { bg, border, text } for card styling

const SERIES_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366F1', text: '#818CF8' },   // indigo
  { bg: 'rgba(14, 165, 233, 0.15)', border: '#0EA5E9', text: '#38BDF8' },   // sky
  { bg: 'rgba(168, 85, 247, 0.15)', border: '#A855F7', text: '#C084FC' },   // purple
  { bg: 'rgba(20, 184, 166, 0.15)', border: '#14B8A6', text: '#2DD4BF' },   // teal
  { bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B', text: '#FBBF24' },   // amber
  { bg: 'rgba(236, 72, 153, 0.15)', border: '#EC4899', text: '#F472B6' },   // pink
  { bg: 'rgba(34, 197, 94, 0.15)', border: '#22C55E', text: '#4ADE80' },    // green
  { bg: 'rgba(244, 63, 94, 0.15)', border: '#F43F5E', text: '#FB7185' },    // rose
];

// No-host always uses red
export const NO_HOST_COLOR = { bg: 'rgba(248, 113, 113, 0.15)', border: '#F87171', text: '#F87171' };

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSeriesColor(title: string) {
  return SERIES_COLORS[hashString(title) % SERIES_COLORS.length];
}

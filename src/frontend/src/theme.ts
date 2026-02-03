// Dark theme constants - Quietly Premium
// 3-layer hierarchy: bg (darkest) → surface (cards) → inputSurface (inputs/rows)
export const theme = {
  // Core - 3 layer hierarchy
  bg: '#0B0F14',              // Layer 1: App background (darkest)
  surface: '#121826',          // Layer 2: Cards/panels
  surfaceElevated: '#161F2E',  // Layer 2.5: Elevated cards (modals)
  inputSurface: '#1E2433',     // Layer 3: Inputs, table rows, selects (lightest)
  
  // Borders - more visible for inputs
  border: '#1F2937',           // Subtle border for cards
  borderInput: '#374151',      // More visible border for inputs
  borderFocus: '#4B5563',      // Even more visible on focus
  
  // Text
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textPlaceholder: '#6B7280',  // Placeholder text
  
  // Accent
  accent: '#6366F1',
  accentHover: '#5558E3',
  accentFocus: 'rgba(99, 102, 241, 0.3)',
  
  // Status (subtle, not loud)
  statusNeedsHost: '#F87171',
  statusAssigned: '#6366F1',
  
  // Radius
  radiusSm: '8px',
  radiusMd: '12px',
  radiusLg: '16px',
};

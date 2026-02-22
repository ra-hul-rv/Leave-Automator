export function getTypeColor(type: string): string {
  switch (type) {
    case 'fixed':
      return '#ef4444';
    case 'optional':
      return '#f59e0b';
    case 'bridge':
      return '#8b5cf6';
    case 'best_vacation':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

export function getTypeLabel(type: string): string {
  switch (type) {
    case 'fixed':
      return 'Fixed Holiday';
    case 'optional':
      return 'Optional Holiday';
    case 'bridge':
      return 'Bridge Leave';
    case 'best_vacation':
      return 'Best Vacation Period';
    default:
      return 'Holiday';
  }
}

export function getDayBgStyle(type: string): {
  bg: string;
  border: string;
  color: string;
} {
  switch (type) {
    case 'weekend':
      return { bg: '#e5e7eb', border: '#9ca3af', color: '#1f2937' };
    case 'fixed':
      return { bg: '#fee2e2', border: '#ef4444', color: '#991b1b' };
    case 'bridge':
      return { bg: '#ede9fe', border: '#7c3aed', color: '#4c1d95' };
    case 'adjacent':
      return { bg: '#fef9c3', border: '#ca8a04', color: '#78350f' };
    case 'optional_bridge':
      return { bg: '#d1fae5', border: '#059669', color: '#064e3b' };
    default:
      return { bg: '#f9fafb', border: '#d1d5db', color: '#374151' };
  }
}

export function formatShortDate(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options);
}

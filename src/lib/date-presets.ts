export function getPresetDate(daysToAdd: number) {
  // Use Asia/Kolkata timezone to get the current date
  const now = new Date();
  
  // Create a formatter for Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Format returns YYYY-MM-DD
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2000');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  
  // Create a local date representing midnight in IST
  const d = new Date(year, month, day);
  
  // Add days
  d.setDate(d.getDate() + daysToAdd);
  
  // Return in YYYY-MM-DD format
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const d2 = String(d.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${d2}`;
}

export const FOLLOW_UP_PRESETS = [
  { id: 'instant', label: 'Instant', days: 0, isInstant: true },
  { id: 'tomorrow', label: 'Tomorrow', days: 1, isInstant: false },
  { id: '+2', label: '+2 Days', days: 2, isInstant: false },
  { id: '+3', label: '+3 Days', days: 3, isInstant: false },
  { id: '+4', label: '+4 Days', days: 4, isInstant: false },
];

export const DEFAULT_TIME = '10:00';

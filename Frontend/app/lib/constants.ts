export const STATE_OPTIONS = [
  'Delhi',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
] as const;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const DEFAULT_YEAR = 2026;
export const DEFAULT_STATE = 'Kerala';
export const DEFAULT_OPTIONAL_ALLOWANCE = 2;

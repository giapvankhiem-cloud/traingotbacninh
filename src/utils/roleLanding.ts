import type { ActiveTab } from '../types/agriculture';

export function roleLandingTab(input: { signedIn: boolean; admin: boolean; internalExpert: boolean; farmer: boolean }): ActiveTab {
  if (!input.signedIn) return 'market';
  if (input.admin) return 'admin';
  if (input.internalExpert) return 'assistant';
  return input.farmer ? 'overview' : 'market';
}

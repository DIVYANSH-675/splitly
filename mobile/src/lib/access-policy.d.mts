export const ageBands: string[];
export function canAccessCloud(band: string): boolean;
export function isAdultBirthDate(value: string, now?: Date): boolean;
export function createParentLock(options: {
  storage: { get: () => Promise<string | null>; set: (value: string) => Promise<void> };
  digest: (value: string) => Promise<string>;
  randomHex: () => Promise<string>;
  now?: () => number;
}): { hasPin: () => Promise<boolean>; setup: (birthday: string, pin: string, confirmation: string) => Promise<void>; unlock: (pin: string) => Promise<void> };

/** Server-only demo identity helpers — do not import from client components. */

export const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "";

export function isDemoUser(user: { id: string } | null | undefined): boolean {
  return Boolean(DEMO_USER_ID && user?.id === DEMO_USER_ID);
}

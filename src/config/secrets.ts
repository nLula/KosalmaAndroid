// PAT comes from EXPO_PUBLIC_PAT env var (EAS secret) or .env.local for local dev.
// The value is inlined at bundle time and then seeded into SecureStore on first launch.
export const PAT: string = process.env.EXPO_PUBLIC_PAT ?? '';

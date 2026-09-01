// No token is bundled with the app.
//
// EXPO_PUBLIC_* variables are inlined into the JavaScript bundle at build time,
// so anything read from them can be extracted from the distributed APK by
// unzipping it. A GitHub PAT with write access to the company repo must never
// travel that way.
//
// The token is entered once in Settings and stored in the OS keystore
// (SecureStore), which is per-device, survives app updates, and never leaves
// the phone. See loadPat() in services/storage.ts.
export const PAT: string = '';

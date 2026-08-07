export function isDemoModeEnabled(demoMode: string | undefined, nodeEnv: string | undefined) {
  return demoMode === "true" && nodeEnv === "development";
}

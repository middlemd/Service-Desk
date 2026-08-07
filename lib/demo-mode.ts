import "server-only";

import { isDemoModeEnabled } from "./demo-mode-core";

export function isDemoMode() {
  return isDemoModeEnabled(process.env.DEMO_MODE, process.env.NODE_ENV);
}

// set while signing out, so a cache save already on its way can't write the plan back to the device
let paused = false

export function pausePersist(): void { paused = true }
export function resumePersist(): void { paused = false }
export const persistPaused = (): boolean => paused

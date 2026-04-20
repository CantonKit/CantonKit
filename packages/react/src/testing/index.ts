export { createFakeCantonClient } from './createFakeCantonClient.js'
export type { FakeCantonClient } from './createFakeCantonClient.js'
export { TestCantonProvider } from './TestCantonProvider.js'
export type { TestCantonProviderProps } from './TestCantonProvider.js'
// Re-export the low-level core fake for users who want to drive the DappClient seam
export { createFakeDappClient } from '@cantonkit/core'
export type { FakeDappClient } from '@cantonkit/core'

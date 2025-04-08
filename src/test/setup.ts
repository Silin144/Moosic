import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers as any)

// Mock fetch globally
global.fetch = vi.fn()

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
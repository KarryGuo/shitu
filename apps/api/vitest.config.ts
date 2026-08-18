import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      CARE_PACE: '0',
      LLM_PROVIDER: 'rule',
      DATABASE_URL: ':memory:',
    },
    testTimeout: 15000,
  },
})

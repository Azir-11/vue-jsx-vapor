import process from 'node:process'
import { testFixtures } from '@vue-macros/test-utils'
import { describe } from 'vitest'
import { transformJsxMacros } from '../src/core'

const options = {
  defineModel: { alias: ['defineModel'] },
  defineSlots: { alias: ['defineSlots'] },
  defineStyle: { alias: ['defineStyle'] },
  defineExpose: { alias: ['defineExpose'] },
  defineComponent: { alias: ['defineComponent', 'defineVaporComponent'] },
}

// TODO: hash-sum's result is different on Windows and Linux
const globs =
  process.platform === 'win32'
    ? import.meta.glob(
        ['./fixtures/**/*.tsx', '!./fixtures/**/define-style.tsx'],
        {
          eager: true,
          as: 'raw',
        },
      )
    : import.meta.glob('./fixtures/**/*.tsx', {
        eager: true,
        as: 'raw',
      })

describe('fixtures', async () => {
  await testFixtures(
    globs,
    (args, id, code) =>
      transformJsxMacros(code, id, new Map(), {
        lib: 'vue',
        include: ['*.tsx'],
        version: 3.6,
        ...options,
      })?.code,
  )
})

describe('vue/vapor fixtures', async () => {
  await testFixtures(
    globs,
    (args, id, code) =>
      transformJsxMacros(code, id, new Map(), {
        lib: 'vue/vapor',
        include: ['*.tsx'],
        version: 3.6,
        ...options,
      })?.code,
  )
})

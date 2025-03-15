import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { createTwoslasher } from '@ts-macro/twoslash'
import { defineConfig } from 'vitepress'
import vueJsxVapor from 'vue-jsx-vapor/volar'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Vue JSX Vapor',
  description: 'Vue JSX Vapor',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features/directives' },
      { text: 'REPL', link: 'https://repl.zmjs.dev/vuejs/vue-jsx-vapor' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          {
            text: 'Getting Started',
            link: `/introduction/getting-started`,
          },
          {
            text: 'Interop',
            link: `/introduction/interop`,
          },
          {
            text: 'Migration',
            link: `/introduction/migration`,
          },
        ],
      },
      {
        text: 'Features',
        items: [
          {
            text: 'directives',
            link: '/features/directives',
          },
          {
            text: 'macros',
            link: '/features/macros',
          },
          {
            text: 'useRef',
            link: '/features/use-ref',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vue-jsx-vapor' },
    ],
  },
  markdown: {
    languages: ['js', 'ts'],
    codeTransformers: [
      transformerTwoslash({
        twoslasher: createTwoslasher({
          compilerOptions: {
            jsx: 1,
            jsxImportSource: 'vue-jsx-vapor',
            customConditions: ['dev'],
          },
          tsmCompilerOptions: {
            plugins: [vueJsxVapor({ macros: true })],
          },
        }),
      }),
    ],
  },
})

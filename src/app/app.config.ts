import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core'
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'
import { providePrimeNG } from 'primeng/config'
import Aura from '@primeng/themes/aura'
import { definePreset } from '@primeng/themes'
import { provideMonacoEditor } from 'ngx-monaco-editor-v2'
import type monacoType from 'monaco-editor'
import schema from '../../public/ghedesigner.schema.json'
import findDesignBiRectangleConstrainedSingleUTube from '../../public/demos/find_design_bi_rectangle_constrained_single_u_tube.json'
import prettier from 'prettier/standalone'
import prettierBabelPlugin from 'prettier/plugins/babel'
import prettierPluginEstree from 'prettier/plugins/estree'

const preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{zinc.50}',
      100: '{zinc.100}',
      200: '{zinc.200}',
      300: '{zinc.300}',
      400: '{zinc.400}',
      500: '{zinc.500}',
      600: '{zinc.600}',
      700: '{zinc.700}',
      800: '{zinc.800}',
      900: '{zinc.900}',
      950: '{zinc.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{zinc.950}',
          inverseColor: '#ffffff',
          hoverColor: '{zinc.900}',
          activeColor: '{zinc.800}',
        },
        highlight: {
          background: '{zinc.950}',
          focusBackground: '{zinc.700}',
          color: '#ffffff',
          focusColor: '#ffffff',
        },
      },
      dark: {
        primary: {
          color: '{zinc.50}',
          inverseColor: '{zinc.950}',
          hoverColor: '{zinc.100}',
          activeColor: '{zinc.200}',
        },
        highlight: {
          background: 'rgba(250, 250, 250, .16)',
          focusBackground: 'rgba(250, 250, 250, .24)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)',
        },
      },
    },
  },
  components: {
    menubar: {
      background: '#2b2d30',
      border: {
        radius: '0',
      },
      submenu: {
        background: '#2b2d30',
      },
    },
    tooltip: {
      max: {
        width: 320,
      },
    },
  },
})

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset,
        options: {
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),
    provideMonacoEditor({
      baseUrl: `${window.location.origin}/monaco/vs`,
      defaultOptions: {
        inlayHints: {
          fontSize: 13,
        },
        scrollBeyondLastLine: false,
      } satisfies monacoType.editor.IEditorOptions,
      onMonacoLoad: () => {
        const { monaco } = window

        // Disable built-in formatter
        monaco.languages.json.jsonDefaults.setModeConfiguration({
          ...monaco.languages.json.jsonDefaults.modeConfiguration,
          documentFormattingEdits: false,
          documentRangeFormattingEdits: false,
        })

        // Enable schema validation
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          schemaValidation: 'error',
          schemas: [
            {
              uri: 'https://github.com/BETSRG/GHEDesigner/blob/develop/ghedesigner/schemas/ghedesigner.schema.json',
              fileMatch: ['*'],
              schema,
            },
          ],
        })

        // Prettier formatting
        monaco.languages.registerDocumentFormattingEditProvider('json', {
          async provideDocumentFormattingEdits(model) {
            const formatted = await prettier.format(model.getValue(), {
              parser: 'json',
              plugins: [prettierBabelPlugin, prettierPluginEstree],
            })
            return [
              {
                range: model.getFullModelRange(),
                text: formatted,
              },
            ]
          },
        })

        // Add type hints
        monaco.languages.registerInlayHintsProvider('json', {
          async provideInlayHints(model) {
            const hints: monacoType.languages.InlayHint[] = []

            const workerAccessor = await monaco.languages.json.getWorker()
            const jsonWorker = await workerAccessor(model.uri)

            const matches = await jsonWorker.getMatchingSchemas(model.uri.toString())

            // Handle arrays first, store the text‐offset ranges to avoid nested hints
            const formattedArrays: Array<{ start: number; end: number; unit: string }> = []

            for (const { node, schema } of matches) {
              const format =
                schema.format ?? (typeof schema.items === 'object' && !Array.isArray(schema.items) ? schema.items.format : undefined)
              if (node.type === 'array' && format) {
                const start = node.offset
                const end = node.offset + node.length
                formattedArrays.push({ start, end, unit: format })

                const position = model.getPositionAt(end)
                hints.push({
                  position,
                  label: `: ${format}`,
                  kind: monaco.languages.InlayHintKind.Type,
                })
              }
            }

            // Handle per-number hints that aren't in an array
            for (const { node, schema } of matches) {
              const format = schema.format
              if (node.type === 'number' && format) {
                // Skip this number if it's inside a formatted array
                if (formattedArrays.some((arr) => node.offset >= arr.start && node.offset < arr.end)) {
                  continue
                }

                // Position just after the literal
                const pos = model.getPositionAt(node.offset + node.length)
                hints.push({
                  position: pos,
                  label: `: ${format.replaceAll('^3', '³')}`,
                  kind: monaco.languages.InlayHintKind.Type,
                })
              }
            }

            return {
              hints,
              dispose: () => {},
            }
          },
        })
      },
    }),
  ],
}

import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core'
import { provideNoopAnimations } from '@angular/platform-browser/animations'
import { definePreset } from '@primeng/themes'
import Aura from '@primeng/themes/aura'
import type monacoType from 'monaco-editor'
import { provideMonacoEditor } from 'ngx-monaco-editor-v2'
import { providePrimeNG } from 'primeng/config'
import schema from '../../public/ghedesigner.schema.json'
import { formatJson } from './utils'

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
          contrastColor: '#ffffff',
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
          contrastColor: '{zinc.950}',
          hoverColor: '{zinc.100}',
          activeColor: '{zinc.200}',
        },
        highlight: {
          background: 'rgba(250,250,250,0.16)',
          focusBackground: 'rgba(250,250,250,0.24)',
          color: 'rgba(255,255,255,0.87)',
          focusColor: 'rgba(255,255,255,0.87)',
        },
      },
    },
  },
  components: {
    menubar: {
      root: {
        background: '#2b2d30',
        borderRadius: '0',
      },
      submenu: {
        background: '#2b2d30',
      },
    },
    tooltip: {
      root: {
        maxWidth: '320px',
      },
    },
  },
})

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideNoopAnimations(),
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
      baseUrl: `${window.location.href}monaco/vs`,
      defaultOptions: {
        formatOnPaste: true,
        inlayHints: {
          fontSize: 13,
          padding: true,
          fontFamily: 'Inter Variable',
        },
        minimap: {
          renderCharacters: false,
          maxColumn: 80,
        },
        mouseWheelZoom: true,
        rulers: [{ column: 80, color: 'rgba(255,255,255,0.1)' }],
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
              fileMatch: ['inmemory://demo/*', 'inmemory://user/*'],
              schema,
            },
          ],
        })

        // Prettier formatting
        monaco.languages.registerDocumentFormattingEditProvider('json', {
          async provideDocumentFormattingEdits(model) {
            return [
              {
                range: model.getFullModelRange(),
                text: await formatJson(model.getValue()),
              },
            ]
          },
        })

        // Add type hints
        monaco.languages.registerInlayHintsProvider('json', {
          async provideInlayHints(model) {
            const hints: monacoType.languages.InlayHint[] = []
            const hintPositions: Set<string> = new Set()

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
                if (hintPositions.has(`${position.lineNumber}.${position.column}`)) continue

                hintPositions.add(`${position.lineNumber}.${position.column}`)
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
                const position = model.getPositionAt(node.offset + node.length)
                if (hintPositions.has(`${position.lineNumber}.${position.column}`)) continue

                hintPositions.add(`${position.lineNumber}.${position.column}`)
                hints.push({
                  position,
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

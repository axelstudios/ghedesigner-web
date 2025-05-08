import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core'
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'
import { providePrimeNG } from 'primeng/config'
import Aura from '@primeng/themes/aura'
import { definePreset } from '@primeng/themes'
import { provideMonacoEditor } from 'ngx-monaco-editor-v2'
import type monacoType from 'monaco-editor'

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
        scrollBeyondLastLine: false,
      } satisfies monacoType.editor.IEditorOptions,
      onMonacoLoad: () => {
        window.monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          schemaValidation: 'error',
          schemas: [
            {
              uri: 'http://myserver/foo-schema.json',
              fileMatch: ['*'],
              schema: {
                type: 'object',
                properties: {
                  p1: {
                    enum: ['v1', 'v2'],
                  },
                  p2: {
                    type: 'object',
                    properties: {
                      q1: {
                        enum: ['x1', 'x2'],
                      },
                    },
                  },
                },
                required: ['p1', 'p2'],
              },
            },
          ],
        })
      },
    }),
  ],
}

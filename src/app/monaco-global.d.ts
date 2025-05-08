import type monacoType from 'monaco-editor'

declare global {
  interface Window {
    monaco: typeof monacoType
  }
}

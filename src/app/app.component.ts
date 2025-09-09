import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import jszip from 'jszip'
import type monacoType from 'monaco-editor'
import { editor, Uri } from 'monaco-editor'
import { MonacoEditorModule } from 'ngx-monaco-editor-v2'
import { MenuItem, PrimeIcons } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { ContextMenu } from 'primeng/contextmenu'
import { MenubarModule } from 'primeng/menubar'
import { SelectModule } from 'primeng/select'
import { TooltipModule } from 'primeng/tooltip'
import { BehaviorSubject, filter, take } from 'rxjs'
import { v7 as uuid } from 'uuid'
import { Request, RequestWithId, Response, Result } from './app.types'
import { demos } from './demos'
import { naturalSort, overrideLogging, uniqueUri } from './utils'

// window.addEventListener('unhandledrejection', (event) => {
//   console.log('UNHANDLED REJECTION', event)
//   if (event.reason?.name === 'Canceled') {
//     event.preventDefault()
//   }
// })

@Component({
  selector: 'app-root',
  imports: [ButtonModule, CommonModule, ContextMenu, FormsModule, MenubarModule, MonacoEditorModule, SelectModule, TooltipModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // host: {
  //   '[class.pointer-events-none]': '!isLoaded',
  // },
})
export class AppComponent implements OnInit {
  private ref = inject(ChangeDetectorRef)

  private editorReady$ = new BehaviorSubject(false)
  private viewerReady$ = new BehaviorSubject(false)

  editor?: editor.IStandaloneCodeEditor
  viewer?: editor.IStandaloneCodeEditor

  editorOptions: editor.IGlobalEditorOptions = {
    insertSpaces: true,
    tabSize: 2,
    theme: 'vs-dark',
  }

  loadingProgress = { value: 0, total: 0 }
  isLoaded = true
  isPyodideLoadedPromise: Promise<boolean>
  worker: Worker | undefined
  version = ''

  state: {
    files: Record<
      string,
      {
        initialCode?: string
        isRunning?: boolean
        result?: Result
        selectedResult?: string
        viewState?: editor.ICodeEditorViewState
      }
    >
    selectedUri?: string
  } = {
    files: {},
  }

  menu: MenuItem[] = [
    {
      label: 'File',
      icon: PrimeIcons.FILE,
      items: [
        {
          label: 'New',
          icon: PrimeIcons.PLUS,
          command: () => {
            const uri = uniqueUri('inmemory://user/find_design.json', Object.keys(this.state.files))
            this.state.files[uri] = {
              initialCode: '{\n  "version": 2\n}',
            }
            // We only need to call activate if the editor is already initialized
            if (Object.keys(this.state.files).length > 1) {
              this.activateUri(uri)
            } else {
              this.state.selectedUri = uri
            }
          },
        },
        {
          separator: true,
        },
        {
          label: 'Revert',
          icon: PrimeIcons.HISTORY,
          disabled: true,
          command: () => {
            // TODO
          },
        },
      ],
    },
    {
      label: 'Edit',
      icon: PrimeIcons.PENCIL,
      items: [
        {
          label: 'Undo',
          icon: PrimeIcons.REPLAY,
          disabled: true,
          command: () => {
            this.editor?.trigger('keyboard', 'undo', {})
          },
        },
        {
          label: 'Redo',
          icon: PrimeIcons.REFRESH,
          disabled: true,
          command: () => {
            this.editor?.trigger('keyboard', 'redo', {})
          },
        },
      ],
    },
    {
      label: 'Demos',
      icon: PrimeIcons.CODE,
      items: demos.map((demo) => ({
        label: demo.replace(/\.json$/, ''),
        icon: PrimeIcons.FILE_IMPORT,
        command: async () => {
          await this.loadDemo(demo)
          this.ref.markForCheck()
        },
      })),
    },
    {
      label: 'GitHub',
      icon: PrimeIcons.GITHUB,
      url: 'https://github.com/BETSRG/GHEDesigner',
      target: '_blank',
    },
  ]

  private resolvePyodideLoaded!: (value: boolean | PromiseLike<boolean>) => void
  private monaco!: typeof monacoType
  private contextMenuFile: string | undefined

  fileContextMenu: MenuItem[] = [
    {
      label: 'Copy',
      icon: 'pi pi-copy',
      command: () => {
        // TODO Duplicate
        console.log(`Duplicate ${this.contextMenuFile}`)
      },
    },
    {
      label: 'Rename',
      icon: 'pi pi-file-edit',
      command: () => {
        // TODO rename
        console.log(`Rename ${this.contextMenuFile}`)
      },
    },
  ]

  constructor() {
    overrideLogging()

    this.isPyodideLoadedPromise = new Promise((resolve) => {
      this.resolvePyodideLoaded = resolve
    })

    this.worker = new Worker(new URL('./app.worker', import.meta.url), {
      type: 'module',
    })
    // Handle generic messages
    this.worker.onmessage = ({ data }: MessageEvent<Response>) => {
      if (data.type === 'loadingProgress') {
        this.loadingProgress = { ...data }
        if (data.value === data.total) {
          this.resolvePyodideLoaded(true)
          this.isLoaded = true
        }
      } else if (data.type === 'version') {
        this.version = data.version
        this.ref.markForCheck()
      }
    }
  }

  async ngOnInit() {
    await this.isPyodideLoadedPromise
    console.log('pyodide loaded')
  }

  onEditorInit(editor: editor.IStandaloneCodeEditor) {
    this.monaco ??= window.monaco
    this.editor = editor
    this.editorReady$.next(true)

    // TODO use this to mark files as modified
    this.monaco.editor.onDidChangeMarkers((_uris) => {
      const markers = this.monaco.editor.getModelMarkers({ owner: 'json' })
      console.log('Validation change:', markers)
    })

    // Re‐compute canUndo/canRedo on edit:
    editor.onDidChangeModelContent(() => {
      this.updateUndoRedoMenuState()
    })

    // Re‐compute canUndo/canRedo on model change:
    editor.onDidChangeModel(() => {
      this.updateUndoRedoMenuState()
    })

    let state = localStorage.getItem('state')
    if (state) {
      try {
        state = JSON.parse(state)
        // TODO load state
      } catch (e) {
        localStorage.removeItem('state')
      }
    }

    // Load initial file (new or demo)
    console.log('onEditorInit', this.state.selectedUri)
    if (this.state.selectedUri) {
      this.activateUri(this.state.selectedUri, true)
    }
    // TODO update state
  }

  onViewerInit(viewer: editor.IStandaloneCodeEditor) {
    this.monaco ??= window.monaco
    this.viewer = viewer
    this.viewerReady$.next(true)

    this.viewer.updateOptions({
      readOnly: true,
      rulers: [],
    })

    if (this.state.selectedUri) {
      const file = this.state.files[this.state.selectedUri]
      if (file.selectedResult) this.updateViewer(file.selectedResult)
    }
  }

  name(uri: string) {
    return Uri.parse(uri).path.replace(/^\/|\.json$/g, '')
  }

  get sortedFiles() {
    const files = Object.keys(this.state.files).map((uri) => ({
      uri,
      name: this.name(uri),
    }))

    return files.sort((a, b) => naturalSort(a.name, b.name))
  }

  activateUri(uri: string, initial = false) {
    if (this.state.selectedUri !== uri || initial) {
      this.state.selectedUri = uri

      // Wait for editor to be ready
      this.editorReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
        let model = this.monaco.editor.getModel(Uri.parse(uri))
        if (!model) {
          model = this.monaco.editor.createModel(this.state.files[uri].initialCode ?? '', 'json', Uri.parse(uri))
        }
        this.editor?.setModel(model)
      })

      if (this.state.files[uri].result) {
        this.viewerReady$.pipe(filter(Boolean), take(1)).subscribe(() => {
          if (this.state.files[uri].selectedResult) {
            this.updateViewer(this.state.files[uri].selectedResult)
          }
        })
      } else {
        this.viewerReady$.next(false)
      }
    }
  }

  async closeFile(uri: string, event?: Event) {
    event?.stopPropagation()

    // TODO stop run if already running

    if (this.state.files[uri]) {
      // TODO prompt the user about losing changes

      if (uri === this.state.selectedUri) {
        const currentFiles = this.sortedFiles
        this.state.selectedUri = undefined
        if (currentFiles.length > 1) {
          const index = currentFiles.findIndex((file) => file.uri === uri)
          const nextFile = currentFiles[index - (index ? 1 : -1)]
          this.activateUri(nextFile.uri)
        } else {
          this.editorReady$.next(false)
          this.viewerReady$.next(false)
        }
      }

      this.monaco.editor.getModel(Uri.parse(uri))?.dispose()
      delete this.state.files[uri]

      await this.requestResponse({
        type: 'closeFile',
        name: this.name(uri),
      })

      console.log(
        'files:',
        await this.requestResponse({
          type: 'listFiles',
        }),
      )

      // TODO remove models for result files
    }
  }

  handleMiddleClick(file: string, event: MouseEvent) {
    if (event.button === 1) {
      void this.closeFile(file)
    }
  }

  keys(obj: Record<string, unknown>) {
    return Object.keys(obj).toSorted(naturalSort)
  }

  onRightClick(file: string) {
    this.contextMenuFile = file
  }

  async runFile() {
    if (!this.state.selectedUri) {
      console.error('runFile: No file selected')
      return
    }

    const code = this.editor?.getValue() ?? ''
    const name = this.name(this.state.selectedUri)

    this.setRunning(this.state.selectedUri, true)

    // TODO move this to a function that marks for check
    this.state.files[this.state.selectedUri].isRunning = true

    // TODO validate first
    const result = (await this.requestResponse({
      type: 'runFile',
      name,
      code,
    })) as Result

    const file = this.state.files[this.state.selectedUri]
    const resultFiles = this.keys(result.files)
    const preferred = ['SimulationSummary.txt', 'SimulationSummary.json']
    file.selectedResult = preferred.find((name) => resultFiles.includes(name)) || resultFiles[0]
    file.result = result

    // TODO add result code to monaco model rather than state object
    for (const [filename, code] of Object.entries(file.result.files)) {
      const uri = `inmemory://result/${this.name(this.state.selectedUri)}/${filename}`
      const language = filename.replace(/.*\./, '')
      this.monaco.editor.createModel(code, language, Uri.parse(uri))
    }

    this.setRunning(this.state.selectedUri, false)
  }

  async downloadFiles() {
    if (!this.state.selectedUri) return
    const file = this.state.files[this.state.selectedUri]
    if (!file.result) return

    const zip = new jszip()
    for (const [filename, code] of Object.entries(file.result.files)) {
      zip.file(filename, code)
    }
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${this.name(this.state.selectedUri)} results.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  private getPromiseAndResolve() {
    let resolve!: (value: unknown) => void
    const promise = new Promise((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  private requestResponse(message: Request) {
    const requestId = uuid()
    const { promise, resolve } = this.getPromiseAndResolve()
    const worker = this.worker!
    worker.addEventListener('message', function listener(event) {
      if (event.data?.id !== requestId) {
        return
      }
      // This listener is done so remove it.
      worker.removeEventListener('message', listener)
      // Filter the id out of the result
      const { id, ...rest } = event.data
      resolve(rest)
    })
    this.sendMessage({ ...message, id: requestId })
    return promise
  }

  private sendMessage(message: RequestWithId) {
    this.worker?.postMessage(message)
  }

  private setRunning(uri: string, isRunning: boolean) {
    this.state.files[uri].isRunning = isRunning
    this.ref.markForCheck()
  }

  private async loadDemo(demo: string) {
    const uri = `inmemory://demo/${demo}`

    if (!(uri in this.state.files)) {
      const response = await fetch(`demos/${demo}`)
      this.state.files[uri] = {
        initialCode: await response.text(),
      }
    }

    // We only need to call activate if the editor is already initialized
    if (Object.keys(this.state.files).length > 1) {
      this.activateUri(uri)
    } else {
      this.state.selectedUri = uri
    }
  }

  private updateUndoRedoMenuState() {
    const model = this.editor?.getModel()
    if (model) {
      const canUndo = (model as any).canUndo()
      const canRedo = (model as any).canRedo()

      if (this.menu[1].items) {
        this.menu[1].items[0].disabled = !canUndo
        this.menu[1].items[1].disabled = !canRedo
      }
    }
  }

  updateViewer(selectedResult: string) {
    if (this.viewer && this.state.selectedUri) {
      const uri = `inmemory://result/${this.name(this.state.selectedUri)}/${selectedResult}`

      const model = this.monaco.editor.getModel(Uri.parse(uri))
      if (model) this.viewer.setModel(model)
    }
  }
}

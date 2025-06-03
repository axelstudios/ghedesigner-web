import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core'
import { MonacoEditorModule } from 'ngx-monaco-editor-v2'
import { MenuItem, PrimeIcons } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { MenubarModule } from 'primeng/menubar'
import { TooltipModule } from 'primeng/tooltip'
import type { Request, Response, Result } from './app.types'
import { demos } from './demos'
import { LoadingComponent } from './loading/loading.component'
import { FormsModule } from '@angular/forms'
import type monacoType from 'monaco-editor'
import { editor, Uri } from 'monaco-editor'
import { naturalSort, overrideLogging, uniqueUri } from './utils'
import { BehaviorSubject, filter, take } from 'rxjs'
import { ContextMenu } from 'primeng/contextmenu'
import { v7 as uuid } from 'uuid'

// window.addEventListener('unhandledrejection', (event) => {
//   console.log('UNHANDLED REJECTION', event)
//   if (event.reason?.name === 'Canceled') {
//     event.preventDefault()
//   }
// })

@Component({
  selector: 'app-root',
  imports: [ButtonModule, CommonModule, LoadingComponent, MenubarModule, MonacoEditorModule, TooltipModule, FormsModule, ContextMenu],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // '[class.pointer-events-none]': '!isLoaded',
  },
})
export class AppComponent implements OnInit {
  private ref = inject(ChangeDetectorRef)

  private editorReady$ = new BehaviorSubject(false)

  editor?: editor.IStandaloneCodeEditor
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
              initialCode: '{\n  "version": 1\n}',
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
          command: () => {
            this.editor?.trigger('keyboard', 'undo', {})
          },
        },
        {
          label: 'Redo',
          icon: PrimeIcons.REFRESH,
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

    // TODO do something
    // for (const demo of demos) {
    //   this.results[demo] = -1
    //   console.log(`Running demo: ${demo}...`)
    //
    //   const result = (await this.requestResponse({ type: 'runDemo', demo, id: uuid() })) as Result
    //   this.results[demo] = result.time
    // }
    //
    // await this.requestResponse({ type: 'listFiles', id: uuid() })
  }

  getPromiseAndResolve() {
    let resolve!: (value: unknown) => void
    const promise = new Promise((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  requestResponse(message: Request) {
    const { promise, resolve } = this.getPromiseAndResolve()
    const worker = this.worker!
    const { id: idWorker } = message
    worker.addEventListener('message', function listener(event) {
      if (event.data?.id !== idWorker) {
        return
      }
      // This listener is done so remove it.
      worker.removeEventListener('message', listener)
      // Filter the id out of the result
      const { id, ...rest } = event.data
      resolve(rest)
    })
    this.sendMessage(message)
    return promise
  }

  sendMessage(message: Request) {
    this.worker?.postMessage(message)
  }

  onEditorInit(editor: editor.IStandaloneCodeEditor) {
    this.monaco ??= window.monaco
    this.editor = editor
    this.editorReady$.next(true)

    // TODO use this to mark files as modified
    this.monaco.editor.onDidChangeMarkers((uris) => {
      console.log('CHANGE DETECTED', uris)
      const markers = this.monaco.editor.getModelMarkers({ owner: 'json' })
      // console.log(markers)
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

  async loadDemo(demo: string) {
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
    }
  }

  closeFile(uri: string, event?: Event) {
    event?.stopPropagation()

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
        }
      }

      this.monaco.editor.getModel(Uri.parse(uri))?.dispose()
      delete this.state.files[uri]
    }
  }

  handleMiddleClick(file: string, event: MouseEvent) {
    if (event.button === 1) {
      this.closeFile(file)
    }
  }

  onRightClick(file: string) {
    this.contextMenuFile = file
  }

  async runFile() {
    const code = this.editor?.getValue()
    // TODO validate
    const result = (await this.requestResponse({ type: 'runDemo', demo: code ?? '', id: uuid() })) as Result
    console.log(result)

    // List files
    // await this.requestResponse({ type: 'listFiles', id: uuid() })
  }
}

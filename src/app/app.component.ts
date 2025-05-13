import { CommonModule } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import type { NgxEditorModel } from 'ngx-monaco-editor-v2'
import { MonacoEditorModule } from 'ngx-monaco-editor-v2'
import { MenuItem, PrimeIcons } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { MenubarModule } from 'primeng/menubar'
import { TooltipModule } from 'primeng/tooltip'
import { v7 as uuid } from 'uuid'
import type { Request, Response, Result } from './app.types'
import { demos } from './demos'
import { LoadingComponent } from './loading/loading.component'
import { FormsModule } from '@angular/forms'
import type monacoType from 'monaco-editor'
import { editor, Uri } from 'monaco-editor'
import findDesignBiRectangleConstrainedSingleUTube from '../../public/demos/find_design_bi_rectangle_constrained_single_u_tube.json'
import prettier from 'prettier/standalone'
import prettierBabelPlugin from 'prettier/plugins/babel'
import prettierPluginEstree from 'prettier/plugins/estree'

@Component({
  selector: 'app-root',
  imports: [ButtonModule, CommonModule, LoadingComponent, MenubarModule, MonacoEditorModule, TooltipModule, FormsModule],
  templateUrl: './app.component.html',
  host: {
    '[class.pointer-events-none]': '!isLoaded',
  },
})
export class AppComponent implements OnInit {
  editor?: editor.IStandaloneCodeEditor
  editorOptions: editor.IGlobalEditorOptions = {
    theme: 'vs-dark',
    tabSize: 2,
    insertSpaces: true,
  }

  loadingProgress = { value: 0, total: 0 }
  isLoaded = true
  isLoadedPromise: Promise<boolean>
  worker: Worker | undefined
  results: Record<string, number> = {}
  demos = demos
  version = ''

  editorModel: NgxEditorModel = {
    value: '',
    language: 'json',
    uri: Uri.parse('inmemory://demo/foo.json'),
  }

  items: MenuItem[] = [
    {
      label: 'File',
      icon: PrimeIcons.FILE,
    },
    {
      label: 'Demos',
      icon: PrimeIcons.CODE,
      items: demos.map((demo) => ({
        label: demo.replace(/\.json$/, ''),
        icon: PrimeIcons.FILE_IMPORT,
      })),
    },
    {
      label: 'GitHub',
      icon: PrimeIcons.GITHUB,
      url: 'https://github.com/BETSRG/GHEDesigner',
      target: '_blank',
    },
  ]

  private resolveLoaded!: (value: boolean | PromiseLike<boolean>) => void
  private monaco!: typeof monacoType

  constructor() {
    this.isLoadedPromise = new Promise((resolve) => {
      this.resolveLoaded = resolve
    })

    this.worker = new Worker(new URL('./app.worker', import.meta.url), {
      type: 'module',
    })
    // Handle generic messages
    this.worker.onmessage = ({ data }: MessageEvent<Response>) => {
      if (data.type === 'loadingProgress') {
        this.loadingProgress = { ...data }
        if (data.value === data.total) {
          this.resolveLoaded(true)
          this.isLoaded = true
        }
      } else if (data.type === 'version') {
        this.version = data.version
      }
    }
  }

  async ngOnInit() {
    this.editorModel.value = await prettier.format(JSON.stringify(findDesignBiRectangleConstrainedSingleUTube), {
      parser: 'json',
      plugins: [prettierBabelPlugin, prettierPluginEstree],
    })
    await this.isLoadedPromise

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
    this.monaco = window.monaco
    this.editor = editor

    this.monaco.editor.onDidChangeMarkers((uris) => {
      console.log('CHANGE DETECTED', uris)
      const markers = this.monaco.editor.getModelMarkers({ owner: 'json' })
      console.log(markers)
    })
  }
}

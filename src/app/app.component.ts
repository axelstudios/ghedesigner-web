import { CommonModule } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { v7 as uuid } from 'uuid'
import type { Request, Response, Result } from './app.types'
import { demos } from './demos'

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  loadingProgress = { value: 0, total: 0 }
  worker: Worker | undefined
  isLoaded: Promise<boolean>
  results: Record<string, number> = {}
  private resolveLoaded!: (value: boolean | PromiseLike<boolean>) => void

  constructor() {
    this.isLoaded = new Promise((resolve) => {
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
        }
      }
    }
  }

  async ngOnInit() {
    await this.isLoaded

    for (const demo of demos) {
      this.results[demo] = -1
      console.log(`Running demo: ${demo}...`)

      const result = (await this.requestResponse({ type: 'runDemo', demo, id: uuid() })) as Result
      this.results[demo] = result.time
    }

    await this.requestResponse({ type: 'listFiles', id: uuid() })
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
}

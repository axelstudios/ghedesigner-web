export type Request =
  | {
      type: 'runFile'
      name: string
      code: string
    }
  | {
      type: 'closeFile'
      name: string
    }
  | {
      type: 'listFiles'
    }

export type RequestWithId = Request & { id: string }

export type Result = {
  type: 'result'
  captured: { level: string; args: unknown[]; time: number }[]
  files: Record<string, string>
  time: number
}

export type Response =
  | {
      type: 'loadingProgress'
      value: number
      total: number
    }
  | ({
      id: string
    } & Result)
  | {
      type: 'version'
      version: string
    }

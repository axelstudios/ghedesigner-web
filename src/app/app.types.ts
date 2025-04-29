export type Request =
  | {
      type: 'runDemo'
      id: string
      demo: string
    }
  | {
      type: 'listFiles'
      id: string
    }

export type Result = {
  type: 'result'
  name: string
  captured: { level: string; args: unknown[]; time: number }[]
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

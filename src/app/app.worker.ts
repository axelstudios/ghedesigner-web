/// <reference lib="webworker" />
let loadingProgress = 0
const totalProgress = 6

// Capture console logs before loading anything
const captured: { level: string; args: unknown[]; time: number }[] = []
for (const level of ['log', 'warn', 'error'] as const) {
  const orig = console[level]
  console[level] = (...args) => {
    captured.push({ level, args, time: Date.now() })
    // Suppress loading logs
    if (level === 'log' && loadingProgress === totalProgress) {
      orig.apply(console, args)
    }
  }
}

addEventListener('message', async ({ data }: MessageEvent<Request>) => {
  if (data.type === 'runDemo') {
    await runDemo(data.id, data.demo)
  } else if (data.type === 'listFiles') {
    await listFiles()
  }
})

import { loadPyodide as _loadPyodide } from 'pyodide'
import type { Request, Response } from './app.types'

const { loadPyodide } = (await import(/* @vite-ignore */ new URL('./pyodide/pyodide.mjs', import.meta.url).href)) as {
  loadPyodide: typeof _loadPyodide
}

const pyodideReady = (async () => {
  // The dependencies are hardcoded to prevent automatically loading more dependencies than necessary (e.g., matplotlib)
  const dependencies = ['click', 'jsonschema', 'scipy', 'typing-extensions']

  // Primary wheels must be loaded sequentially
  const wheels = ['secondarycoolantprops-1.3', 'pygfunction-2.3.0.dev0', 'ghedesigner-2.0']

  const pyodide = await loadPyodide()
  stepLoading()

  await pyodide.loadPackage(dependencies)
  stepLoading()
  for (const wheel of wheels) {
    await pyodide.loadPackage(`wheels/${wheel}-py3-none-any.whl`)
    stepLoading()
  }

  return pyodide
})()

// Get version
;(async () => {
  const pyodide = await pyodideReady
  const version: string = await pyodide.runPythonAsync(`from ghedesigner import VERSION; VERSION`)
  sendMessage({ type: 'version', version })
  stepLoading()
})()

async function listFiles() {
  const pyodide = await pyodideReady

  await pyodide.runPythonAsync(`
    import sys
    from pathlib import Path
  
    def walk(path: Path):
        for entry in path.iterdir():
            if entry.is_dir():
                print(str(entry) + "/")
                try:
                    walk(entry)
                except PermissionError as e:
                    pass
            else:
                print(entry)
  
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/")
    walk(root)
  `)
}

async function runDemo(id: string, demo: string) {
  const pyodide = await pyodideReady

  const start = performance.now()
  await pyodide.runPythonAsync(`
    from importlib.resources import files
    from json import loads
    from pathlib import Path

    import ghedesigner
    from ghedesigner.main import _run_manager_from_cli_worker as run_manager_from_cli_worker
    from jsonschema import validate, ValidationError
    from pyodide.http import pyfetch

    schema_path = files("ghedesigner") / "schemas" / "ghedesigner.schema.json"
    schema = loads(schema_path.read_text())

    res = await pyfetch("demos/${demo}")
    if res.ok:
        demo_content = await res.text()
        Path("/demo.json").write_text(demo_content)
        instance = loads(demo_content)

        try:
            validate(instance=instance, schema=schema)
            print("  ✅ Validation Successful")
        except ValidationError as error:
            print("  ❌ Validation Error:", error)

        code = run_manager_from_cli_worker(Path("/demo.json"), Path("/demo_outputs"))
        print("  ✅ Simulation Successful, code", code)
  `)
  const end = performance.now()

  sendMessage({
    type: 'result',
    id,
    name: demo,
    captured,
    time: Math.round((end - start) / 100) / 10,
  })
  captured.length = 0
}

function stepLoading() {
  sendMessage({ type: 'loadingProgress', value: ++loadingProgress, total: totalProgress })
  if (loadingProgress === totalProgress) {
    captured.length = 0
  }
}

function sendMessage(message: Response) {
  postMessage(message)
}

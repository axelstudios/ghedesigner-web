/// <reference lib="webworker" />
let loadingProgress = 0
const totalProgress = 5

const decoder = new TextDecoder()

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

addEventListener('message', async ({ data }: MessageEvent<RequestWithId>) => {
  if (data.type === 'runFile') {
    await runFile(data)
  } else if (data.type === 'closeFile') {
    console.log('Worker closing file:', data.name)
    await closeFile(data)
  } else if (data.type === 'listFiles') {
    console.log(await listFiles('/home/pyodide/'))
  } else {
    console.error('Unknown request type:', data)
  }
})

import { loadPyodide as _loadPyodide } from 'pyodide'
import type { Request, RequestWithId, Response } from './app.types'

const { loadPyodide } = (await import(/* @vite-ignore */ new URL('./pyodide/pyodide.mjs', import.meta.url).href)) as {
  loadPyodide: typeof _loadPyodide
}

const pyodideReady = (async () => {
  // The dependencies are hardcoded to prevent automatically loading more dependencies than necessary (e.g., matplotlib)
  const packages = ['click', 'jsonschema', 'scipy', 'typing-extensions']

  // Primary wheels must be loaded sequentially
  const wheels = ['secondarycoolantprops-1.3', 'pygfunction-2.3.1', 'bhresist-0.2.0', 'ghedesigner-2.0']

  const pyodide = await loadPyodide({ packages })
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

async function listFiles(path: string): Promise<string[]> {
  console.log('listFiles', path)
  const pyodide = await pyodideReady

  pyodide.globals.set('walk_path', path)

  return [
    ...(await pyodide.runPythonAsync(`
import sys
from pathlib import Path

files = []

path = Path(walk_path)

def walk(path: Path):
    for entry in path.iterdir():
        if entry.is_dir():
            print(str(entry) + "/")
            try:
                walk(entry)
            except PermissionError as e:
                pass
        else:
            files.append(str(entry))

walk(path)
files
`)),
  ]
}

async function runFile({ code, id, name }: Extract<RequestWithId, { type: 'runFile' }>) {
  const pyodide = await pyodideReady
  console.log('runFile', name)

  const inputPath = `/home/pyodide/${name}.json`
  const outputPath = `/home/pyodide/${name}/`
  console.log('inputPath', inputPath)
  console.log('outputPath', outputPath)

  pyodide.FS.writeFile(inputPath, code)
  pyodide.globals.set('input_path', inputPath)
  pyodide.globals.set('output_path', outputPath)

  const start = performance.now()
  await pyodide.runPythonAsync(`
from pathlib import Path

from ghedesigner.main import run
from pyodide.http import pyfetch

run(Path(input_path), Path(output_path))
print("  ✅ Simulation Successful")
`)
  const end = performance.now()

  const files = (await listFiles(outputPath)).reduce<Record<string, string>>((acc, file) => {
    const filename = file.startsWith(outputPath) ? file.slice(outputPath.length) : file
    acc[filename] = decoder.decode(pyodide.FS.readFile(file))
    return acc
  }, {})

  sendMessage({
    type: 'result',
    id,
    captured,
    files,
    time: Math.round((end - start) / 100) / 10,
  })
  captured.length = 0
}

async function rmdirRecursive(path: string) {
  const pyodide = await pyodideReady

  for (const name of pyodide.FS.readdir(path)) {
    if (name === '.' || name === '..') continue
    const child = `${path}/${name}`
    const stat = pyodide.FS.stat(child)
    if (pyodide.FS.isDir(stat.mode)) {
      await rmdirRecursive(child)
    } else {
      pyodide.FS.unlink(child)
    }
  }

  pyodide.FS.rmdir(path)
}

async function closeFile({ name }: Extract<RequestWithId, { type: 'closeFile' }>) {
  const pyodide = await pyodideReady
  const path = `/home/pyodide/${name}`
  console.log('Unlinking', `${path}.json`)
  // TODO check if file exists before deleting
  pyodide.FS.unlink(`${path}.json`)
  console.log('rmdir', path)
  await rmdirRecursive(`${path}/`)

  console.log(await listFiles('/home/pyodide/'))
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

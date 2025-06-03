import { Uri } from 'monaco-editor'

const uriToName = (uri: string) => Uri.parse(uri).path.replace(/^\/|\.json$/g, '')

// TODO should this distinguish between `user` and `demo` files?
export const uniqueUri = (uri: string, existingUris: string[]) => {
  const name = uriToName(uri)
  const existingNames = new Set(existingUris.map(uriToName))

  const nameRoot = name.replace(/ \(\d+\)$/, '')
  let newName = nameRoot
  if (!existingNames.has(newName)) {
    return `inmemory://user/${newName}.json`
  }

  let i = 0
  do {
    newName = `${nameRoot} (${++i})`
  } while (existingNames.has(newName))
  return `inmemory://user/${newName}.json`
}

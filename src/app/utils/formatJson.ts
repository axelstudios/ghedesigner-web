import prettier from 'prettier/standalone'
import prettierBabelPlugin from 'prettier/plugins/babel'
import prettierPluginEstree from 'prettier/plugins/estree'

export const formatJson = async (json: string) =>
  prettier.format(json, {
    parser: 'json',
    printWidth: 80,
    plugins: [prettierBabelPlugin, prettierPluginEstree],
  })

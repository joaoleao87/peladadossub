import { readFile, writeFile } from 'node:fs/promises'

const path = new URL('../ios/App/App/capacitor.config.json', import.meta.url)
const config = JSON.parse(await readFile(path, 'utf8'))
config.packageClassList = [...new Set([...(config.packageClassList ?? []), 'MatchControlsPlugin'])]
await writeFile(path, `${JSON.stringify(config, null, '\t')}\n`)

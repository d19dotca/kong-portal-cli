
import { join } from 'upath'
import { isBinaryFile } from 'isbinaryfile'

import File from '../core/File'
import Workspace from '../core/Workspace'
import RestClient from '../core/HTTP/RestClient'

import { MissingWorkspaceError } from '../helpers'


async function shouldRewriteFile(resource, file: File, keepEncode: boolean): Promise<boolean> {
  const shasum = await file.getShaSum()

  if (shasum !== resource.checksum) {
    return true
  }
  if (keepEncode && (await isBinaryFile(file.location))) {
    return true
  }
  if (!keepEncode && file.isBase64Asset()) {
    await file.read()
    if (file.resource.contents.startsWith('data:')) {
      return true
    }
  }

  return false
}

export default async (args): Promise<void> => {
  let workspace: Workspace
  let client: RestClient

  try {
    workspace = await Workspace.init(args.workspace)
  } catch (e) {
    return MissingWorkspaceError(args.workspace)
  }

  client = new RestClient(workspace.config, workspace.name)
  let response
  try {
    response = await client.getAllFiles()
  } catch (e) {
    console.log(e)
    return
  }

  let added = 0
  let modified = 0

  if (response) {
    for (let resource of response) {
      let path: string = join(workspace.path, resource.path)
      let file: File = new File(path, workspace.path, workspace.name)
      if (await file.exists()) {
        if (await shouldRewriteFile(resource, file, args.keepEncode)) {
          file.write(resource.contents)
          console.log('\t', 'Modified:', resource.path)
          modified += 1
        }
      } else {
        file.write(resource.contents)
        console.log('\t', 'Added:', resource.path)
        added += 1
      }
    }
  }

  console.log('\t', `Fetched ${response.length} files`)

  if (!modified || added) {
    console.log('\t', 'No changes.')
  }

  console.log('')
  console.log('Done.')
}

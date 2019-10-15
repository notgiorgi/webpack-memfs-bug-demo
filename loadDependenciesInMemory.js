// Based on:
// https://github.com/cerebral/webpack-sandbox/blob/master/src/memoryFs.js

var path = require('path')
var recursiveReaddir = require('recursive-readdir')

var loadedDeps = []

async function preLoadPackage({ packageName: name, fs, rootPath }) {
  // fsevents is MAC specific
  if (name === 'fsevents') {
    return
  }

  if (loadedDeps.indexOf(name) >= 0) {
    return
  }

  loadedDeps.push(name)

  var packagePath = path.resolve(__dirname, 'node_modules', name)
  var packageJsonFile = await fs.input.promises.readFile(path.join(packagePath, 'package.json'))
  const packageJson = JSON.parse(packageJsonFile.toString())

  // recursiveReaddir uses require('fs') and no way of configuring it :(
  const files = await recursiveReaddir(packagePath)

  await Promise.all(
    files.map(async function(filePath) {
      const relativePath = filePath
        .split('/node_modules/')
        .slice(1)
        .join('/node_modules/')
      const outputPath = path.join(rootPath, 'node_modules', relativePath)

      const dirname = path.dirname(outputPath)

      const dirExists = await fileExists(fs, dirname)
      if (!dirExists) {
        await fs.output.promises.mkdir(dirname, { recursive: true })
      }

      if (path.extname(filePath)) {
        const content = await fs.input.promises.readFile(filePath, 'utf8')
        return fs.output.promises.writeFile(outputPath, content || ' ')
      }
    }),
  )

  await Promise.all(
    Object.keys(packageJson.dependencies || {}).map(dep =>
      preLoadPackage({ packageName: dep, fs, rootPath }),
    ),
  )
}

module.exports = function({ packages, ...rest }) {
  return Promise.all(
    packages.map(packageName => {
      return preLoadPackage({ packageName, ...rest })
    }),
  )
}

async function fileExists(fs, path) {
  try {
    await fs.promises.access(path, fs.constants.F_OK)
    return true
  } catch (e) {
    return false
  }
}

const webpack = require('webpack')
const realFs = require('fs')
const path = require('path')
const memfs = require('memfs')
const joinPath = require('memory-fs/lib/join')

const babelConfig = require('./.babelrc.js')
const loadDependenciesInMemory = require('./loadDependenciesInMemory')


// create memory fs with the index.js file
const vol = new memfs.Volume.fromJSON({
  // /memfs will be the root dir for memfs, helps to distinguish from 
  // real FS in error messages
  '/memfs/index.js': `
    console.log('Hello world')
  `
})
const fs = ensureWebpackMemoryFs(memfs.createFsFromVolume(vol))

loadDependenciesInMemory({
  packages: ['babel-loader'],
  rootPath: '/memfs/',
  fs: {
    input: realFs,
    output: fs,
  },
})
.then(() => {
  const compiler = webpack({
    mode: 'production',
    entry: '/memfs/index.js',
    context: '/memfs/',
    output: {
      filename: '[name].min.js',
      path: '/memfs/dist',
    },
  
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: babelConfig,
          },
        },
      ],
    },
  })
  
  
  
  compiler.inputFileSystem = fs
  compiler.outputFileSystem = fs
  
  compiler.run(function webpackCompilerRunCallback(err, stats) {
    if (err) {
      console.error(err)
      return
    }
    if (stats.hasErrors()) {
      console.error(stats.toJson().errors)
      return
    }
    if (stats.hasWarnings()) {
      console.warn(stats.toJson().warnings)
    }
  
    console.log(stats.toJson('minimal'))
  })

})
.catch(err => {
  throw err
})

function ensureWebpackMemoryFs(fs) {
  // Return it back, when it has Webpack 'join' method
  if (fs.join) {
    return fs
  }

  // Create FS proxy, adding `join` method to memfs, but not modifying original object
  const nextFs = Object.create(fs)
  nextFs.join = joinPath

  return nextFs
}
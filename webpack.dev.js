/**
 * webpack script for development configuration
 */


const renderer = require('./webpack.renderer')
const main = require('./webpack.main')
const preload = require('./webpack.preload')


module.exports = [
  /*handle renderer */
  {
    mode: 'development',
    devtool: 'source-map',
    ...renderer
  },
  /*handle main */
  {
    mode: 'development',
    devtool: 'source-map',
    ...main
  },
  /*preload*/
  {
    mode: 'development',
    devtool: 'source-map',
    ...preload
  }
]
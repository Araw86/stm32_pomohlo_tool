/**
 * webpack script for production production configuration
 */

const renderer = require('./webpack.renderer')
const main = require('./webpack.main')
const preload = require('./webpack.preload')


module.exports = [
  /*handle renderer */
  {
    mode: 'production',
    ...renderer
  },
  /*handle main */
  {
    mode: 'production',
    ...main
  },
  /*preload*/
  {
    mode: 'production',
    ...preload
  }
]
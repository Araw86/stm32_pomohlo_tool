/**
 * configuration for preload part of webpack
 */

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports =
{
  entry: './src/main/preload/preload.ts',
  target: 'electron-preload',
  module: {
    rules: [{
      test: /\.ts$/,
      include: [path.resolve(__dirname, 'src/main/preload')],
      use: [{ loader: 'ts-loader' }]
    }]
  },
  output: {
    path: path.join(__dirname, 'build', 'main', 'preload'),
    filename: 'preload.js',
    // clean: true
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./database/*.json", to: path.resolve(__dirname, 'build') }
      ],
    })
  ]
}
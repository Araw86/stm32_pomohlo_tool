/**
 * configuration for renderer part of webpack
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports =
{
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        include: [path.resolve(__dirname, 'src/renderer'), path.resolve(__dirname, 'src/shared')],
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: [/\.css$/i],
        use: [
          // Creates `style` nodes from JS strings
          'style-loader',
          // Translates CSS into CommonJS
          'css-loader',
        ],
      },
      {
        test: [/\.s[ac]ss$/i],
        use: [
          // Creates `style` nodes from JS strings
          'style-loader',
          // Compiles Sass to CSS
          'sass-loader',
        ],
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.node', '...'],
  },
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'build', 'renderer'),
    clean: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'electron redux app',
      filename: 'index.html',
      template: 'src/renderer/index.html'
    })
  ]

}
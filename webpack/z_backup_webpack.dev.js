const path = require('path');

const { IgnorePlugin } = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');

const CopyPlugin = require('copy-webpack-plugin');

/* ignore fsevents module which caused error in electron  */
const optionalPlugins = [];
if (process.platform !== "darwin") {
  optionalPlugins.push(new IgnorePlugin({ resourceRegExp: /^fsevents$/ }));
}


module.exports = [
  /*handle renderer */
  {
    mode: 'development',
    entry: './src/renderer/index.tsx',
    devtool: 'source-map',
    target: 'electron-renderer',
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          include: [path.resolve(__dirname, 'src/renderer')],
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

  },
  /*handle main */
  {
    mode: 'development',
    entry: './src/main/main.ts',
    devtool: 'source-map',
    target: 'electron-main',
    module: {
      rules: [{
        test: /\.ts$/,
        include: [path.resolve(__dirname, 'src/main')],
        use: [{ loader: 'ts-loader' }]
      }]
    },
    resolve: {
      extensions: ['.ts', '.js', '.json', '.node', '...'],
    },
    output: {
      path: path.resolve(__dirname, 'build', 'main'),
      //clean: true
    },
    plugins: [
      ...optionalPlugins,
    ],
    externals: {
      sqlite3: 'commonjs sqlite3',
    },
  },
  /*handle main preload */
  {
    mode: 'development',
    entry: './src/main/preload/preload.ts',
    devtool: 'source-map',
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

];
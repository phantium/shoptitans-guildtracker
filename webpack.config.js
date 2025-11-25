const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/renderer/index.jsx',
  target: 'web',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  optimization: {
    concatenateModules: false
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    fullySpecified: false,
    fallback: {
      "path": false,
      "fs": false,
      "crypto": false,
      "stream": false,
      "util": false,
      "buffer": require.resolve('buffer/'),
      "process": require.resolve('process/browser.js'),
      "process/browser": require.resolve('process/browser.js')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.NormalModuleReplacementPlugin(
      /^process\/browser$/,
      require.resolve('process/browser.js')
    ),
    new webpack.DefinePlugin({
      'global': 'window'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/tesseract.js/dist/worker.min.js',
          to: 'tesseract/worker.min.js'
        },
        {
          from: 'node_modules/tesseract.js-core/tesseract-core.wasm.js',
          to: 'tesseract/tesseract-core.wasm.js'
        },
        {
          from: 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
          to: 'tesseract/tesseract-core-lstm.wasm.js'
        }
      ]
    })
  ]
};


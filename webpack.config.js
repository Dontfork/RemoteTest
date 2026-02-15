const path = require('path');
const webpack = require('webpack');

module.exports = {
    target: 'node',
    mode: 'production',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^cpu-features$/
        }),
        new webpack.IgnorePlugin({
            resourceRegExp: /sshcrypto\.node$/
        })
    ],
    devtool: 'source-map'
};

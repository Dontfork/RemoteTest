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
        extensions: ['.ts', '.js'],
        alias: {
            'cpu-features': false
        }
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
        ],
        unknownContextCritical: false,
        exprContextCritical: false
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^cpu-features$/
        }),
        new webpack.NormalModuleReplacementPlugin(
            /\.\/crypto\/build\/Release\/sshcrypto\.node$/,
            path.resolve(__dirname, 'src/stubs/empty.js')
        )
    ],
    devtool: 'source-map',
    ignoreWarnings: [
        {
            module: /ssh2\/lib\/protocol\/crypto\.js/
        }
    ]
};

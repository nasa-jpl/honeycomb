const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const cssAutoPrefixPlugin = require('autoprefixer');
const merge = require('lodash.merge');
const currentDirectory = path.resolve('.');

const createConfig = (config, currentDirectory) => env => {
    const distFolder = path.basename(config.output.path);

    const GLOBALS = {
        // Make package.json version available as a global variable
        __VERSION__: JSON.stringify(
            require(path.resolve(currentDirectory, 'package.json')).version,
        ),
        __DEV__: !env || env.development || env.dev || (!env.production && !env.prod),
    };

    // postCSS loader for applying autoprefixer
    const postCSSLoader = () => {
        return {
            loader: 'postcss-loader',
            options: {
                postcssOptions: {
                    plugins: [cssAutoPrefixPlugin()], // applies autoprefixer to handle cross-browser styling
                },
                sourceMap: GLOBALS.__DEV__,
            },
        };
    };

    // CSS loader for loading @import and url() in style files. "enableModules" parameter to enable/disable cssModules
    const cssLoader = enableModules => {
        return {
            loader: 'css-loader',
            options: {
                url: false,
                modules: enableModules
                    ? {
                        localIdentName: '[name]__[local]___[hash:base64:5]',
                    }
                    : false,
                importLoaders: 1,
                sourceMap: GLOBALS.__DEV__,
            },
        };
    };

    // extract style modules into a single file
    const ExtractStyles = new MiniCssExtractPlugin();

    const defaultConfig = {
        devServer: {
            contentBase: [
                path.join(currentDirectory, 'dist'),
                path.join(currentDirectory, '..', '..'),
            ],
            compress: true,
            port: 9000,
            inline: false,
            hot: false,
            writeToDisk: true,
        },
        mode: GLOBALS.__DEV__ ? 'development' : 'production',
        devtool: GLOBALS.__DEV__ ? 'eval-source-map' : false,
        plugins: [
            new webpack.DefinePlugin(GLOBALS),
            new CleanWebpackPlugin({
                cleanOnceBeforeBuildPatterns: ['**/*', '!env.js'],
            }),
            // This is required because path-browserify assumes
            // process is defined globally
            new webpack.ProvidePlugin({
                process: require.resolve('process/browser'),
                Buffer: ['buffer', 'Buffer'],
            }),
            // Only include the html if we're building out to the browser directory
            ...(distFolder === 'browser' || distFolder === 'electron'
                ? [
                    new HtmlWebpackPlugin({
                        template: 'src/index.html',
                        inject: false, // do not auto-inject, we'll handle it with templating
                        filename: path.resolve(
                            currentDirectory,
                            'dist/' + distFolder + '/index.html',
                        ),
                        hash: true, // hash in a query string for cache busting
                        minify: GLOBALS.__DEV__
                            ? false
                            : {
                                collapseWhitespace: true,
                                removeComments: true,
                                removeRedundantAttributes: true,
                                removeScriptTypeAttributes: true,
                                removeStyleLinkTypeAttributes: true,
                                useShortDoctype: true,
                                minifyCSS: true,
                            },
                    }),
                ]
                : []),
            ExtractStyles,
        ],
        module: {
            rules: [
                {
                    test: /\.[tj]sx?$/,
                    enforce: 'pre',
                    use: 'source-map-loader',
                    exclude: /(https-proxy-agent|rosbag)/, // TODO: temporary fix until rosbag issue #42 is fixed
                },
                {
                    exclude: /(node_modules)/,
                    test: /\.[tj]sx?$/,
                    use: {
                        loader: 'swc-loader',
                        options: {
                            jsc: {
                                target: 'es2020',
                                loose: false,
                                parser: {
                                    syntax: 'typescript',
                                    tsx: true,
                                    decorators: false,
                                    dynamicImport: true,
                                },
                                transform: {
                                    "react": {
                                        "runtime": "automatic"
                                    }
                                }
                            },
                        },
                    },
                },
                {
                    test: /\.worker\.js$/,
                    use: [
                        // GLOBALS.__DEV__ || isElectron ? undefined : babelLoader(),
                        {
                            loader: 'worker-loader',
                            options: {
                                inline: 'fallback',
                            },
                        },
                    ],
                },
                {
                    test: /\.(css)$/,
                    use: [MiniCssExtractPlugin.loader, cssLoader(true), postCSSLoader()],
                },
                {
                    // needed for view cube loading
                    test: /\.(png|fbx)$/i,
                    include: path.resolve(currentDirectory, '../../'),
                    use: [
                        {
                            loader: 'url-loader',
                        },
                    ],
                },
            ],
        },
    };

    return merge(defaultConfig, config);
};

const browserConfig = createConfig({
    target: 'web',
    name: 'browser',
    entry: {
        index: path.resolve(currentDirectory, 'src/index.tsx'),
    },
    output: {
        path: path.resolve(currentDirectory, 'dist', 'browser'),
        filename: '[name].js',
    },
    resolve: {
        fallback: {
            'path': require.resolve('path-browserify'),
            'crypto': require.resolve('crypto-browserify'),
            'stream': require.resolve('stream-browserify'),
            'os': require.resolve('os-browserify/browser'),
            'http': require.resolve('stream-http'),
            'https': require.resolve('https-browserify'),
            'zlib': require.resolve('browserify-zlib'),
            'net': false,
            'tls': false,
            'fs': false,
            'express': false,
        },
        extensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".scss"]
    },
}, currentDirectory);

const electronConfig = createConfig({
    target: 'electron-renderer',
    entry: {
        index: path.resolve(currentDirectory, 'src/electron/index.tsx'),
    },
    output: {
        path: path.resolve(currentDirectory, 'dist', 'electron'),
        filename: '[name].js',
    },
    resolve: {
        mainFields: ['module', 'main'],
        extensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".scss"]
    },
}, currentDirectory);

module.exports = [browserConfig, electronConfig];

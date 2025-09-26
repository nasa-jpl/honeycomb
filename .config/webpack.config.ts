import ESLintPlugin from 'eslint-webpack-plugin';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { type Configuration, ProvidePlugin } from 'webpack';

import os from 'os';
import fs from 'fs';


function isWSL() {
    if (process.platform !== 'linux') {
        return false;
    }

    if (os.release().toLowerCase().includes('microsoft')) {
        return true;
    }

    try {
        return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    } catch {
        return false;
    }
}

const config = (env: any): Configuration => {
    const baseConfig: Configuration = {
        cache: {
            type: 'filesystem',
            buildDependencies: {
                config: [__filename],
            },
        },

        // devtool: env.production ? 'source-map' : false,
        devtool: 'eval-source-map',

        externals: [
            // Required for dynamic publicPath resolution
            { 'amd-module': 'module' },
            'lodash',
            'jquery',
            'moment',
            'slate',
            'emotion',
            '@emotion/react',
            '@emotion/css',
            'prismjs',
            'slate-plain-serializer',
            '@grafana/slate-react',
            'react',
            'react-dom',
            'react-redux',
            'redux',
            'rxjs',
            'i18next',
            'react-router',
            'd3',
            'angular',
            /^@grafana\/ui/i,
            /^@grafana\/runtime/i,
            /^@grafana\/data/i,

            // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
            ({ request }, callback) => {
                const prefix = 'grafana/';
                const hasPrefix = (request: string) => request.indexOf(prefix) === 0;
                const stripPrefix = (request: string) => request.substr(prefix.length);

                if (request && hasPrefix(request)) {
                    return callback(undefined, stripPrefix(request));
                }

                callback();
            },
        ],

        // Support WebAssembly according to latest spec - makes WebAssembly module async
        experiments: {
            asyncWebAssembly: true,
        },

        mode: env.production ? 'production' : 'development',

        module: {
            rules: [
                {
                    test: /\.frag$/i,
                    use: 'raw-loader',
                },
                {
                    test: /\.fbx$/i,
                    use: [
                        {
                            loader: 'file-loader',
                        },
                    ],
                },
                // This must come first in the rules array otherwise it breaks sourcemaps.
                {
                    test: /src\/(?:.*\/)?module\.tsx?$/,
                    use: [
                        {
                            loader: 'imports-loader',
                            options: {
                                imports: `side-effects grafana-public-path`,
                            },
                        },
                    ],
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
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.s[ac]ss$/,
                    use: ['style-loader', 'css-loader', 'sass-loader'],
                },
                {
                    test: /\.(png|jpe?g|gif|svg)$/,
                    use: ['file-loader'],
                    // generator: {
                    //     filename: Boolean(env.production) ? '[hash][ext]' : '[file]',
                    // },
                },
                {
                    test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
                    type: 'asset/resource',
                    generator: {
                        filename: Boolean(env.production) ? '[hash][ext]' : '[file]',
                    },
                },
            ],
        },

        optimization: {
            minimize: Boolean(env.production),
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        format: {
                            comments: (_, { type, value }) => type === 'comment2' && value.trim().startsWith('[create-plugin]'),
                        },
                        compress: {
                            drop_console: ['log', 'info'],
                        },
                    },
                }),
            ],
        },

        plugins: [
            new ProvidePlugin({
                process: 'process/browser',
            }),
            new ForkTsCheckerWebpackPlugin({
                async: Boolean(env.development),
                issue: {
                    include: [{ file: '**/*.{ts,tsx}' }],
                },
                typescript: { configFile: path.join(process.cwd(), 'tsconfig.json') },
            }),
            new ESLintPlugin({
                extensions: ['.ts', '.tsx'],
                lintDirtyModulesOnly: Boolean(env.development), // don't lint on start, only lint changed files
                overrideConfigFile: path.resolve(__dirname, "../eslint.config.mjs"),
                configType: "flat",
                eslintPath: "eslint/use-at-your-own-risk"
            }),
            ...(env.development
                ? [new LiveReloadPlugin()]
                : []),
        ],

        resolve: {
            mainFields: ['browser', 'module', 'main'],
            extensions: ['.js', '', '.ts', '.tsx'],
            extensionAlias: {
                '.js': ['.js', '.ts'],
            },
            // handle resolving "rootDir" paths
            modules: [
                path.resolve(process.cwd(), 'src'),
                path.resolve(process.cwd(), 'node_modules'),
                'node_modules'
            ],
            fallback: {
                'process/browser': require.resolve('process/browser')
            },
            alias: { 'path': require.resolve('path-browserify') }
        },
    };

    if (isWSL()) {
        baseConfig.watchOptions = {
            poll: 3000,
            ignored: /node_modules/,
        };
    }

    return baseConfig;
};

export default config;

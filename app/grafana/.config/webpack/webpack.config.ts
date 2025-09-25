import path from 'path';
import {
    BannerPlugin,
    Configuration,
} from "webpack";

import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import CopyWebpackPlugin from 'copy-webpack-plugin';

import baseConfig from "../../../../.config/webpack.config";

import {
    getCPConfigVersion,
    getEntries,
    getPackageJson,
    getPluginJson,
    hasReadme,
} from './utils';

export const SOURCE_DIR = 'src';
export const DIST_DIR = 'dist';

const pluginJson = getPluginJson(SOURCE_DIR);
const cpVersion = getCPConfigVersion();

const virtualPublicPath = new VirtualModulesPlugin({
    'node_modules/grafana-public-path.js': `
import amdMetaModule from 'amd-module';

__webpack_public_path__ =
  amdMetaModule && amdMetaModule.uri
    ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
    : 'public/plugins/${pluginJson.id}/';
`,
});

const config = async (env): Promise<Configuration> => {
    const c = baseConfig(env);

    return {
        ...c,
        context: path.join(process.cwd(), SOURCE_DIR),
        entry: await getEntries(),

        output: {
            clean: {
                keep: new RegExp(`(.*?_(amd64|arm(64)?)(.exe)?|go_plugin_build_manifest)`),
            },
            filename: '[name].js',
            library: {
                type: 'amd',
            },
            path: path.resolve(process.cwd(), DIST_DIR),
            publicPath: `public/plugins/${pluginJson.id}/`,
            uniqueName: pluginJson.id,
        },

        plugins: [
            virtualPublicPath,
            // Insert create plugin version information into the bundle
            new BannerPlugin({
                banner: '/* [create-plugin] version: ' + cpVersion + ' */',
                raw: true,
                entryOnly: true,
            }),
            new CopyWebpackPlugin({
                patterns: [
                    // If src/README.md exists use it; otherwise the root README
                    // To `compiler.options.output`
                    { from: hasReadme(SOURCE_DIR) ? 'README.md' : '../README.md', to: '.', force: true },
                    { from: 'plugin.json', to: '.' },
                    { from: '../LICENSE', to: '.' },
                    { from: '../CHANGELOG.md', to: '.', force: true },
                    { from: '**/*.json', to: '.' }, // TODO<Add an error for checking the basic structure of the repo>
                    { from: '**/*.svg', to: '.', noErrorOnMissing: true }, // Optional
                    { from: '**/*.png', to: '.', noErrorOnMissing: true }, // Optional
                    { from: '**/*.html', to: '.', noErrorOnMissing: true }, // Optional
                    { from: 'img/**/*', to: '.', noErrorOnMissing: true }, // Optional
                    { from: 'libs/**/*', to: '.', noErrorOnMissing: true }, // Optional
                    { from: 'static/**/*', to: '.', noErrorOnMissing: true }, // Optional
                    { from: '**/query_help.md', to: '.', noErrorOnMissing: true }, // Optional
                ],
            }),
            // Replace certain template-variables in the README and plugin.json
            new ReplaceInFileWebpackPlugin([
                {
                    dir: DIST_DIR,
                    files: ['plugin.json', 'README.md'],
                    rules: [
                        {
                            search: /\%VERSION\%/g,
                            replace: getPackageJson().version,
                        },
                        {
                            search: /\%TODAY\%/g,
                            replace: new Date().toISOString().substring(0, 10),
                        },
                        {
                            search: /\%PLUGIN_ID\%/g,
                            replace: pluginJson.id,
                        },
                    ],
                },
            ]),

            ...(c.plugins ?? [])
        ]
    };
};

export default config;

const path = require('path');
const os = require('os');
const { app, dialog, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const yargs = require('yargs');

// set up command line args
yargs
    .option('memory', {
        alias: 'm',
        type: 'number',
        description: 'Max memory allocation for the application in megabytes and capped at 75% of the system memory.',
        default: 4096,
    })
    .options('console', {
        alias: 'c',
        type: 'boolean',
        description: 'Open the debug console.',
        default: false,
    });

const argv = yargs.argv;


// max-old-space-size: The amound of memory in mb a javascript process can use.
// Defaults to 1GB on 64bit machines, 512MB on 32bit machines.
// expose-gc: expose "global.gc()" function to run garbage collection.
// enable-precise-memory-info: function to expose more precise memory information in chrome tools.

// TODO: should we use os.freemem() here instead?
const osMemory = os.totalmem() / (1024 * 1024);
let allowedMemoryAllocation = argv.memory;
if (osMemory * 0.75 < allowedMemoryAllocation) {
    allowedMemoryAllocation = Math.floor(osMemory * 0.75);
    console.warn(
        `Requested memory is more than system afford. Setting allowed memory to ${allowedMemoryAllocation}mb.`,
    );
}

app.commandLine.appendSwitch(
    'js-flags',
    `--max-old-space-size=${allowedMemoryAllocation} --expose-gc`,
);
app.commandLine.appendSwitch('--enable-precise-memory-info');

let win = null;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 2000,
        height: 1800,
        webPreferences: {
            nodeIntegration: true,
            backgroundThrottling: false,
            contextIsolation: false,
        },
    });

    if (argv.console) {
        win.webContents.openDevTools();
    }

    // and load the index.html of the app.
    win.loadFile(path.resolve(__dirname, '../../dist/electron/index.html'));
    let menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Config File',
                    click() {
                        const filePaths = dialog.showOpenDialogSync(
                            win,
                            {
                                title: 'Choose config file',
                                properties: ['openFile'],
                                filters: [{ name: 'Configs', extensions: ['json'] }],
                            }
                        );
                        if (filePaths) {
                            win.webContents.send('loadConfig', filePaths[0]);
                        }
                    },
                },
                {
                    label: 'Open ARKSML/RKSML Files',
                    click() {
                        const filePaths = dialog.showOpenDialogSync(
                            win,
                            {
                                title: 'Choose ARKSML/RKSML Files',
                                properties: ['openFile', 'multiSelections'],
                                filters: [
                                    { name: 'ARKSML/RKSML', extensions: ['arksml', 'rksml'] },
                                ],
                            }
                        );
                        if (filePaths) {
                            win.webContents.send('loadFilePaths', filePaths);
                        }
                    },
                },
                {
                    type: 'separator',
                },
                {
                    label: 'Quit',
                    accelerator: 'Command+Q',
                    click: () => { app.quit(); },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
            ],
        },
        {
            label: 'Debug',
            submenu: [
                {
                    label: 'Open Console',
                    click() {
                        // Open the DevTools.
                        win.webContents.openDevTools();
                    },
                },
                {
                    label: 'Open Repo',
                    click() {
                        shell.openExternal('https://github.com/nasa-jpl/honeycomb');
                    },
                },
                {
                    label: 'Submit Bug',
                    click() {
                        shell.openExternal(
                            'https://github.com/nasa-jpl/honeycomb/issues/new?assignees=&labels=bug&template=---bug-report.md&title=',
                        );
                    },
                },
            ],
        },
    ]);
    Menu.setApplicationMenu(menu);

    ipcMain.on('handleDropZoneClicked', (event, args) => {
        const filePaths = dialog.showOpenDialogSync(
            win,
            {
                title: 'Choose Telemetry Files',
                properties: ['openFile', 'multiSelections'],
                filters: [
                    {
                        name: 'Telemetry',
                        extensions: [
                            'arksml',
                            'rksml',
                            'gltf',
                            'glb',
                            'dae',
                            'stl',
                            'fbx',
                            'obj',
                            'pgm',
                            'mod',
                        ],
                    },
                ],
            }
        );
        if (filePaths) {
            win.webContents.send('dropZoneClickedResp', filePaths);
        }
    });
    
    ipcMain.on('handleSpiceClick', (event, args) => {
        const filePaths = dialog.showOpenDialogSync(
            win,
            {
                title: 'Choose SPICE Meta Kernel File',
                properties: ['openFile'],
            }
        );
        if (filePaths) {
            win.webContents.send('spiceClickResp', filePaths);
        }
    });

    ipcMain.on('getAppPath', (event, args) => {
        event.returnValue = app.getAppPath();
    });
}

app.on('ready', createWindow);

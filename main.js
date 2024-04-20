
const { app, BrowserWindow, ipcMain, nativeTheme, Menu, MenuItem } = require('electron')
const path = require('path');
const url = require('url');
const fs = require('fs');
const minimist = require('minimist');
const { exec } = require('child_process');
const USER_AGENT_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';



const args = minimist(process.argv);
let userAgent = args.userAgent || USER_AGENT_CHROME || null; // default chrome ua to avoid Bilibili detection




const createEntryWindow = async () => {
    const win = new BrowserWindow({
        width: 640,
        height: 480,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
    })
    globalThis.entryWindow = win;
    
    await win.loadFile('entry.html');
    if (userAgent) win.webContents.setUserAgent(userAgent);

    win.on('closed', () => app.quit());
}

const createOrLoadPlayWindow = async (vid, cid) => {
    if (globalThis.playWindow) {
        if (!(globalThis.playWindow.vid === vid && globalThis.playWindow.cid === cid)) {
            globalThis.playWindow.vid = vid;
            globalThis.playWindow.cid = cid;
            globalThis.playWindow.webContents.send('play_window.load_info');
        }
        globalThis.playWindow.focus();
        return globalThis.playWindow;
    }

    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            autoplayPolicy: 'no-user-gesture-required',
        },
        autoHideMenuBar: true,
    })
    globalThis.playWindow = win;
    globalThis.playWindow.vid = vid;
    globalThis.playWindow.cid = cid;

    nativeTheme.themeSource = 'dark';

    await win.loadFile('play.html');

    win.on('closed', () => ((globalThis.playWindow = null), (nativeTheme.themeSource = 'light')));
    // win.webContents.send('play_window.load_info');

}

const createLoginWindow = function createLoginWindow() {
    return new Promise(resolve => {
        if (createEntryWindow.__obj) try {
            createEntryWindow.__obj.focus();
            return resolve();
        } catch { createEntryWindow.__obj = null; }
        const obj = new BrowserWindow({
            width: 1024,
            height: 768,
            autoHideMenuBar: true
        });
        createEntryWindow.__obj = obj;
        createLoginWindow.__period = 1;
        obj.loadURL('https://passport.bilibili.com/login').then(() => {
            obj.on('close', () => {
                createLoginWindow.__obj = null
                resolve(false);
            });
            const fn = () => {
                const title = obj.webContents.getTitle();
                // console.log(title)
                if (!(/登录/.test(title))) {
                    if (createLoginWindow.__period == 2) {
                        resolve(true);
                        obj.close();
                    }
                } else {
                    createLoginWindow.__period = 2;
                }
            }
            obj.on('page-title-updated', fn);
            queueMicrotask(fn);
        
        });
    });
}


const bxapiWebView = async function (url) {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        autoHideMenuBar: true,
        webPreferences: {
            autoplayPolicy: 'document-user-activation-required'
        }
    });
    // console.log(ev.senderFrame);
    const promise = win.loadURL(url)
    win.webContents.setWindowOpenHandler((details) => {
        bxapiWebView(details.url)
        return { action: 'deny' };
    });
    await promise
    return win;
}


function getsid() {
    return new Promise((resolve, reject) => {

        // 调用sidme
        exec('sidme', (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout)
        });
    });
}


const ipcHandlers = {
    'bxloginapi.open': createLoginWindow,
    'bxloginapi.logout': () => new Promise(async (resolve) => {
        const win = new BrowserWindow({
            width: 1,
            height: 1,
            frame: false,
            opacity: 0,
            focusable: false,
            webSecurity: false
        });
        await win.loadURL('https://passport.bilibili.com/login/exit/v2', {
            postData: []
        })
        await win.webContents.session.clearStorageData({ storages: ['cookies'] });
        win.destroy();
        resolve();
    }),
    'bxloginapi.getState': () => new Promise(async (resolve) => {
        const win = new BrowserWindow({
            width: 1,
            height: 1,
            frame: false,
            opacity: 0,
            focusable: false,
        });
        // setTimeout(() => {
        //     win.destroy();
        //     resolve(false);
        // }, 10000);
        await win.loadURL('https://api.bilibili.com/x/kv-frontend/namespace/data');
        try {
            const dede = ((await win.webContents.session.cookies.get({ name: 'DedeUserID', domain: '.bilibili.com' }))[0].value);
            // win.destroy();
            resolve(!!dede)
        } catch { resolve(false) }
        win.destroy();
    }),
    'webrequestapi.get'(ev, url) {
        // console.dir(url)
        // console.log('fetching url: ' + url);
        return new Promise((resolve, reject) => {
            // console.log('request ', url)
            fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                }
            }).then(v => v.text()).then(resolve).catch(reject);
        });
    },
    'entry::initWindow'() {
        let vid = args.video;
        if (!vid) vid = process.argv[1];
        if (vid === '.') vid = process.argv[2];
        if (vid && vid.startsWith('-')) vid = args.video; // don't parse options as video
        let title = args.title || null;
        return { vid, title };
    },
    'alertMessageWidget': (ev, message, title, type) => new Promise(async resolve => {
        const win = new BrowserWindow({
            width: 500,
            height: 300,
            webPreferences: {
                preload: path.join(__dirname, 'alertMessageWidget.preload.js')
            },
            autoHideMenuBar: true,
            titleBarStyle: 'hidden',
            titleBarOverlay: true,
        });
        // console.log(ev.senderFrame);
        await win.loadFile('alertMessageWidget.html');
        title = title || app.name;
        win.webContents.send('alertMessageWidget', message, title, type === 'confirm' ? 'confirm' : 'alert');
        win.webContents.ipc.on('alertMessageWidget-reply', (ev, result) => {
            resolve(result);
            win.destroy();
        });
        win.on('closed', () => resolve(false));
    }),
    async 'bxapi.play'(ev, vid, cid) {
        createOrLoadPlayWindow(vid, cid);
    },
    async 'bxapi.web'(ev, url) {
        await bxapiWebView(url)
        return true
    },
    async 'bxplay.getif'() {
        return {
            vid: globalThis.playWindow.vid,
            cid: globalThis.playWindow.cid,
            
        };
    },
    'bxapi.autoPlayOptions': (ev, param) => new Promise(async (resolve) => {
        if (typeof param === 'boolean') {
            if (!param) fs.unlink('autoplay=enabled', () => resolve(false));
            else fs.writeFile('autoplay=enabled', 'true', () => resolve(true));
            return;
        }
        return resolve(true);
        // fs.access('autoplay=enabled', (err) => {
        //     resolve(!err);
        // });
    }),
    'bxapi.switchToEntry'() {
        globalThis.entryWindow.focus();
    },
    // 'bxplay.applyPlay'() {
    //     globalThis.playWindow.webContents.executeJavaScript(`document.getElementById('video').play()`, true);
    // },
    'bxplay.playEnded'() {
        globalThis.entryWindow.webContents.send('bxplay.playEnded');
    },
    'bxapi.getDispatchAutoOpenOption'() {
        const p = args.p;
        return {
            vid: ipcHandlers['entry::initWindow']().vid,
            p,
        };
    },
    'bxapi.closePlayWindow'() {
        if (globalThis.playWindow) playWindow.destroy();  
    },
    async 'bxapi.showHistory'() {
        exec("cmd /c start USER-HISTORY_" + await getsid() + "_.csv");
    },
    'bxsendsearch': (ev, message) => new Promise(async resolve => {
        const win = new BrowserWindow({
            width: 1024,
            height: 768,
            autoHideMenuBar: true,
        });
        const url = new URL('https://search.bilibili.com/all');
        url.searchParams.append('keyword', message);
        try {
            const prom = win.loadURL(url.href);
            const closedHandler = () => resolve(false);
            win.on('closed', closedHandler);
            win.webContents.setWindowOpenHandler(details => {
                const run = async (video, isBV = false) => {
                    const w = new BrowserWindow({
                        width: 640,
                        height: 480,
                        autoHideMenuBar: true,
                        webPreferences: {
                            preload: path.join(__dirname, 'addVideo.preload.js')
                        },
                        titleBarStyle: 'hidden',
                        titleBarOverlay: true,
                    });
                    await w.loadFile('addVideo.html');
                    w.on('closed', () => resolve(false));

                    w.webContents.send('videoinfo', { video, isBV });
                    win.removeListener('closed', closedHandler);
                    win.destroy();
                };
                const url = new URL(details.url)
                const sp_bvid = url.searchParams.get('bvid');
                const sp_aid = url.searchParams.get('aid');
                if (sp_bvid) { run(sp_bvid, true); return ({ action: 'deny' }); }
                if (sp_aid) { run(sp_aid); return ({ action: 'deny' }); }
                const url_array = url.pathname.split('/').filter(el => !!el);
                for (let i = 0, l = url_array.length; i < l; ++i) {
                    if (url_array[i] === 'video' && i + 1 < l) { run(url_array[i + 1], /^BV/i.test(url_array[i + 1])); return ({ action: 'deny' }); }
                    if (url_array[i].startsWith('BV')) { run(url_array[i], true); return ({ action: 'deny' }); }
                }
                win.webContents.executeJavaScript(`(function(param){
                    let el = document.createElement('dialog')
                    el.style.all = 'revert'
                    document.body.append(el)
                    el.innerHTML = '<div style="font-size:x-large;margin-bottom:1em">无法打开链接</div>'
                    let el2 = document.createElement('pre')
                    el2.innerText = param
                    el.append(el2)
                    el.showModal()
                    setTimeout(()=>{el.close();el.remove()},1000)
                }(atob("${btoa(url.href)}")))`);
                return ({ action: 'deny' });
            });
            await prom;
        } catch (error) {
            resolve(String(error))
        }
    }),
    'addVideoFromApp'(ev, { data, cid, title } = {}) {
        // console.log(data, cid, title);
        queueMicrotask(async () => {
            const fname = "USER-HISTORY_" + await getsid() + "_.csv";
            // console.log(fname);
            try {
                await fs.promises.access(fname, fs.constants.F_OK);
            } catch {
                await fs.promises.writeFile(fname, Buffer.from(await(new Blob(['\uFEFF'/*BOM*/, '"时间","视频","数据",CID\r\n']).arrayBuffer())));
            }
            await fs.promises.appendFile(fname, `"${new Date().toLocaleString()}","${title}","${JSON.stringify(data)}","${cid}"\r\n`);
        });
        entryWindow.webContents.send('addVideo', data, cid, title);
    },
    'entryvideocontextmenu'(ev, {
        videoTitle,
        videoId,
        countFront,
        canInsertQueue,
    } = {}) { return new Promise(resolve => {
        const m = Menu.buildFromTemplate([
            {
                label: videoTitle,
                enabled: false,
            },
            {
                label: videoId,
                enabled: false,
            },
            {
                label: `还有 ${countFront} 个视频排队`,
                enabled: false,
            },
            {
                type: 'separator'
            },
            {
                label: '移除',
                click() {
                    resolve('remove')
                },
            },
        ]);
        m.popup({ window: BrowserWindow.fromWebContents(ev.sender) });
    }) },

};

nativeTheme.themeSource = 'light';



app.whenReady().then(() => {

    for (const i in ipcHandlers)
        ipcMain.handle(i, ipcHandlers[i]);



    createEntryWindow();
    

});




// quitting the app when no windows are open on non-macOS platforms
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})




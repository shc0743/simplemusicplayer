const { contextBridge, ipcRenderer } = require('electron')



contextBridge.exposeInMainWorld('videoinfo', {
    listen(cb) {
        ipcRenderer.on('videoinfo', cb);
    },
    sendResult(result) {
        ipcRenderer.send('add-video-by-info', result)
    },
})

contextBridge.exposeInMainWorld('addVideo2', {
    f: function (data, cid, title) {
        console.log('addVideo2 --');
        return ipcRenderer.invoke('addVideoFromApp', { data, cid, title });
    }
})

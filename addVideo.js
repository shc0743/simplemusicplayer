
videoinfo.listen(function (ev, data) {
    console.log(data);
    content.innerHTML = '正在解析视频 ' + data.video;
    parse_bilibili(data.video, data.isBV).then(videos => {
        title.innerText = videos.title;
        content.innerHTML = '';
        const res = videos;
        for (const i of res) {
            const el = document.createElement('div');
            el.className = 'res-list-item';
            const el1 = document.createElement('div');
            el1.className = 'res-list-content-container';
            el.append(el1);

            const elTitle = document.createElement('div');
            elTitle.className = 'res-list-content is-title';
            elTitle.innerText = elTitle.title = i.title || 'untitled';
            el1.append(elTitle);
            const elBtn = document.createElement('button');

            const elCustomInfo = document.createElement('div');
            elCustomInfo.className = 'res-list-content is-info';
            elCustomInfo.innerText = elCustomInfo.title = i.customInfo || '';
            el1.append(elCustomInfo);

            const elUrl = document.createElement('div');
            elUrl.className = 'res-list-content is-url';
            elUrl.innerText = elUrl.title = i.url;
            // el1.append(elUrl);

            elBtn.className = 'download-button el-button el-button--primary el-button--small is-plain';
            elBtn.innerHTML = '打开';
            elBtn._url = i.url;
            elBtn._title = i.title + (i.filename_suffix || '');
            el.append(elBtn);

            elBtn.onclick = () => {
                addVideo(data, i.cid, i.title); (close)();
            }

            if (res.length === 1) {
                setTimeout(() => {
                    elBtn.onclick();
                });
            }

            content.append(el);

        }
    }).catch((error) => {
        content.innerHTML = '视频解析异常！';
        content.append(error);
    });
});
close_app.onclick = () => close();
ok.onclick = () => videoinfo.sendResult(true);
window.addEventListener('keydown', ({ key }) => {
    if (key === 'Escape') close();
});


async function parse_bilibili(aid, isBVID = false) {
    if (/^av[0-9]*$/i.test(aid)) aid = aid.substring(2);
    const view = await (await fetch('https://api.bilibili.com/x/web-interface/view?' + (isBVID ? 'bvid=' : 'aid=') + aid, { credentials: 'include', mode: 'cors' })).json();
    if (!view.data) return [];
    const result = [];
    const title = view.data.title, uploader = view.data.owner.name;
    const hasOnly1Page = (view.data.pages.length < 2);
    for (const i of view.data.pages) {
        const title2 = hasOnly1Page ? title : `${i.page}P. ${i.part} - ${title}`;
        const url = new URL('ext://downloader/bilivideo');
        url.searchParams.set('bvid', view.data.bvid);
        url.searchParams.set('cid', i.cid);
        url.searchParams.set('name', title2);

        result.push({
            type: 'video',
            filename_suffix: '.mp4',
            url: url.href, title: title2,
            customInfo: `UP主: ${uploader}${'' && '\nav号: av${view.data.aid}\nBV号: ${view.data.bvid}'}\ncid: ${i.cid}\n时长: ${i.duration}秒\n分P标题: ${i.part}`,
            cid: i.cid,
        });
    }
    result.title = title;
    return result;
}



function addVideo(data, cid, title) {
    console.log('addVideo --');
    return addVideo2.f(data, cid, title)
}




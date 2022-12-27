'use strict';

const { S3 } = require('aws-sdk');
const path = require('path');
const _pick = require('lodash.pick');
const { readFile } = require('fs/promises');
const { CronJob: cron } = require('cron');


const internals = {
    s3: new S3({ apiVersion: '2006-03-01', region: 'us-west-2' }),
    Bucket: 'artifact.x-aws.twohandsgames.com',
    awsS3Url: 'https://s3.us-west-2.amazonaws.com',
    list: new Map(),
    meta: new Map()
};

async function runCommand(cmd, params) {

    return new Promise((resolve, reject) => {

        params = Object.assign({ Bucket: internals.Bucket }, params);
        internals.s3[cmd](params, (err, result) => {

            if (err) {
                reject(err);
                return;
            }

            resolve(result);
        })
    });
}

function toSize(bytes) {

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

async function listObjects() {

    let keys = [];
    let next = null;
    do {

        const res = await runCommand('listObjectsV2', { ContinuationToken: next });
        keys = keys.concat(res.Contents.filter(r => r.Size > 0 && r.StorageClass === 'STANDARD' && r.Key.indexOf('Info.plist') === -1));
        next = res.IsTruncated ? res.NextContinuationToken : null;

    } while(next);

    keys.sort((l, r) => { return l.LastModified - r.LastModified });

    return keys;
}

async function refresh(list) {

    const champsApksList = [];
    const golfApksList = [];
    const archiveApksList = [];

    internals.list = new Map(Array.from(list, (r) => { return [ r.Key, r ]}));

    for (const [k, r] of internals.list) {
        let meta = internals.meta.get(r.Key);
        if (!meta) {
            const { Metadata } = await runCommand('headObject', { Key: r.Key });
            if (!Metadata.project) {
                continue;
            }

            if (!Metadata.androidstore && Metadata.platform !== 'iOS') {
                Metadata.androidstore = 'PlayStore';
            }

            meta = Metadata;
            internals.meta.set(r.Key, meta);
        }

        const type = r.Key.split('/');
        const info = _pick(Object.assign(r, meta), [
            'project', 'platform', 'buildnumber', 'server', 'servicearea',
            'androidstore', 'name', 'version', 'LastModified', 'Size', 'StorageClass'
        ]);

        info.link = `${internals.awsS3Url}/${internals.Bucket}/${r.Key}`;
        info.name = path.basename(r.Key);
        info.ext = path.extname(info.name);
        info.store = meta.androidstore ?? 'Apple';
        info.size = toSize(info.Size);

        if (info.platform === 'iOS' && info.ext === '.ipa') {
            info.link = `itms-services://?action=download-manifest&url=${internals.awsS3Url}/${internals.Bucket}/paks`;
            if (info.project === 'Golf') {
                info.link += `/${info.project.toLowerCase()}/${info.server}/ios/Info.plist`;
            }
            else {
                if (info.project === 'Champs_Org') {
                    info.link += `/champs/${info.server}/ios/Info.plist`;
                }
                else {
                    info.link += `/${info.project.toLowerCase()}/${info.server}/ios/${info.servicearea}-Info.plist`;
                }
            }
        }

        if (type[0]) {
            if (type[0] === 'archives') {
                archiveApksList.push(info);
            }
            else if (type[0] === 'paks') {
                if (type[1] === 'champs') {
                    champsApksList.push(info);
                }
                else if (type[1] === 'golf') {
                    golfApksList.push(info);
                }
            }
        }
    };

    return { champsApksList, golfApksList, archiveApksList };
}

async function main() {

    new cron('*/10 * * * * *', async () => {

        const list = await listObjects();
        if (list.length === internals.list.size) {
            return;
        }

        console.log(`refresh start - ${list.length - internals.list.size}`);

        const bookmark = require('./template/bookmark');
        const res = await refresh(list);

        let contents = await readFile('./template/index.html', { encoding: 'utf-8' });
        contents = contents.replace('{{bookmark}}', `const bookmark = ${JSON.stringify(bookmark)};`);
        contents = contents.replace('{{champsApksList}}', `const champsApksList = ${JSON.stringify(res.champsApksList)};`);
        contents = contents.replace('{{golfApksList}}', `const golfApksList = ${JSON.stringify(res.golfApksList)};`);
        contents = contents.replace('{{archiveApksList}}', `const archiveApksList = ${JSON.stringify(res.archiveApksList)};`);

        await runCommand('putObject', { Body: contents, Key: 'index.html', ContentType: 'text/html', CacheControl: 'no-cache,no-store' });
        console.log('refresh completed');

    }, null, true, 'Asia/Seoul');
}

main();

// cSpell: ignore buildnumber servicearea androidstore
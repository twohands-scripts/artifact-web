'use strict';

const { S3 } = require('aws-sdk');
const path = require('path');
const _pick = require('lodash.pick');


const internals = {
    s3: new S3({ apiVersion: '2006-03-01', region: 'us-west-2' }),
    Bucket: 'artifact.x-aws.twohandsgames.com',
    awsS3Url: 'https://s3.us-west-2.amazonaws.com',
    list: new Map()
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

async function listObjects() {

    let keys = [];
    let next = null;
    do {

        const res = await runCommand('listObjectsV2', { ContinuationToken: next });
        keys = keys.concat(res.Contents.filter(r => r.Size > 0 && r.StorageClass === 'STANDARD'));
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
    internals.list.forEach(async (r) => {

        if (!r.meta) {
            r.meta = await runCommand('headObject', { Key: r.Key });
        }

        const info = _pick(Object.assign(r, r.meta), ['project', 'platform', 'buildnumber', 'servicearea', 'androidstore', 'name', 'version', 'LastModified', 'Size', 'StorageClass']);
        const type = r.Key.split('/');

        info.Link = `${awsS3Url}/${Bucket}/${Key}`;
        info.name = path.basename(r.Key);
        info.ext = path.extname(info.name);

        if (type[0]) {
            if (type[0] === 'archive') {
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
    });

    return { champsApksList, golfApksList, archiveApksList };
}

async function main() {

    const list = await listObjects();

    if (list.length !== internals.list.size) {
        refresh(list);
    }
}

main();
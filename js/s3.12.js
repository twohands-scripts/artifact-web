'use strict';

AWS.config.region = 'us-west-2';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-west-2:e59a4776-4a4c-4027-9e16-ccf40a2ffada',
});

const awsS3Url = 'https://s3.us-west-2.amazonaws.com';
const Bucket = 'artifact.x-aws.twohandsgames.com';
const S3 = new AWS.S3({ apiVersion: '2006-03-01' });

function runCommand(cmd, params) {

    params = Object.assign({ Bucket }, params);
    return new Promise((resolve, reject) => {

        S3[cmd](params, (err, data) => {

            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        })
    });
};

function toSize(bytes) {

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

async function loadEach(Prefix, cb) {

    let params = Prefix ? { Prefix } : {};
    let isTruncated = false;

    do {

        const result = await runCommand('listObjectsV2', params);
        isTruncated = result.IsTruncated;
        params = Object.assign(params, { ContinuationToken: result.NextContinuationToken });
        
        for (const file of result.Contents) {
            const { Key, LastModified, Size, StorageClass } = file;
            if (Size === 0) {
                continue;
            }

            if (Key.indexOf('Info.plist') != -1) {
                continue;
            }

            const name = file.Key.slice(file.Key.lastIndexOf('/') + 1).trim();
            const ext = (name.match(/^.*\.(\w+)$/))[1] || '';
            const Link = `${awsS3Url}/${Bucket}/${Key}`;
            const { Metadata } = await runCommand('headObject', { Key: file.Key });

            if (!Metadata.androidstore && Metadata.platform !== 'iOS') {
                Metadata.androidstore = 'PlayStore';
            }

            cb({ 
                Project: Metadata.project ?? '', 
                Platform: Metadata.platform ?? '', 
                Server: Metadata.server ?? '', 
                BuildNumber: Metadata.buildnumber ?? 0, 
                ServiceArea: Metadata.servicearea ?? 'Global',
                Store: Metadata.androidstore ?? 'Apple',
                Name: name, 
                Ext: ext.toUpperCase(),
                Version: Metadata.version ?? '', 
                LastModified, 
                Size: toSize(Size), 
                StorageClass,
                Link
            });
        }

    } while(isTruncated);
}

async function loadPaks(tbl, project) {

    tbl.clear();

    loadEach('paks', (file) => {

        if (file.Project.indexOf(project) < 0) {
            return;
        }

        if (file.Platform === 'iOS') {
            file.Link = `itms-services://?action=download-manifest&url=`;
            file.Link += `${awsS3Url}/${Bucket}/paks`;

            if (file.Project === 'Golf') {
                file.Link += `/${file.Project.toLowerCase()}/${file.Server}/ios/Info.plist`;
            }
            else {
                if (file.Project === 'Champs_Org') {
                    file.Link += `/champs/${file.Server}/ios/Info.plist`;
                }
                else {
                    file.Link += `/${file.Project.toLowerCase()}/${file.Server}/ios/${file.ServiceArea}-Info.plist`;
                }
            }
        }

        const btnTxt = 'Download';
        tbl.row.add([
            moment(file.LastModified).format('YYYY-MM-DD HH:mm:ss'),
            file.Project,
            file.ServiceArea,
            file.Store,
            file.Server,
            file.Version,
            file.BuildNumber,
            `<a href="${file.Link}" class="btn btn-primary btn-sm" role="button" target="_blank">${btnTxt}</a>`,
            file.Size
        ]);

        tbl.draw();
    });
}

async function loadArchive(tbl) {

    tbl.clear();

    loadEach('archives', (file) => {

        tblArchive.row.add([
            moment(file.LastModified).format('YYYY-MM-DD HH:mm:ss'),
            file.Project,
            file.ServiceArea,
            file.Store,
            file.Server,
            file.Version,
            file.BuildNumber,
            `<a href="${file.Link}" class="btn btn-primary btn-sm" role="button" target="_blank">${file.Ext} Download</a>`,
            file.Size,
        ]);

        tbl.draw();
    });
}

// cSpell: ignore androidstore servicearea twohandsgames
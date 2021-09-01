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
            const Link = `${awsS3Url}/${Bucket}/${Key}`;
            const { Metadata } = await runCommand('headObject', { Key: file.Key });

            cb({ 
                Project: Metadata.project ?? '', 
                Platform: Metadata.platform ?? '', 
                Server: Metadata.server ?? '', 
                Name: name, 
                Version: Metadata.version ?? '', 
                LastModified, 
                Size, 
                StorageClass,
                Link
            });
        }

    } while(isTruncated);
}

async function loadPaks(tbl) {

    tbl.clear();

    loadEach('paks', (file) => {

        if (file.Platform === 'iOS') {
            file.Link = `itms-services://?action=download-manifest&url=`;
            file.Link += `${awsS3Url}/${Bucket}/paks/${file.Project.toLowerCase()}`;
            file.Link += `/${file.Server}/ios/Info.plist`;
        }

        tbl.row.add([
            moment(file.LastModified).format('YYYY-MM-DD hh:mm:ss A'),
            file.Project,
            file.Server,
            file.Platform,
            file.Version,
            Math.round(file.Size / Math.pow(1024, 2), 2) + ' MB',
            `<a href="${file.Link}" class="btn btn-primary btn-sm" role="button" target="_blank">Install</a>`
        ]);

        tbl.draw();
    });
}

async function loadArchive(tbl) {

    tbl.clear();

    loadEach('archives', (file) => {

        tblArchive.row.add([
            moment(file.LastModified).format('YYYY-MM-DD hh:mm:ss A'),
            file.Project,
            file.Server,
            file.Version,
            file.Name,
            Math.round(file.Size / Math.pow(1024, 2), 2) + ' MB',
            `<a href="${file.Link}" class="btn btn-primary btn-sm" role="button" target="_blank">Install</a>`
        ]);

        tbl.draw();
    });
}

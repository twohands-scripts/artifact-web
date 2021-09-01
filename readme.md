# S3 Browser
- S3 Bucket에 Apk와 심볼들을 사내에서 편하게 다운로드 할 수 있는 도구가 필요했다.

## S3 설정
1. 버킷 생성
1. s3browser upload
1. 버킷 > 속성 > 정적 웹 사이트 호스팅 설정

## IAM Role 생성 및 설정
1. ArtifactWebAuthCognitoRole - Cognito의 인증된 권한 설정
1. ArtifactWebAuthCognitoRole - Cognito의 인증되지 않은 권한 설정
1. 인증 처리를 하지 않았기 때문에 결국 ACL로 관리
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "mobileanalytics:PutEvents",
                "cognito-sync:*"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::artifact.x-aws.twohandsgames.com",
                "arn:aws:s3:::artifact.x-aws.twohandsgames.com/*"
            ],
            "Condition": {
                "IpAddress": {
                    "aws:SourceIp": [ ACL ]
                }
            }
        }
    ]
}
```

## Bucket / 권한 / 버킷 정책
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::819661239830:root"
            },
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::artifact.x-aws.twohandsgames.com",
                "arn:aws:s3:::artifact.x-aws.twohandsgames.com/*"
            ]
        },
        {
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::118174476859:root"
            },
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::artifact.x-aws.twohandsgames.com",
                "arn:aws:s3:::artifact.x-aws.twohandsgames.com/*"
            ]
        },
        {
            "Sid": "",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": "arn:aws:s3:::artifact.x-aws.twohandsgames.com/*",
            "Condition": {
                "IpAddress": {
                    "aws:SourceIp": [ ACL ]
                }
            }
        }
    ]
}
```

## Bucket / 권한 / CORS
1. 사용자 정의의 Metadata를 추가할 경우 ExposeHeaders에 정의해야 정보를 불러 올 수 있음.
```
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "HEAD",
            "GET"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "x-amz-meta-project",
            "x-amz-meta-version",
            "x-amz-meta-server",
            "x-amz-meta-platform"
        ]
    }
]
```
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UiStack } from '../../ui/infrastructure/ui-stack';

describe('UiStack', () => {
  let app: cdk.App;
  let stack: UiStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new UiStack(app, 'TestUiStack', {
      env: { account: '123456789012', region: 'eu-central-1' }
    });
    template = Template.fromStack(stack);
  });

  describe('S3 Bucket', () => {
    test('creates S3 bucket with correct properties', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: Match.absent(),
        VersioningConfiguration: Match.absent()
      });
  
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    test('has auto delete objects enabled', () => {
      template.hasResource('Custom::S3AutoDeleteObjects', {
        Properties: Match.objectLike({
          ServiceToken: Match.anyValue(),
        })
      });
    });
  });

  describe('CloudFront Distribution', () => {
    test('creates CloudFront distribution with correct configuration', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          DefaultRootObject: 'index.html',
          Enabled: true,
          DefaultCacheBehavior: {
            ViewerProtocolPolicy: 'redirect-to-https',
            TargetOriginId: Match.anyValue(),
            CachePolicyId: Match.anyValue(),
          },
          CustomErrorResponses: [
            {
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: '/index.html'
            },
            {
              ErrorCode: 403,
              ResponseCode: 200,
              ResponsePagePath: '/index.html'
            }
          ]
        }
      });
    });

    test('has Origin Access Control', () => {
      template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
        OriginAccessControlConfig: {
          Name: Match.stringLikeRegexp('.*'),
          OriginAccessControlOriginType: 's3',
          SigningBehavior: 'always',
          SigningProtocol: 'sigv4'
        }
      });
    });
  });

  describe('S3 Bucket Deployment', () => {
    test('creates S3 deployment with correct configuration', () => {
      template.hasResourceProperties('Custom::CDKBucketDeployment', {
        DestinationBucketName: Match.anyValue(),
        DistributionId: Match.anyValue(),
        ServiceToken: Match.anyValue(),
        SourceBucketNames: Match.arrayEquals([Match.stringLikeRegexp('.*')]),
        SourceObjectKeys: Match.arrayEquals([Match.stringLikeRegexp('.*')]),
        Prune: true
      });
    });

    test('has correct bucket policy for CloudFront access', () => {
      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 's3:GetObject',
              Effect: 'Allow',
              Principal: { Service: 'cloudfront.amazonaws.com' },
              Resource: Match.anyValue()
            })
          ])
        }
      });
    });
  });

  describe('Environment Configuration', () => {
    test('creates CloudFront URL output', () => {
      const cfnOutputs = template.findOutputs('URL');
      expect(cfnOutputs.URL.Value).toEqual({
        'Fn::Join': [
          '',
          expect.arrayContaining([
            'https://',
            expect.objectContaining({
              'Fn::GetAtt': expect.arrayContaining([
                expect.any(String),
                'DomainName'
              ])
            })
          ])
        ]
      });
    });
  });

  test('has required resource count', () => {
    const s3Buckets = template.findResources('AWS::S3::Bucket');
    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const originAccessControls = template.findResources('AWS::CloudFront::OriginAccessControl');
    const bucketPolicies = template.findResources('AWS::S3::BucketPolicy');
    const deployments = template.findResources('Custom::CDKBucketDeployment');

    expect(Object.keys(s3Buckets)).toHaveLength(1);
    expect(Object.keys(distributions)).toHaveLength(1);
    expect(Object.keys(originAccessControls)).toHaveLength(1);
    expect(Object.keys(bucketPolicies)).toHaveLength(1);
    expect(Object.keys(deployments)).toHaveLength(1);
  });
});

// Workaround: since python deopendencies are build directly while lambda layer creation, we need to mock the lambda layer
jest.mock('aws-cdk-lib/aws-lambda', () => {
  const actual = jest.requireActual('aws-cdk-lib/aws-lambda');
  const { Resource } = require('aws-cdk-lib');

  const dummyLayerCode = {
    bind: () => ({
      s3Location: {
        bucketName: 'dummy-bucket',
        objectKey: 'dummy-key',
        version: 'dummy-version'
      }
    })
  };

  return {
    ...actual,
    Code: {
      ...actual.Code,
      fromAsset: jest.fn((assetPath: string, options?: any) =>
        options?.bundling ? dummyLayerCode : actual.Code.fromInline('dummy code')
      ),
    },
    LayerVersion: class extends Resource {
      constructor(scope: any, id: string, props: any) {
        super(scope, id);
        this.props = props;
      }
      _toCloudFormation() {
        return {
          Type: 'AWS::Lambda::LayerVersion',
          Properties: {
            CompatibleRuntimes: this.props.compatibleRuntimes,
            Description: this.props.description,
            Content: { S3Bucket: 'dummy-bucket', S3Key: 'dummy-key' }
          }
        };
      }
    }
  };
});

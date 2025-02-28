// Workaround: since python deopendencies are build directly while lambda layer creation, we need to mock the lambda layer
jest.mock('aws-cdk-lib/aws-lambda', () => {
  const actual = jest.requireActual('aws-cdk-lib/aws-lambda');
  
  return {
    ...actual,
    LayerVersion: jest.fn().mockImplementation((scope, id, props) => {
      console.log(`Mocking Lambda Layer: ${id}`);

      return {
        layerVersionArn: `arn:aws:lambda:us-east-1:123456789012:layer/${id}:1`,
        addPermission: jest.fn(),
        applyRemovalPolicy: jest.fn(),
      };
    }),
    Code: {
      ...actual.Code,
      fromAsset: jest.fn().mockImplementation((assetPath, options) => {
        console.log(`Mocking Code.fromAsset for path: ${assetPath}`);
        return {
          bind: jest.fn(() => ({
            s3Location: {
              bucketName: 'mock-bucket',
              objectKey: 'mock-key',
            },
          })),
          bindToResource: jest.fn(),
        };
      }),
    },
  };
});

jest.mock('child_process', () => {
  const originalExecSync = jest.requireActual('child_process').execSync;

  return {
    execSync: jest.fn((command) => {
      if (command.includes('pip install')) {
        console.log('Mocking pip install: Skipping actual installation.');
        return ''; // Simulates a successful installation
      }
      return originalExecSync(command);
    }),
  };
});

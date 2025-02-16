import { Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DomainPattern } from '../../lib/constructs/domain-construct/domain-pattern';
import { DomainStackProps, LambdaLayerConfig } from '../../lib/constructs/types';

// Mock both Lambda function and layer asset creation
jest.mock('aws-cdk-lib/aws-lambda', () => {
  const actual = jest.requireActual('aws-cdk-lib/aws-lambda');
  return {
    ...actual,
    Code: {
      ...actual.Code,
      fromAsset: jest.fn().mockImplementation((path) => {
        return actual.Code.fromInline('exports.handler = async () => { return { statusCode: 200 }; }');
      })
    },
    LayerVersion: jest.fn().mockImplementation((scope: any, id: string, props: any) => {
      return {
        layerVersionArn: 'arn:aws:lambda:region:account:layer:name:version',
        addPermission: jest.fn(),
        node: {
          addDependency: jest.fn()
        }
      };
    })
  };
});

describe('DomainPattern', () => {
  let stack: Stack;
  let vpc: ec2.IVpc;

  beforeEach(() => {
    stack = new Stack();
    vpc = new ec2.Vpc(stack, 'TestVPC');
    jest.clearAllMocks();
  });

  test('creates all required resources', () => {
    // Arrange
    const props: DomainStackProps = {
      domainName: 'test-domain',
      vpc,
      apiConfig: {
        name: 'test-api',
        description: 'Test API'
      },
      lambdaConfigs: [{
        name: 'TestFunction',
        handler: 'index.handler',
        handlerPath: 'dummy-path',
        environment: {}
      }],
      lambdaLayers: [],
      apiRoutes: [{
        path: '/test',
        method: 'GET',
        target: 'TestFunction',
        type: 'lambda'
      }]
    };

    // Act
    new DomainPattern(stack, 'TestDomain', props);

    // Assert
    const template = Template.fromStack(stack);
    
    // Verify Lambda function
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: lambda.Runtime.PYTHON_3_9.toString()
    });

    // Verify API Gateway
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'test-api'
    });

    // Verify API Methods - now using hasResourceProperties instead of count
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      AuthorizationType: 'NONE',
      Integration: {
        Type: 'AWS_PROXY',
        IntegrationHttpMethod: 'POST'
      }
    });
  });

  test('configures lambda layers correctly', () => {
    // Arrange
    const lambdaLayers: LambdaLayerConfig[] = [{
      layerPath: 'dummy-layer-path',
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Test Layer'
    }];

    const props: DomainStackProps = {
      domainName: 'test-domain',
      vpc,
      apiConfig: { name: 'test-api' },
      lambdaConfigs: [{
        name: 'TestFunction',
        handler: 'index.handler',
        handlerPath: 'dummy-path',
        environment: {}
      }],
      lambdaLayers,
      apiRoutes: [{
        path: '/test',
        method: 'GET',
        target: 'TestFunction',
        type: 'lambda'
      }]
    };

    // Act
    new DomainPattern(stack, 'TestDomain', props);

    // Assert
    // Verify that LayerVersion was called with correct parameters
    expect(lambda.LayerVersion).toHaveBeenCalledWith(
      expect.anything(),
      'Layer0',
      expect.objectContaining({
        description: 'Test Layer',
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_9]
      })
    );
  });

  // Additional test for DocumentDB configuration
  test('configures DocumentDB access correctly', () => {
    // Arrange
    const props: DomainStackProps = {
      domainName: 'test-domain',
      vpc,
      apiConfig: { name: 'test-api' },
      dbConfig: {
        clusterEndpoint: 'test-cluster.endpoint'
      },
      lambdaConfigs: [{
        name: 'TestFunction',
        handler: 'index.handler',
        handlerPath: 'dummy-path',
        environment: {}
      }],
      lambdaLayers: [],
      apiRoutes: [{
        path: '/test',
        method: 'GET',
        target: 'TestFunction',
        type: 'lambda'
      }]
    };

    // Act
    new DomainPattern(stack, 'TestDomain', props);

    // Assert
    const template = Template.fromStack(stack);

    // Verify environment variables
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          DB_URL: 'test-cluster.endpoint'
        })
      }
    });
  });
});
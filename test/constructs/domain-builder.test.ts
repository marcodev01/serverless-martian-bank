import { Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DomainBuilder } from '../../lib/constructs/domain-construct/domain-builder';

// Mock the Lambda asset creation
jest.mock('aws-cdk-lib/aws-lambda', () => {
  const actual = jest.requireActual('aws-cdk-lib/aws-lambda');
  return {
    ...actual,
    Code: {
      ...actual.Code,
      fromAsset: jest.fn().mockImplementation((path) => {
        return actual.Code.fromInline('exports.handler = async () => { return { statusCode: 200 }; }');
      })
    }
  };
});

describe('DomainBuilder', () => {
  let stack: Stack;
  let vpc: ec2.IVpc;
  
  beforeEach(() => {
    stack = new Stack();
    vpc = new ec2.Vpc(stack, 'TestVPC', {
      maxAzs: 2
    });
  });

  test('builds domain with minimum required configuration', () => {
    // Arrange
    const builder = new DomainBuilder({ domainName: 'test-domain' })
      .withVpc(vpc)
      .withApi({ name: 'test-api' });

    builder.addLambda('TestFunction', {
      handler: 'index.handler',
      handlerPath: 'dummy-path' // This path will be mocked
    }).exposedVia('/test', 'GET');

    // Act
    const domain = builder.build(stack, 'TestDomain');

    // Assert
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: lambda.Runtime.PYTHON_3_9.toString(),
      VpcConfig: {
        SecurityGroupIds: Match.anyValue(),
        SubnetIds: Match.anyValue()
      }
    });

    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'test-api'
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: Match.anyValue(),
      RestApiId: Match.anyValue(),
      AuthorizationType: 'NONE',
      Integration: {
        Type: 'AWS_PROXY',
        IntegrationHttpMethod: 'POST'
      }
    });
  });

  test('throws error when required components are missing', () => {
    // Arrange
    const builder = new DomainBuilder({ domainName: 'test-domain' });

    // Act & Assert
    expect(() => builder.build(stack, 'TestDomain'))
      .toThrow('VPC must be specified using withVpc()');
  });

  test('configures event bus integration correctly', () => {
    // Arrange
    const eventBus = new events.EventBus(stack, 'TestEventBus');
    const builder = new DomainBuilder({ domainName: 'test-domain' })
      .withVpc(vpc)
      .withApi({ name: 'test-api' })
      .withEventBus(eventBus);

    builder.addLambda('TestProducer', {
      handler: 'index.handler',
      handlerPath: 'dummy-path' // This path will be mocked
    })
    .producesEvents()
    .exposedVia('/test', 'POST');

    // Act
    const domain = builder.build(stack, 'TestDomain');

    // Assert
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'events:PutEvents',
            Effect: 'Allow',
            Resource: Match.anyValue()
          })
        ])
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
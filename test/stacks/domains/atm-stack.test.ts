import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { AtmStack } from '../../../domains/atm/infrastructure/atm-stack';
import { NetworkStack } from '../../../lib/stacks/network-stack';

describe('AtmStack', () => {
  let app: cdk.App;
  let networkStack: NetworkStack;
  let stack: AtmStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    
    const env = { 
      account: '123456789012', 
      region: 'us-east-1' 
    };

    networkStack = new NetworkStack(app, 'TestNetworkStack', { env });
    
    stack = new AtmStack(app, 'TestAtmStack', {
      vpc: networkStack.vpc,
      env
    });

    stack.addDependency(networkStack);
    template = Template.fromStack(stack);
  });

  describe('VPC Configuration', () => {
    test('function is configured with VPC', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        VpcConfig: Match.objectLike({
          SecurityGroupIds: Match.anyValue(),
          SubnetIds: Match.anyValue()
        })
      });
    });

    test('has correct VPC permissions', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: [
            Match.objectLike({
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com"
              }
            })
          ]
        }),
        ManagedPolicyArns: Match.arrayWith([
          Match.objectLike({
            'Fn::Join': Match.arrayWith([
              '',
              Match.arrayWith([
                Match.stringLikeRegexp('AWSLambdaVPCAccessExecutionRole')
              ])
            ])
          })
        ])
      });
    });
  });

  describe('API Configuration', () => {
    test('creates API Gateway with correct configuration', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'ATM Locator Service',
        Description: 'API for ATM location services'
      });
    });

    test('configures CORS correctly', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
        AuthorizationType: 'NONE',
        Integration: {
          Type: 'MOCK',
          IntegrationResponses: Match.arrayWith([
            Match.objectLike({
              ResponseParameters: {
                'method.response.header.Access-Control-Allow-Headers': Match.anyValue(),
                'method.response.header.Access-Control-Allow-Methods': Match.anyValue(),
                'method.response.header.Access-Control-Allow-Origin': Match.anyValue()
              }
            })
          ])
        }
      });
    });

    test('creates correct API routes with proper integrations', () => {
      // Test POST /atm route
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'atm'
      });

      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        ResourceId: Match.anyValue(),
        RestApiId: Match.anyValue(),
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST'
        }
      });

      // Test GET /atm/{id} route
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: '{id}'
      });

      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        ResourceId: Match.anyValue(),
        RestApiId: Match.anyValue(),
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST'
        }
      });
    });
  });

  describe('Lambda Function', () => {
    test('creates ATM Locator function with correct configuration', () => {
      template.resourceCountIs('AWS::Lambda::Function', 1);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'atm_locator.handler',
        Runtime: lambda.Runtime.NODEJS_22_X.name,
        MemorySize: 128,
        VpcConfig: Match.objectLike({
          SecurityGroupIds: Match.anyValue(),
          SubnetIds: Match.anyValue()
        })
      });
    });

    test('has basic execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: [
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com'
              }
            })
          ]
        })
      });
    });
  });

  describe('Event Integration', () => {
    test('has no event bus integration', () => {
      // Verify no EventBridge rules exist
      const rules = template.findResources('AWS::Events::Rule', {});
      expect(Object.keys(rules).length).toBe(0);

      // Verify Lambda function has no event-related environment variables
      const functions = template.findResources('AWS::Lambda::Function');
      Object.values(functions).forEach(func => {
        const env = func.Properties.Environment?.Variables || {};
        expect(env.EVENT_BUS_NAME).toBeUndefined();
        expect(env.EVENT_SOURCE).toBeUndefined();
      });
    });
  });

  test('does not create Lambda layer', () => {
    const layers = template.findResources('AWS::Lambda::LayerVersion', {});
    expect(Object.keys(layers).length).toBe(0);
  });
});
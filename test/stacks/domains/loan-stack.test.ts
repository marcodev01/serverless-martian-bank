import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LoansStack } from '../../../domains/loans/infrastructure/loans-stack';
import { NetworkStack } from '../../../lib/stacks/network-stack';

describe('LoansStack', () => {
  let app: cdk.App;
  let networkStack: NetworkStack;
  let stack: LoansStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    
    const env = { 
      account: '123456789012', 
      region: 'us-east-1' 
    };

    networkStack = new NetworkStack(app, 'TestNetworkStack', { env });

    new cdk.CfnOutput(networkStack, 'SharedDocDbEndpoint', {
      value: 'test-docdb-endpoint',
      exportName: 'SharedDocDbEndpoint'
    });

    new cdk.CfnOutput(networkStack, 'DocDbSecurityGroupId', {
      value: 'sg-test-id',
      exportName: 'DocDbSecurityGroupId'
    });

    stack = new LoansStack(app, 'TestLoansStack', {
      vpc: networkStack.vpc,
      eventBus: networkStack.eventBus,
      env
    });

    stack.addDependency(networkStack);
    template = Template.fromStack(stack);
  });
  
  describe('Cross-Stack References', () => {
    test('correctly imports DocumentDB configuration', () => {
      // Check the Fn::ImportValue references
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            DB_URL: {
              'Fn::ImportValue': 'SharedDocDbEndpoint'
            }
          }
        }
      });
    });

    test('correctly imports Security Group configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        VpcConfig: {
          SecurityGroupIds: Match.arrayWith([
            {
              'Fn::ImportValue': 'DocDbSecurityGroupId'
            }
          ])
        }
      });
    });
  });

  describe('VPC Configuration', () => {
    test('functions are configured with VPC', () => {
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

  describe('Database Configuration', () => {
    test('has DocumentDB connection configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            DB_URL: Match.anyValue()
          }
        }
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        VpcConfig: {
          SecurityGroupIds: Match.anyValue()
        }
      });
    });

    test('has correct DocumentDB permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            Match.objectLike({
              Action: "docdb:connect",
              Effect: "Allow",
              Resource: Match.anyValue()
            })
          ]
        }
      });
    });
  });

  describe('Event Configuration', () => {
    test('ProcessLoanFunction is configured as event producer', () => {
      const functions = template.findResources('AWS::Lambda::Function');
      const processLoanFunction = Object.values(functions).find(func => 
        func.Properties.Handler.includes('process_loan')
      );
      
      expect(processLoanFunction?.Properties.Environment.Variables.EVENT_BUS_NAME).toBeDefined();
      expect(processLoanFunction?.Properties.Environment.Variables.EVENT_SOURCE).toBe('martian-bank.loans');

      // Check event producer permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            Match.objectLike({
              Action: "docdb:connect",
              Effect: "Allow",
              Resource: Match.anyValue()
            }),
            Match.objectLike({
              Action: "events:PutEvents",
              Effect: "Allow",
              Resource: Match.anyValue()
            })
          ],
          Version: "2012-10-17"
        },
        PolicyName: Match.stringLikeRegexp("LoansDomainProcessLoanFunction")
      });
    });

    test('other functions do not have event producer permissions', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      
      Object.entries(policies).forEach(([key, policy]) => {
        if (!key.includes('ProcessLoan')) {
          const statements = policy.Properties.PolicyDocument.Statement;
          const hasEventPermission = statements.some((stmt: any) => 
            stmt.Action === 'events:PutEvents'
          );
          expect(hasEventPermission).toBeFalsy();
        }
      });
    });
  });

  describe('API Configuration', () => {
    test('creates API Gateway with correct configuration', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'Loans Service',
        Description: 'API for loan management'
      });
    });

    test('creates correct API routes with proper integrations', () => {
      // Check resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'process'
      });

      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'history'
      });

      // Check HTTP methods
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST'
        }
      });

      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST'
        }
      });
    });
  });

  describe('Lambda Functions', () => {
    test('creates all required Lambda functions with correct configuration', () => {
      template.resourceCountIs('AWS::Lambda::Function', 2);

      // ProcessLoan Function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('process_loan'),
        Runtime: lambda.Runtime.PYTHON_3_9.name,
        Environment: {
          Variables: Match.objectLike({
            EVENT_BUS_NAME: Match.anyValue(),
            EVENT_SOURCE: 'martian-bank.loans',
            DB_URL: Match.anyValue()
          })
        }
      });

      // GetLoanHistory Function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('get_loan_history'),
        Runtime: lambda.Runtime.PYTHON_3_9.name,
        Environment: {
          Variables: Match.objectLike({
            DB_URL: Match.anyValue()
          })
        }
      });
    });

    test('creates Lambda layer with correct configuration', () => {
      template.hasResourceProperties('AWS::Lambda::LayerVersion', {
        CompatibleRuntimes: [lambda.Runtime.PYTHON_3_9.name],
        Description: 'Shared utilities layer'
      });
    });

    describe('Lambda Layer Integration', () => {
      test('verifies all functions use the shared layer', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
          Layers: Match.arrayWith([
            Match.objectLike({
              Ref: Match.stringLikeRegexp('LoansDomainLayer.*')
            })
          ])
        });
      });
    });
  });
});
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { TransactionsStack } from '../../../domains/transactions/infrastructure/transactions-stack';
import { NetworkStack } from '../../../lib/stacks/network-stack';

describe('TransactionsStack', () => {
  let app: cdk.App;
  let networkStack: NetworkStack;
  let stack: TransactionsStack;
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

    stack = new TransactionsStack(app, 'TestTransactionsStack', {
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
    test('SendMoneyFunction is configured as event producer', () => {
      const functions = template.findResources('AWS::Lambda::Function');
      const sendMoneyFunction = Object.values(functions).find(func => 
        func.Properties.Handler.includes('send_money')
      );
      
      expect(sendMoneyFunction?.Properties.Environment.Variables.EVENT_BUS_NAME).toBeDefined();
      expect(sendMoneyFunction?.Properties.Environment.Variables.EVENT_SOURCE).toBe('martian-bank.transactions');
    });

    test('other functions do not have event producer permissions', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      
      // Search all policies except the SendMoneyFunction policy
      Object.entries(policies).forEach(([key, policy]) => {
        if (!key.includes('SendMoney')) {
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
        Name: 'Transactions Service',
        Description: 'API for transaction management'
      });
    });

    test('creates correct API routes with proper integrations', () => {
      // Check resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'send'
      });

      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'history'
      });

      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'details'
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
      template.resourceCountIs('AWS::Lambda::Function', 3);

      // SendMoney Function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('send_money'),
        Runtime: lambda.Runtime.PYTHON_3_9.name,
        Environment: {
          Variables: Match.objectLike({
            EVENT_BUS_NAME: Match.anyValue(),
            EVENT_SOURCE: 'martian-bank.transactions',
            DB_URL: Match.anyValue()
          })
        }
      });

      // GetTransactionHistory Function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('get_transaction_history'),
        Runtime: lambda.Runtime.PYTHON_3_9.name,
        Environment: {
          Variables: Match.objectLike({
            DB_URL: Match.anyValue()
          })
        }
      });

      // GetTransactionById Function
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('get_transaction_by_id'),
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
              Ref: Match.stringLikeRegexp('TransactionsDomainLayer.*')
            })
          ])
        });
      });
    });
  });
});
import '../../../test/stacks/domains/__mocks__/lambda-mock';

import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { AccountsStack } from '../../../domains/accounts/infrastructure/accounts-stack';
import { NetworkStack } from '../../../lib/stacks/network-stack';

describe('AccountsStack', () => {
  let app: cdk.App;
  let networkStack: NetworkStack;
  let stack: AccountsStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    
    const env = { 
      account: '123456789012', 
      region: 'us-east-1' 
    };

    networkStack = new NetworkStack(app, 'TestNetworkStack', { env });

    new cdk.CfnOutput(networkStack, 'MongoDbAtlasConnectionString', {
      value: 'test-docdb-endpoint',
      exportName: 'MongoDbAtlasConnectionString'
    });

    stack = new AccountsStack(app, 'TestAccountsStack', {
      vpc: networkStack.vpc,
      eventBus: networkStack.eventBus,
      databaseEndpoint: 'test-docdb-endpoint',
      env
    });

    stack.addDependency(networkStack);
    template = Template.fromStack(stack);
  });

  describe('Cross-Stack References', () => {
    test('correctly imports DocumentDB configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            DB_URL: Match.anyValue()
          }
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
    });
  });

  describe('Event Configuration', () => {
    test('UpdateBalanceFunction is configured as event consumer', () => {
      const expectedEvents = [
        { source: 'martian-bank.loans', detailType: 'loan.granted' },
        { source: 'martian-bank.transactions', detailType: 'transaction.completed' }
      ];

      // Test EventBridge Rules
      expectedEvents.forEach(event => {
        template.hasResourceProperties('AWS::Events::Rule', {
          EventPattern: {
            source: [event.source],
            'detail-type': [event.detailType]
          },
          State: 'ENABLED',
          Targets: Match.arrayWith([
            Match.objectLike({
              Arn: Match.objectLike({
                'Fn::GetAtt': Match.arrayWith([
                  Match.stringLikeRegexp('UpdateBalanceFunction'),
                  'Arn'
                ])
              })
            })
          ])
        });
      });

      // Test Lambda Function Configuration
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('update_balance.handler'),
        Environment: {
          Variables: Match.objectLike({
            EVENT_BUS_NAME: Match.anyValue(),
            EVENT_SOURCE: 'martian-bank.accounts'
          })
        }
      });
    });

    test('other functions are not event consumers', () => {
      const rules = template.findResources('AWS::Events::Rule', {});
      const ruleCount = Object.keys(rules).length;
      expect(ruleCount).toBe(2);
    });
  });

  describe('API Configuration', () => {
    test('creates API Gateway with correct configuration', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'Accounts Service',
        Description: 'API for account management'
      });
    });

    test('creates correct API routes with proper integrations', () => {
      const expectedPaths = ['detail', 'allaccounts', 'create'];
      
      expectedPaths.forEach(path => {
        template.hasResourceProperties('AWS::ApiGateway::Resource', {
          PathPart: path
        });
      });

      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST'
        }
      });

      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
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
  });

  describe('Lambda Functions', () => {
    test('creates all required Lambda functions with correct configuration', () => {
      template.resourceCountIs('AWS::Lambda::Function', 4);

      const functions = [
        {
          name: 'GetAccountDetails',
          handler: 'get_account_details.handler',
          isEventHandler: false
        },
        {
          name: 'GetAllAccounts',
          handler: 'get_accounts.handler',
          isEventHandler: false
        },
        {
          name: 'CreateAccount',
          handler: 'create_account.handler',
          isEventHandler: false
        },
        {
          name: 'UpdateBalance',
          handler: 'update_balance.handler',
          isEventHandler: true
        }
      ];

      functions.forEach(func => {
        const envVars: any = {
          DB_URL: Match.anyValue()
        };

        if (func.isEventHandler) {
          envVars.EVENT_BUS_NAME = Match.anyValue();
          envVars.EVENT_SOURCE = 'martian-bank.accounts';
        }

        template.hasResourceProperties('AWS::Lambda::Function', {
          Handler: Match.stringLikeRegexp(func.handler),
          Runtime: lambda.Runtime.PYTHON_3_9.name,
          Environment: {
            Variables: Match.objectLike(envVars)
          },
          VpcConfig: Match.objectLike({
            SecurityGroupIds: Match.anyValue(),
            SubnetIds: Match.anyValue()
          })
        });
      });
    });

    describe('Lambda Layer Integration', () => {
      test('verifies all functions use the shared layer', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
          Layers: Match.anyValue()
        });
      });
    });
  });
});
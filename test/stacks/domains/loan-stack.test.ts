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
    test('ProcessLoanFunction in workflow is configured as event producer', () => {
      // Check if the ProcessLoan Lambda in Step Functions has event permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "events:PutEvents",
              Effect: "Allow",
              Resource: Match.anyValue()
            })
          ])
        },
        PolicyName: Match.stringLikeRegexp("ProcessLoanStepFunction")
      });

      // Verify environment variables
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('process_loan'),
        Environment: {
          Variables: Match.objectLike({
            EVENT_BUS_NAME: Match.anyValue(),
            EVENT_SOURCE: 'martian-bank.loans'
          })
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
  
    test('creates correct API routes with Step Functions integration', () => {
      // Check resources exist
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'process'
      });
  
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'history'
      });
  
      // Check Step Functions POST integration
      template.hasResourceProperties('AWS::ApiGateway::Method', Match.objectLike({
        HttpMethod: 'POST',
        Integration: {
          Type: 'AWS',
          IntegrationHttpMethod: 'POST'
        }
      }));
  
      // Check Lambda GET integration
      template.hasResourceProperties('AWS::ApiGateway::Method', Match.objectLike({
        HttpMethod: 'GET',
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST'
        }
      }));
    });
  });
  
  describe('Step Functions Configuration', () => {
    test('creates Step Functions state machine', () => {
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        DefinitionString: {
          'Fn::Join': [
            '',
            Match.arrayWith([
              Match.stringLikeRegexp('.*StartAt.*States.*')
            ])
          ]
        }
      });
    });
    
  
    test('state machine has correct IAM permissions', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: [
            Match.objectLike({
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: {
                Service: "states.amazonaws.com"
              }
            })
          ]
        })
      });
    });
  });

  describe('Lambda Functions', () => {
    test('creates all required Lambda functions with correct configuration', () => {
      template.resourceCountIs('AWS::Lambda::Function', 3); // Updated count

      // Check workflow step functions
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('get_account_details'),
        Runtime: lambda.Runtime.PYTHON_3_9.name
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('process_loan'),
        Runtime: lambda.Runtime.PYTHON_3_9.name,
        Environment: {
          Variables: Match.objectLike({
            EVENT_BUS_NAME: Match.anyValue(),
            EVENT_SOURCE: 'martian-bank.loans'
          })
        }
      });

      // Check regular functions
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: Match.stringLikeRegexp('get_loan_history'),
        Runtime: lambda.Runtime.PYTHON_3_9.name
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
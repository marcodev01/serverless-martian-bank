import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../../lib/stacks/auth-stack';

describe('AuthStack', () => {
  let app: cdk.App;
  let stack: AuthStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new AuthStack(app, 'TestAuthStack');
    template = Template.fromStack(stack);
  });

  test('creates Cognito User Pool with correct configuration', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'martian-bank-users',
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: false,
      },
      AutoVerifiedAttributes: ['email'],
      EmailVerificationMessage: Match.anyValue(),
      EmailVerificationSubject: Match.anyValue(),
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireUppercase: true,
          RequireNumbers: true,
        },
      },
      Schema: Match.arrayEquals([
        {
          Mutable: true,
          Name: "given_name",
          Required: true,
        },
        {
          Mutable: true,
          Name: "email",
          Required: true,
        }
      ]),
      UsernameAttributes: ['email']
    });
  });

  test('creates User Pool Client with correct configuration', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      UserPoolId: Match.anyValue(),
      ExplicitAuthFlows: Match.arrayEquals([
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH'
      ]),
      AllowedOAuthFlows: Match.anyValue(),
      AllowedOAuthFlowsUserPoolClient: true,
      SupportedIdentityProviders: ['COGNITO']
    });
  });

  test('creates CloudFormation outputs', () => {
    template.hasOutput('UserPoolId', {
      Value: Match.anyValue()
    });
    template.hasOutput('UserPoolClientId', {
      Value: Match.anyValue()
    });
  });

  test('sets correct removal policy', () => {
    template.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete'
    });
  });
});
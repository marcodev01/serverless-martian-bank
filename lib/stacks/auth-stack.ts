import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * The AuthStack class defines the authentication infrastructure for the Martian Bank application.
 * It sets up an Amazon Cognito User Pool for managing users and a User Pool Client for application integration.
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain; 

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

     // Create a Cognito User Pool for managing users with aws-cognito L2 construct
    this.userPool = new cognito.UserPool(this, 'MartianBankUserPool', {
      userPoolName: 'martian-bank-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        givenName: {
          required: true,
          mutable: true,
        },
        email: {
          required: true,
          mutable: true,
        },
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.LINK,
        emailSubject: 'Verify your Martian Bank account',
        emailBody: 'Hello! Click the link below to verify your Martian Bank account: {##Verify Email##}'
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create a User Pool Client for integrating the User Pool with the frontend with aws-cognito L2 construct
    this.userPoolClient = new cognito.UserPoolClient(this, 'MartianBankClient', {
      userPool: this.userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    this.userPoolDomain = this.userPool.addDomain('MartianBankDomain', {
      cognitoDomain: {
        domainPrefix: 'martianbank-auth-789'
      }
    });

    // Outputs for frontend integration
    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: this.userPool.userPoolId,
      exportName: 'UserPoolId'
    });
    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'UserPoolClientId'
    });

    new cdk.CfnOutput(this, 'UserPoolDomainOutput', {
      value: this.userPoolDomain.domainName,
      exportName: 'UserPoolDomain'
    });
  }
}
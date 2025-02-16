// domains/accounts/infrastructure/stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

/**
 * @deprecated This stack is only for demonstration purposes and should not be used
 */
interface AccountsStackPlainProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  eventBus: events.EventBus;
}

/**
 * Example implementation of the AccountsStack without using a custom Layer 3 Construct.
 * 
 * @deprecated This stack is intended for demonstration purposes only and should not be used.
 */
export class AccountsStackPlain extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  private readonly sharedLayer: lambda.LayerVersion;
  private readonly docDbClusterEndpoint: string;
  private readonly docDbSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: AccountsStackPlainProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    // Import shared resources
    this.docDbClusterEndpoint = cdk.Fn.importValue('DocDbClusterEndpoint');
    this.docDbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this, 
      'ImportedDocDbSecurityGroup', 
      cdk.Fn.importValue('DocDbSecurityGroupId')
    );
    

    /**
     * Lambda Functions
     * 
     * Level 2 Construct with aws-lambda
     */

    // Create shared Lambda layer
    this.sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(layersPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Shared utilities layer',
    });

    // Create Lambda functions for account operations
    const handlers = this.createAccountHandlers(props, handlerPath);

    /**
     * EventBus for cross domain communication 
     * 
     * Level 2 Construct with aws-events
     */
    
    this.configureEventSubscriptions(props.eventBus, handlers.updateBalance);


    /**
     * API Gateway
     * 
     * Level 2 Construct with aws-apigateway
     */

    // Create API Gateway
    this.api = this.createApiGateway(handlers);
  }

  private createAccountHandlers(props: AccountsStackPlainProps, handlerPath: string) {
    const handlers = {
      getAccountDetails: this.createLambda('GetAccountDetailsFunction', 'get_account_details.handler', props, handlerPath),
      getAllAccounts: this.createLambda('GetAllAccountsFunction', 'get_all_accounts.handler', props, handlerPath),
      createAccount: this.createLambda('CreateAccountFunction', 'create_account.handler', props, handlerPath),
      updateBalance: this.createLambda('UpdateBalanceFunction', 'update_balance.handler', props, handlerPath)
    };

    // Grant DocumentDB access to all handlers
    Object.values(handlers).forEach(handler => {
      this.grantDocumentDbAccess(handler);
    });

    return handlers;
  }

  private createApiGateway(handlers: any): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'AccountsApi', {
      restApiName: 'Accounts Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Configure API routes
    const account = api.root.addResource('account');
    account.addResource('create').addMethod('POST', new apigateway.LambdaIntegration(handlers.createAccount));
    account.addResource('detail').addMethod('POST', new apigateway.LambdaIntegration(handlers.getAccountDetails));
    account.addResource('allaccounts').addMethod('POST', new apigateway.LambdaIntegration(handlers.getAllAccounts));

    return api;
  }

  private createLambda(id: string, handler: string, props: AccountsStackPlainProps, handlerPath: string): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [this.sharedLayer],
      securityGroups: [this.docDbSecurityGroup],
      handler,
      code: lambda.Code.fromAsset(handlerPath),
      environment: {
        DB_URL: this.docDbClusterEndpoint,
        EVENT_BUS_NAME: props.eventBus.eventBusName,
        EVENT_SOURCE: 'accounts.domain'
      },
      timeout: cdk.Duration.seconds(30),
    });
  }

  private grantDocumentDbAccess(handler: lambda.Function) {
    // Grant DocumentDB IAM Access
    const clusterArn = cdk.Arn.format({
      service: 'docdb',
      resource: 'db-cluster',
      resourceName: 'SharedDocDbCluster',
      region: this.region,
      account: this.account,
    }, this);

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['docdb:connect'],
        resources: [clusterArn],
      })
    );
  }


  private configureEventSubscriptions(eventBus: events.IEventBus, handler: lambda.Function) {
    const subscriptions = [
      {
        id: 'LoanGrantedRule',
        source: 'martian-bank.loans',
        detailType: 'loan.granted'
      },
      {
        id: 'TransactionCompletedRule',
        source: 'martian-bank.transactions',
        detailType: 'transaction.completed'
      }
    ];

    subscriptions.forEach(sub => {
      new events.Rule(this, sub.id, {
        eventBus,
        eventPattern: {
          source: [sub.source],
          detailType: [sub.detailType]
        },
        targets: [new targets.LambdaFunction(handler, {
          retryAttempts: 2
        })]
      });
    });
  }
}
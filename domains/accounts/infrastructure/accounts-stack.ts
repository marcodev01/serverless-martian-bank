// domains/accounts/infrastructure/stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';
import { DomainEventBusPattern, DomainEventTypes } from '../../../lib/constructs/event-bus-pattern';

interface AccountsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  eventBus: DomainEventBusPattern;
}

/**
 * Accounts domain stack that implements the account management capabilities
 * of the Martian Bank application using a serverless architecture.
 */
export class AccountsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  private readonly sharedLayer: lambda.LayerVersion;
  private readonly docDbClusterEndpoint: string;
  private readonly docDbSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: AccountsStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    // Import shared resources
    this.docDbClusterEndpoint = cdk.Fn.importValue('SharedDocDbEndpoint');
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
     * EventBus Integration Pattern for cross domain communication using AWS EventBridge
     * 
     * Custom Level 2+ Construct combining EventBridge-EventBus, DLQ (SQS) and CloudWatch Logs
     */
    
    // Configure EventBus integration
    props.eventBus
      .configureSubscriber(handlers.updateBalance, [DomainEventTypes.LOAN_GRANTED], 'any')
      .configureSubscriber(handlers.updateBalance, [DomainEventTypes.TRANSACTION_COMPLETED], 'any');


    /**
     * API Gateway
     * 
     * Level 2 Construct with aws-apigateway
     */

    // Create API Gateway
    this.api = this.createApiGateway(handlers);
  }

  private createAccountHandlers(props: AccountsStackProps, handlerPath: string) {
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

  private createLambda(id: string, handler: string, props: AccountsStackProps, handlerPath: string): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [this.sharedLayer],
      securityGroups: [this.docDbSecurityGroup],
      handler,
      code: lambda.Code.fromAsset(handlerPath),
      environment: {
        DB_URL: this.docDbClusterEndpoint,
        EVENT_BUS_NAME: props.eventBus.eventBus.eventBusName
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
}
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import { Construct } from 'constructs';
import { DocumentDBStack } from '../../../lib/stacks/documentdb-stack';
import { DomainEventBusPattern } from '../../../lib/constructs/event-bus-pattern';

interface AccountsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  documentDb: DocumentDBStack;
  eventBus: DomainEventBusPattern;
}

export class AccountsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly domainEventBus: DomainEventBusPattern;

  constructor(scope: Construct, id: string, props: AccountsStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    /**
     * Lambda Functions
     * 
     * Level 2 Construct with aws-lambda
     */

    // Create shared Lambda layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(layersPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Shared utilities layer',
    });

    // Create Lambda functions
    const getAccountDetailsHandler = this.createLambda('GetAccountDetailsFunction', 'get_account_details.handler', props, sharedLayer, handlerPath);
    const getAllAccountsHandler = this.createLambda('GetAllAccountsFunction', 'get_all_accounts.handler', props, sharedLayer, handlerPath);
    const createAccountHandler = this.createLambda('CreateAccountFunction', 'create_account.handler', props, sharedLayer, handlerPath);
    const updateBalanceHandler = this.createLambda('UpdateBalanceFunction', 'update_balance.handler', props, sharedLayer, handlerPath);

    // Grant DocumentDB access to all Lambda functions
    this.grantDocumentDbAccess(props, [
      getAccountDetailsHandler,
      getAllAccountsHandler, 
      createAccountHandler, 
      updateBalanceHandler,
    ]);


    /**
     * EventBus Integration Pattern for cross domain communication using AWS EventBridge
     * 
     * Custom Level 3 Construct combining EventBridge-EventBus, DLQ (SQS) and CloudWatch Logs
     */

    // Create and configure the domain event bus (using Fluent API)
    props.eventBus
      .grantPutEvents(updateBalanceHandler)
      .addRule('TransactionBalanceUpdate', { // Add event rule for transaction balance update
        source: ['martian-bank.transactions'],
        detailType: ['TransactionCompleted']
      }, updateBalanceHandler)
      .addRule('LoanBalanceUpdate', { // Add event rule for loan balance update
        source: ['martian-bank.loans'],
        detailType: ['LoanGranted']
      }, updateBalanceHandler);


    /**
     * API Gateway
     * 
     * Level 2 Construct with aws-apigateway
     */

    // Create and configure API Gateway
    this.api = new apigateway.RestApi(this, 'AccountsApi', {
      restApiName: 'Accounts Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Add routes to API Gateway
    const account = this.api.root.addResource('account');
    account.addResource('create').addMethod('POST', new apigateway.LambdaIntegration(createAccountHandler));
    account.addResource('detail').addMethod('POST', new apigateway.LambdaIntegration(getAccountDetailsHandler));
    account.addResource('allaccounts').addMethod('POST', new apigateway.LambdaIntegration(getAllAccountsHandler));


    /**
     * CloudFormation console output
     * 
     * Level 1 Construct with CfnOutput
     */
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }

  private createLambda(id: string, handler: string, props: AccountsStackProps, layer: lambda.LayerVersion, handlerPath: string): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [layer],
      handler,
      code: lambda.Code.fromAsset(handlerPath),
      environment: {
        DB_URL: props.documentDb.clusterEndpoint,
        EVENT_BUS_NAME: this.domainEventBus.eventBus.eventBusName
      },
      timeout: cdk.Duration.seconds(30),
    });
  }

  private grantDocumentDbAccess(props: AccountsStackProps, handlers: lambda.Function[]): void {
    handlers.forEach(handler => props.documentDb.grantAccess(handler));
  }
}

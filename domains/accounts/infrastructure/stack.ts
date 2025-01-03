import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import { Construct } from 'constructs';
import { DocumentDBStack } from '../../../lib/stacks/documentdb-stack';
import { DomainEventBus } from '../../../lib/constructs/event-bus-pattern';

interface AccountsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  documentDb: DocumentDBStack;
}

export class AccountsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly eventBus: DomainEventBus;

  constructor(scope: Construct, id: string, props: AccountsStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    /* EventBus Integration Pattern */
    this.eventBus = new DomainEventBus(this, 'MartianBankEventBus', {
      busName: 'martian-bank-events'
    });    

    // Create shared Lambda layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(layersPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Shared utilities layer',
    });

    // Common lambda configuration
    const commonLambdaConfig = {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [sharedLayer],
      environment: {
        DB_URL: props.documentDb.clusterEndpoint,
        EVENT_BUS_NAME: this.eventBus.eventBus.eventBusName
      },
      timeout: cdk.Duration.seconds(30),
    };

    // Create Lambda functions
    const getAccountDetailsHandler = new lambda.Function(this, 'GetAccountDetailsFunction', {
      ...commonLambdaConfig,
      handler: 'get_account_details.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    const createAccountHandler = new lambda.Function(this, 'CreateAccountFunction', {
      ...commonLambdaConfig,
      handler: 'create_account.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    const updateBalanceHandler = new lambda.Function(this, 'UpdateBalanceFunction', {
      ...commonLambdaConfig,
      handler: 'update_balance.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    const getAllAccountsHandler = new lambda.Function(this, 'GetAllAccountsFunction', {
      ...commonLambdaConfig,
      handler: 'get_all_accounts.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });
    
    const getAccountByEmailHandler = new lambda.Function(this, 'GetAccountByEmailFunction', {
      ...commonLambdaConfig,
      handler: 'get_account_by_email.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    // Grant DocumentDB access to all Lambda functions
    [
      getAccountDetailsHandler, 
      createAccountHandler, 
      updateBalanceHandler,
      getAllAccountsHandler,
      getAccountByEmailHandler
    ].forEach(handler => {
      props.documentDb.grantAccess(handler);
    });

    // Add event rules for balance updates
    this.eventBus.addRule('TransactionBalanceUpdate', {
      source: ['martian-bank.transactions'],
      detailType: ['TransactionCompleted']
    }, updateBalanceHandler);

    this.eventBus.addRule('LoanBalanceUpdate', {
      source: ['martian-bank.loans'],
      detailType: ['LoanGranted']
    }, updateBalanceHandler);

    /* API Gateway */
    this.api = new apigateway.RestApi(this, 'AccountsApi', {
      restApiName: 'Accounts Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Add routes to API Gateway
    const accounts = this.api.root.addResource('accounts');

    accounts
    .addResource('create-account')
    .addMethod('POST', new apigateway.LambdaIntegration(createAccountHandler));        
    
    accounts
    .addResource('account-detail')
    .addMethod('POST', new apigateway.LambdaIntegration(getAccountDetailsHandler));

    accounts
    .addResource('get-all-accounts')
    .addMethod('POST', new apigateway.LambdaIntegration(getAllAccountsHandler));

    accounts
    .addResource('get-account-by-email')
    .addMethod('POST', new apigateway.LambdaIntegration(getAccountByEmailHandler));


    // Add CloudFormation output
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }
}
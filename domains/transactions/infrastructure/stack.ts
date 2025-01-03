import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import { Construct } from 'constructs';
import { DocumentDBStack } from '../../../lib/stacks/documentdb-stack';
import { DomainEventBus } from '../../../lib/constructs/event-bus-pattern';

interface TransactionsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  documentDb: DocumentDBStack;
}

export class TransactionsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly eventBus: DomainEventBus;

  constructor(scope: Construct, id: string, props: TransactionsStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    /**
     * Lambda Functions
     * 
     * Level 2 Construct with Lambda Function
     */

    // Create shared Lambda layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(layersPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Shared utilities layer',
    });

    // Create Lambda functions
    const sendMoneyHandler = this.createLambda('SendMoneyFunction', 'send_money.handler', props, sharedLayer, handlerPath);
    const getTransactionHistoryHandler = this.createLambda('GetTransactionHistoryFunction', 'get_transaction_history.handler', props, sharedLayer, handlerPath);
    const getTransactionByIdHandler = this.createLambda('GetTransactionByIdFunction', 'get_transaction_by_id.handler', props, sharedLayer, handlerPath);

    // Grant DocumentDB access to all Lambda functions
    this.grantDocumentDbAccess(props, [
      sendMoneyHandler,
      getTransactionHistoryHandler,
      getTransactionByIdHandler,
    ]);


    /**
     * EventBus Integration Pattern for cross domain communication using AWS EventBridge
     * 
     * Custom Level 3 Construct combining EventBridge-EventBus, DLQ (SQS) and CloudWatch Logs
     */   

    // Create and configure the domain event bus (using Fluent API)
    this.eventBus = new DomainEventBus(this, 'MartianBankEventBus', {
      busName: 'martian-bank-events'
    })
    .configureDeadLetterQueue('martian-bank-dlq', cdk.Duration.days(1))
    .enableLogging(cdk.aws_logs.RetentionDays.ONE_DAY)
    .addRule('TransactionCompletedEvent', {
        source: ['martian-bank.transactions'],
        detailType: ['TransactionCompleted']
      }, sendMoneyHandler);


    /**
     * API Gateway
     * 
     * Level 2 Construct with API Gateway
     */

    // Create and configure API Gateway
    this.api = new apigateway.RestApi(this, 'TransactionsApi', {
      restApiName: 'Transactions Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    const transaction = this.api.root.addResource('transaction')
    transaction.addResource('send').addMethod('POST', new apigateway.LambdaIntegration(sendMoneyHandler));
    transaction.addResource('history').addMethod('GET', new apigateway.LambdaIntegration(getTransactionHistoryHandler));
    transaction.addResource('details').addMethod('GET', new apigateway.LambdaIntegration(getTransactionByIdHandler));

     
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

  private createLambda(id: string, handler: string, props: TransactionsStackProps, layer: lambda.LayerVersion, handlerPath: string): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [layer],
      handler,
      code: lambda.Code.fromAsset(handlerPath),
      environment: {
        DB_URL: props.documentDb.clusterEndpoint,
        EVENT_BUS_NAME: this.eventBus.eventBus.eventBusName
      },
      timeout: cdk.Duration.seconds(30),
    });
  }

  private grantDocumentDbAccess(props: TransactionsStackProps, handlers: lambda.Function[]): void {
    handlers.forEach(handler => props.documentDb.grantAccess(handler));
  }
}

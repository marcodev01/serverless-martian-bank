import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';
import { DomainEventBus } from '../../../lib/constructs/event-bus-pattern';

export interface TransactionStackProps extends cdk.StackProps {
  eventBus: DomainEventBus;
  documentDbCluster: cdk.aws_docdb.DatabaseCluster;
  vpc: cdk.aws_ec2.IVpc;
}

export class TransactionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TransactionStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');    

    // Create shared Lambda layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(layersPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Shared utilities layer',
    });

    // Common lambda configuration
    const commonLambdaConfig: Omit<lambda.FunctionProps, 'code' | 'handler'> = {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [sharedLayer],
      environment: {
        DB_URL: props.documentDbCluster.clusterEndpoint.socketAddress,
        EVENT_BUS_NAME: props.eventBus.eventBus.eventBusName
      },
      timeout: cdk.Duration.seconds(30),
    };

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'TransactionApi', {
      restApiName: 'Transaction Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Create Lambda functions
    const sendMoneyFn = new lambda.Function(this, 'SendMoneyFunction', {
      ...commonLambdaConfig,
      handler: 'send_money.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    const getTransactionHistoryFn = new lambda.Function(this, 'GetTransactionHistoryFunction', {
      ...commonLambdaConfig,
      handler: 'get_transaction_history.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    const getTransactionByIdFn = new lambda.Function(this, 'GetTransactionByIdFunction', {
      ...commonLambdaConfig,
      handler: 'get_transaction_by_id.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    // Grant permissions
    props.documentDbCluster.connections.allowDefaultPortFrom(sendMoneyFn);
    props.documentDbCluster.connections.allowDefaultPortFrom(getTransactionHistoryFn);
    props.documentDbCluster.connections.allowDefaultPortFrom(getTransactionByIdFn);
    props.eventBus.grantPutEvents(sendMoneyFn);

    // Create API endpoints
    const transactions = api.root.addResource('transactions');

    transactions
    .addResource('transfer')
    .addMethod('POST', new apigateway.LambdaIntegration(sendMoneyFn));
  
    transactions
    .addResource('transaction-history') 
    .addMethod('POST', new apigateway.LambdaIntegration(getTransactionHistoryFn));
  
    transactions
    .addResource('transaction-with-id')
    .addMethod('POST', new apigateway.LambdaIntegration(getTransactionByIdFn));
  }
}
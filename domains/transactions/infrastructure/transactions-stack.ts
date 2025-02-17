import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { DomainBuilder } from '../../../lib/constructs/domain-construct/domain-builder';

interface TransactionsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  eventBus: events.EventBus;
  databaseEndpoint: string;
}

/**
 * The `TransactionsStack` represents the transactions domain of the Martian Bank application, following DDD principles by organizing each domain in its own stack.
 *  
 * It is part of the Architecture as Code (AaC) paradigm, using a fluent API to explicitly model the serverless architecture for this domain.
 */
export class TransactionsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: TransactionsStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    const transactionsDomain = new DomainBuilder(this, { domainName: 'transactions' })
      .withVpc(props.vpc)
      .withDocumentDb({
        clusterEndpoint: props.databaseEndpoint,
      })
      .withEventBus(props.eventBus)
      .addLambdaLayer({
        layerPath: layersPath,
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
        description: 'Shared utilities layer'
      })
      .addLambda('TransferMoneyFunction', {
        handler: 'transfer_money.handler',
        handlerPath: handlerPath
      })
        .producesEvents()
        .exposedVia('/transaction/transfer', 'POST')
        .and()
      .addLambda('GetTransactionHistoryFunction', {
        handler: 'get_transaction_history.handler',
        handlerPath: handlerPath
      })
        .exposedVia('/transaction/history', 'POST')
        .and()
      .addLambda('ZelleFunction', {
        handler: 'zelle.handler',
        handlerPath: handlerPath
      })
        .exposedVia('/transaction/zelle', 'POST')
        .and()
      .withApi({
        name: 'Transactions Service',
        description: 'API for transaction management',
        cors: { 
          allowOrigins: apigateway.Cors.ALL_ORIGINS, 
          allowMethods: apigateway.Cors.ALL_METHODS 
        }
      })
      .build(this, 'TransactionsDomain');
    
    // Expose the API Gateway as a public interface for the stack.  
    this.api = transactionsDomain.api;
    new cdk.CfnOutput(this, 'TransactionsApiUrlOutput', {
      value: transactionsDomain.api.url,
      exportName: 'TransactionsApiUrl'
    });    
  }
}
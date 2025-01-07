import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { DomainBuilder } from '../../../lib/constructs/domain-construct/domain-builder';

interface AccountsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  eventBus: events.EventBus;
}

/**
 * The `AccountsStack` represents the accounts domain of the Martian Bank application, following DDD principles by organizing each domain in its own stack.
 *  
 * It is part of the Architecture as Code (AaC) paradigm, using a fluent API to explicitly model the serverless architecture for this domain.
 */
export class AccountsStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: AccountsStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    const accountsDomain = new DomainBuilder({ domainName: 'accounts' })
      .withVpc(props.vpc)
      .withDocumentDb({
        clusterEndpoint: cdk.Fn.importValue('SharedDocDbEndpoint'),
        securityGroupId: cdk.Fn.importValue('DocDbSecurityGroupId')
      })
      .withEventBus(props.eventBus) 
      .addLambdaLayer({
        layerPath: layersPath,
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
        description: 'Shared utilities layer'
      })
      .addLambda('GetAccountDetailsFunction', {
        handler: 'get_account_details.handler',
        handlerPath: handlerPath
      })
        .exposedVia('/account/detail', 'POST')
        .and()
      .addLambda('GetAllAccountsFunction', {
        handler: 'get_all_accounts.handler',
        handlerPath: handlerPath
      })
        .exposedVia('/account/allaccounts', 'POST')
        .and()
      .addLambda('CreateAccountFunction', {
        handler: 'create_account.handler',
        handlerPath: handlerPath
      })
        .exposedVia('/account/create', 'POST')
        .and()
      .addLambda('UpdateBalanceFunction', {
        handler: 'update_balance.handler',
        handlerPath: handlerPath
      })
        .consumesEvent('martian-bank.loans', 'loan.granted')
        .consumesEvent('martian-bank.transactions', 'transaction.completed')
        .and()
      .withApi({
        name: 'Accounts Service',
        description: 'API for account management',
        cors: { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS }
      }) 
      .build(this, 'AccountsDomain');

    // Expose the API Gateway as a public interface for the stack.  
    this.api = accountsDomain.api;
  }
}
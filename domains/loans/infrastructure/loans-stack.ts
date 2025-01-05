import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { DomainBuilder } from '../../../lib/constructs/domain-construct/domain-builder';

interface LoansStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  eventBus: events.EventBus;
}

/**
 * The `LoansStack` represents the loans domain of the Martian Bank application, following DDD principles by organizing each domain in its own stack.
 *  
 * It is part of the Architecture as Code (AaC) paradigm, using a fluent API to explicitly model the serverless architecture for this domain.
 */
export class LoansStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: LoansStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    const loansDomain = new DomainBuilder({ domainName: 'loans' })
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
      .addLambda('ProcessLoanFunction', {
        handler: 'process_loan.handler',
        handlerPath: handlerPath
      })
        .producesEvents()
        .exposedVia('/loan/process', 'POST')
        .and()
      .addLambda('GetLoanHistoryFunction', {
        handler: 'get_loan_history.handler',
        handlerPath: handlerPath
      })
        .exposedVia('/loan/history', 'GET')
        .and()
      .withApi({
        name: 'Loans Service',
        description: 'API for loan management',
        cors: { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS }
      })
      .build(this, 'LoansDomain');

    // Expose the API Gateway as a public interface for the stack.   
    this.api = loansDomain.api;
  }
}
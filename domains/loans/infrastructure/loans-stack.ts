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
  databaseEndpoint: string;
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
    /*
     * Note: By using an AWS Step Functions workflow, the separation of concerns principle is enforced,  
     * as functions in the loans domain no longer access the accounts domain's database directly.  
     * However, this approach introduces an explicit dependency from the loans domain to the accounts domain.  
     * Unlike direct cross-domain database access within Lambda functions, where dependencies remain implicit,  
     * this workflow-based approach makes the dependency explicit and manageable.
    */
    const accountsHandlerPath = path.resolve(__dirname, '../../accounts/application/handlers');

    const loansDomain = new DomainBuilder(this, { domainName: 'loans' })
      .withVpc(props.vpc)
      .withDocumentDb({
        clusterEndpoint: props.databaseEndpoint
      })
      .withEventBus(props.eventBus)
      .addLambdaLayer({
        layerPath: layersPath,
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
        description: 'Shared utilities layer'
      })
      .addLambda('GetLoanHistoryFunction', { handler: 'get_loan_history.handler', handlerPath: handlerPath })
      .exposedVia('/loan/history', 'GET')
      .and()
      .withWorkflow('LoanProcessingWorkflow')
      .addStep('GetAccountDetails', { handler: 'get_account_details.handler', handlerPath: accountsHandlerPath })
      .addStep('ProcessLoan', { handler: 'process_loan.handler', handlerPath: handlerPath },
        lambdaBuilder => lambdaBuilder.producesEvents()
      )
      .exposedVia('/loan/process', 'POST')
      .and()
      .withApi({
        name: 'Loans Service',
        description: 'API for loan management',
        cors: { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS }
      })
      .build(this, 'LoansDomain');

    // Expose the API Gateway as a public interface for the stack.   
    this.api = loansDomain.api;
    new cdk.CfnOutput(this, 'LoansApiUrlOutput', {
      value: loansDomain.api.url,
      exportName: 'LoansApiUrl'
    });    
  }
}
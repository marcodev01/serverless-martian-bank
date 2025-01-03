import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import { Construct } from 'constructs';
import { DocumentDBStack } from '../../../lib/stacks/documentdb-stack';
import { DomainEventBusPattern } from '../../../lib/constructs/event-bus-pattern';

interface LoansStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  documentDb: DocumentDBStack;
  eventBus: DomainEventBusPattern;
}

export class LoansStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly domainEventBus: DomainEventBusPattern;

  constructor(scope: Construct, id: string, props: LoansStackProps) {
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
    const processLoanHandler = this.createLambda('ProcessLoanFunction', 'process_loan.handler', props, sharedLayer, handlerPath);
    const getLoanHistoryHandler = this.createLambda('GetLoanHistoryFunction', 'get_loan_history.handler', props, sharedLayer, handlerPath);

    // Grant DocumentDB access to all Lambda functions
    this.grantDocumentDbAccess(props, [
      processLoanHandler,
      getLoanHistoryHandler,
    ]);
    
    
    /**
     * EventBus Integration Pattern for cross domain communication using AWS EventBridge
     * 
     * Custom Level 3 Construct combining EventBridge-EventBus, DLQ (SQS) and CloudWatch Logs
     */

    // Create and configure the domain event bus (using Fluent API)
    props.eventBus
      .grantPutEvents(processLoanHandler)
      .addRule('LoanProcessedEvent', { // Add event rules for loan events
        source: ['martian-bank.loans'],
        detailType: ['LoanProcessed']
      }, processLoanHandler);


    /**
     * API Gateway
     * 
     * Level 2 Construct with aws-apigateway
     */

    // Create and configure API Gateway
    this.api = new apigateway.RestApi(this, 'LoansApi', {
      restApiName: 'Loans Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Add routes to API Gateway
    const loan = this.api.root.addResource('loan');
    loan.addResource('process').addMethod('POST', new apigateway.LambdaIntegration(processLoanHandler));
    loan.addResource('history').addMethod('GET', new apigateway.LambdaIntegration(getLoanHistoryHandler));

    
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

  private createLambda(id: string, handler: string, props: LoansStackProps, layer: lambda.LayerVersion, handlerPath: string): lambda.Function {
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

  private grantDocumentDbAccess(props: LoansStackProps, handlers: lambda.Function[]): void {
    handlers.forEach(handler => props.documentDb.grantAccess(handler));
  }
}

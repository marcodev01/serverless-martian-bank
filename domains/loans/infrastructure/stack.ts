import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';
import { DomainEventBus } from '../../../lib/constructs/event-bus-pattern';

export interface LoanStackProps extends cdk.StackProps {
  eventBus: DomainEventBus;
  documentDbCluster: cdk.aws_docdb.DatabaseCluster;
  vpc: cdk.aws_ec2.IVpc;
}

export class LoanStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LoanStackProps) {
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

    // Create API
    const api = new apigateway.RestApi(this, 'LoanApi', {
      restApiName: 'Loan Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Create Lambda functions
    const processLoanFn = new lambda.Function(this, 'ProcessLoanFunction', {
      ...commonLambdaConfig,
      handler: 'process_loan.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    const getLoanHistoryFn = new lambda.Function(this, 'GetLoanHistoryFunction', {
      ...commonLambdaConfig,
      handler: 'get_loan_history.handler',
      code: lambda.Code.fromAsset(handlerPath),
    });

    // Grant permissions
    props.documentDbCluster.connections.allowDefaultPortFrom(processLoanFn);
    props.documentDbCluster.connections.allowDefaultPortFrom(getLoanHistoryFn);
    props.eventBus.grantPutEvents(processLoanFn);

    // Create API endpoints
    const loans = api.root.addResource('loan');

    loans
      .addResource('request')
      .addMethod('POST', new apigateway.LambdaIntegration(processLoanFn));

    loans
      .addResource('history')
      .addMethod('POST', new apigateway.LambdaIntegration(getLoanHistoryFn));
  }
}
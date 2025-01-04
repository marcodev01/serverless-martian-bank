import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';
import { DomainEventBusPattern, DomainEventTypes } from '../../../lib/constructs/event-bus-pattern';

interface LoansStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  eventBus: DomainEventBusPattern;
}

/**
 * Loans domain stack that implements the loan management capabilities
 * of the Martian Bank application using a serverless architecture.
 */
export class LoansStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  private readonly sharedLayer: lambda.LayerVersion;
  private readonly docDbClusterEndpoint: string;
  private readonly docDbSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: LoansStackProps) {
    super(scope, id, props);

    const layersPath = path.resolve(__dirname, '../../../lib/layers/python');
    const handlerPath = path.resolve(__dirname, '../application/handlers');

    // Import shared resources
    this.docDbClusterEndpoint = cdk.Fn.importValue('SharedDocDbEndpoint');
    this.docDbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this, 
      'ImportedDocDbSecurityGroup', 
      cdk.Fn.importValue('DocDbSecurityGroupId')
    );

    /**
     * Lambda Functions
     * 
     * Level 2 Construct with aws-lambda
     */

    // Create shared Lambda layer
    this.sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(layersPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Shared utilities layer',
    });

    // Create Lambda functions for loan operations
    const handlers = this.createLoanHandlers(props, handlerPath);

    /**
     * EventBus Integration Pattern for cross domain communication using AWS EventBridge
     * 
     * Custom Level 2+ Construct combining EventBridge-EventBus, DLQ (SQS) and CloudWatch Logs
     */
    
    // Configure EventBus integration
    props.eventBus
      .registerEventType(DomainEventTypes.LOAN_GRANTED)
      .configurePublisher(handlers.processLoan, [DomainEventTypes.LOAN_GRANTED]);

    /**
     * API Gateway
     * 
     * Level 2 Construct with aws-apigateway
     */

    // Create API Gateway
    this.api = this.createApiGateway(handlers);
  }

  private createLoanHandlers(props: LoansStackProps, handlerPath: string) {
    const handlers = {
      processLoan: this.createLambda('ProcessLoanFunction', 'process_loan.handler', props, handlerPath),
      getLoanHistory: this.createLambda('GetLoanHistoryFunction', 'get_loan_history.handler', props, handlerPath),
    };

    // Grant DocumentDB access to all handlers
    Object.values(handlers).forEach(handler => {
      this.grantDocumentDbAccess(handler);
    });

    return handlers;
  }

  private createApiGateway(handlers: any): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'LoansApi', {
      restApiName: 'Loans Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      }
    });

    // Configure API routes
    const loan = api.root.addResource('loan');
    loan.addResource('process').addMethod('POST', new apigateway.LambdaIntegration(handlers.processLoan));
    loan.addResource('history').addMethod('GET', new apigateway.LambdaIntegration(handlers.getLoanHistory));

    return api;
  }

  private createLambda(id: string, handler: string, props: LoansStackProps, handlerPath: string): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      layers: [this.sharedLayer],
      securityGroups: [this.docDbSecurityGroup],
      handler,
      code: lambda.Code.fromAsset(handlerPath),
      environment: {
        DB_URL: this.docDbClusterEndpoint,
        EVENT_BUS_NAME: props.eventBus.eventBus.eventBusName
      },
      timeout: cdk.Duration.seconds(30),
    });
  }

  private grantDocumentDbAccess(handler: lambda.Function) {
    // Grant DocumentDB IAM Access
    const clusterArn = cdk.Arn.format({
      service: 'docdb',
      resource: 'db-cluster',
      resourceName: 'SharedDocDbCluster',
      region: this.region,
      account: this.account,
    }, this);

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['docdb:connect'],
        resources: [clusterArn],
      })
    );
  }
}
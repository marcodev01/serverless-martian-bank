import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { DomainStackProps } from '../types';


/**
 * Custom Level 3 Construct that implements a domain-specific service with Lambda functions, API Gateway, and event integration to support an event-driven architecture.
 * 
 * This construct demonstrates the Architecture as Code Paradigm (AaC) by the modularity and reusability of serverless application components.
 */
export class DomainPattern extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: { [key: string]: lambda.Function };
  private readonly lambdaLayers: { [key: string]: lambda.LayerVersion } | null;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id);

    this.lambdaLayers = this.createLambdaLayers(props);

    this.lambdaFunctions = this.createLambdaHandlers(props);

    this.configureEventIntegration(props);

    this.api = this.createApiGateway(props);
  }

  /**
   * Creates shared Lambda layers that can be reused by multiple Lambda functions.
   * @param props Configuration for the Lambda layers.
   * @returns A map of layer names to their corresponding LayerVersion instances.
   */
  private createLambdaLayers(props: DomainStackProps): { [key: string]: lambda.LayerVersion } | null {
    if (!props.lambdaLayers?.length) {
      return null;
    }

    const layers: { [key: string]: lambda.LayerVersion } = {};

    /* Level 2 Construct with aws-lambda */
    props.lambdaLayers.forEach((layerConfig, index) => {
      const layerId = `Layer${index}`;
      layers[layerId] = new lambda.LayerVersion(this, layerId, {
        code: lambda.Code.fromAsset(layerConfig.layerPath),
        compatibleRuntimes: layerConfig.compatibleRuntimes,
        description: layerConfig.description
      });
    });

    return layers;
  }

  /**
   * Creates the Lambda functions based on the configuration provided in props.
   * @param props Configuration for the Lambda functions.
   * @returns A map of function names to their corresponding Function instances.
   */
  private createLambdaHandlers(props: DomainStackProps): { [key: string]: lambda.Function } {
    const handlers: { [key: string]: lambda.Function } = {};
    
    props.lambdaConfigs.forEach(config => {
      const securityGroups = [];

      // Attach security groups if a database configuration is provided
      if (props.dbConfig) {
        securityGroups.push(
          /* Level 2 Construct with aws-ec2 */
          ec2.SecurityGroup.fromSecurityGroupId(
            this,
            `${config.name}DbSecurityGroup`,
            props.dbConfig.securityGroupId
          )
        );
      }

      const environment: { [key: string]: string } = {
        ...config.environment
      };
      // Add event-related environment variables only if EventBus exists
      if (props.eventBus) {
        environment.EVENT_BUS_NAME = props.eventBus.eventBusName;
        environment.EVENT_SOURCE = `martian-bank.${props.domainName}`;
      }
      // Add DB_URL if database config exists
      if (props.dbConfig) {
        environment.DB_URL = props.dbConfig.clusterEndpoint;
      }

      // Create the Lambda function with the specified configuration by the Level 2 Construct aws-lambda
      const handler = new lambda.Function(this, config.name, {
        runtime: config.runtime || lambda.Runtime.PYTHON_3_9, // Default to Python 3.9 if runtime is not specified
        vpc: props.vpc,
        layers: this.lambdaLayers ? Object.values(this.lambdaLayers): undefined,
        securityGroups,
        handler: config.handler,
        code: lambda.Code.fromAsset(config.handlerPath),
        memorySize: config.memorySize,
        timeout: config.timeout,
        environment: environment
      });

      // Grant DocumentDB access if the DB configuration exists
      if (props.dbConfig) {
        this.grantDocumentDbAccess(handler);
      }

      handlers[config.name] = handler;
    });

    return handlers;
  }

  /**
   * Configures API Gateway to expose the Lambda functions as REST endpoints.
   * @param props Configuration for the API Gateway.
   * @returns The created API Gateway instance.
   */
  private createApiGateway(props: DomainStackProps): apigateway.RestApi {

    /* Level 2 Construct with aws-apigateway */
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: props.apiConfig?.name || `${props.domainName} Service`, // Set API name or default to domain name
      description: props.apiConfig?.description, // Optional description for the API
      defaultCorsPreflightOptions: props.apiConfig?.cors ? 
      { allowOrigins: props.apiConfig.cors.allowOrigins, allowMethods: props.apiConfig.cors.allowMethods } : 
      { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS }
    });

    // Map API routes to their respective Lambda functions
    props.apiRoutes.forEach(route => {
      const handler = this.lambdaFunctions[route.handlerName];
      if (!handler) {
        throw new Error(`Handler ${route.handlerName} not found`);
      }

      const resource = api.root.resourceForPath(route.path);
      resource.addMethod(route.method, new apigateway.LambdaIntegration(handler));
    });

    return api;
  }

  /**
   * Configures event-driven architecture using EventBridge rules and Lambda functions.
   * @param props Configuration for events and consumers.
   */
  private configureEventIntegration(props: DomainStackProps) {
    // Skip event configuration if no EventBus is provided
    if (!props.eventBus) {
      return;
    }

    const eventBus = props.eventBus;

    props.lambdaConfigs.forEach(config => {
      const handler = this.lambdaFunctions[config.name];

      if (config.eventProducer) {
        eventBus.grantPutEventsTo(handler);
      }

      if (config.eventConsumers) {
        config.eventConsumers.forEach(consumer => {
          new events.Rule(this, `${config.name}${consumer.detailType}Rule`, {
            eventBus: eventBus,
            eventPattern: {
              source: [consumer.source],
              detailType: [consumer.detailType]
            },
            targets: [new targets.LambdaFunction(handler, {
              retryAttempts: 2
            })]
          });
        });
      }
    });
  }

  /**
   * Grants IAM permissions for DocumentDB access to a Lambda function.
   * @param handler The Lambda function requiring DocumentDB access.
   */
  private grantDocumentDbAccess(handler: lambda.Function) {
    const clusterArn = cdk.Arn.format({
      service: 'docdb',
      resource: 'db-cluster',
      resourceName: 'SharedDocDbCluster',
      region: cdk.Stack.of(this).region,
      account: cdk.Stack.of(this).account,
    }, cdk.Stack.of(this));

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['docdb:connect'], // Allow connection to DocumentDB
        resources: [clusterArn], // Restrict to the specific cluster
      })
    );
  }
}
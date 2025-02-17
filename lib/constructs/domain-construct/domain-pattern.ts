import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { ApiRoute, DomainStackProps } from '../types';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { execSync } from 'child_process';
import { existsSync } from 'fs';


/**
 * Custom Level 3 Construct that implements a domain-specific service with Lambda functions, API Gateway, and event integration to support an event-driven architecture.
 * 
 * This construct demonstrates the Architecture as Code Paradigm (AaC) by the modularity and reusability of serverless application components.
 */
export class DomainPattern extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: { [key: string]: lambda.Function };
  private readonly lambdaLayers: { [key: string]: lambda.LayerVersion } | null;
  public readonly workflow?: sfn.StateMachine | null;
  private readonly apiRoutes: ApiRoute[];

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id);

    this.apiRoutes = props.apiRoutes;
    this.lambdaLayers = this.createLambdaLayers(props);
    this.lambdaFunctions = this.createLambdaHandlers(props);
    this.configureEventIntegration(props);
    this.api = this.createApiGateway(props);

    // Create workflow if configured
    if (props.workflowBuilder) {
      this.workflow = props.workflowBuilder.build();
    }

    // Configure API integrations by mapping routes to either Lambda functions or Step Functions (workflows)
    this.configureApiIntegrations();
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

    props.lambdaLayers.forEach((layerConfig, index) => {
      const layerId = `Layer${index}`;

      // Automatically installs Python dependencies for the Lambda layer.
      const outputDir = `.build/layer${index}`;

      const isPythonRuntime = layerConfig.compatibleRuntimes.some(runtime =>
        runtime.name.toLowerCase().includes('python')
      );

      if (isPythonRuntime) {
        const pythonDir = `${outputDir}/python`;

        execSync(`mkdir -p ${pythonDir}`);

        execSync(`cp -r ${layerConfig.layerPath}/python/* ${pythonDir}/`);

        if (existsSync(`${layerConfig.layerPath}/requirements.txt`)) {
          execSync(`pip install -r ${layerConfig.layerPath}/requirements.txt -t ${pythonDir} --upgrade`, {
            stdio: 'inherit'
          });
        }
      }

      layers[layerId] = new lambda.LayerVersion(this, layerId, {
        compatibleRuntimes: layerConfig.compatibleRuntimes,
        description: layerConfig.description,
        code: lambda.Code.fromAsset(outputDir)
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
        layers: this.lambdaLayers ? Object.values(this.lambdaLayers) : undefined,
        handler: config.handler,
        code: lambda.Code.fromAsset(config.handlerPath),
        memorySize: config.memorySize,
        timeout: config.timeout,
        environment: environment
      });

      handlers[config.name] = handler;
    });

    return handlers;
  }

  /**
 * Creates the API Gateway for handling HTTP requests.
 * @param props API configuration.
 * @returns The created API Gateway instance.
 */
  private createApiGateway(props: DomainStackProps): apigateway.RestApi {
    /* Level 2 Construct with aws-apigateway */
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: props.apiConfig?.name || `${props.domainName} Service`,
      description: props.apiConfig?.description,
      defaultCorsPreflightOptions: props.apiConfig?.cors ?
        { allowOrigins: props.apiConfig.cors.allowOrigins, allowMethods: props.apiConfig.cors.allowMethods } :
        { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS }
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
  * Configures API integrations by mapping API routes to either Lambda functions or Step Functions.
  */
  private configureApiIntegrations(): void {
    if (!this.api) return;

    this.apiRoutes.forEach(route => {
      const resource = this.api.root.resourceForPath(route.path);

      if (route.type === 'lambda') {
        // Lambda integration
        const lambda = this.lambdaFunctions[route.target];
        if (!lambda) {
          throw new Error(`Lambda function "${route.target}" not found`);
        }
        resource.addMethod(route.method,
          new apigateway.LambdaIntegration(lambda)
        );
      } else {
        // Workflow integration
        const workflow = this.workflow;
        if (!workflow) return;

        const apiRole = new iam.Role(this, `${route.target}ApiRole`, {
          assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
          inlinePolicies: {
            'StepFunctionsExecute': new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['states:StartExecution'],
                  resources: [workflow.stateMachineArn]
                })
              ]
            })
          }
        });

        const integration = new apigateway.AwsIntegration({
          service: 'states',
          action: 'StartExecution',
          options: {
            credentialsRole: apiRole,
            requestTemplates: {
              'application/json': `{
                            "input": "$util.escapeJavaScript($input.json('$'))",
                            "stateMachineArn": "${workflow.stateMachineArn}"
                        }`
            },
            integrationResponses: [{
              statusCode: '200',
              responseTemplates: {
                'application/json': `{
                                "executionArn": "$util.parseJson($input.json('$')).executionArn",
                                "startDate": "$util.parseJson($input.json('$')).startDate"
                            }`
              }
            }]
          }
        });

        resource.addMethod(route.method, integration, {
          methodResponses: [{ statusCode: '200' }]
        });
      }
    });
  }

}
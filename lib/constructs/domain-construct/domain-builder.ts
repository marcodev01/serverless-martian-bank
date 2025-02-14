import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { 
  DomainStackProps,
  ApiConfig,
  DocumentDbConfig,
  LambdaConfig,
  ApiRoute,
  LambdaLayerConfig,
} from '../types';
import { LambdaBuilder } from './lambda-builder';
import { DomainPattern } from './domain-pattern';
import { WorkflowBuilder } from './workflow-builder';

/**
 * The `DomainBuilder` class provides a fluent API based on the Builder pattern to construct and configure domain-specific services. 
 * This approach ensures a clear separation of configuration and implementation (seperation of concerns principle) while promoting component reusability.
 * Addionally, the builder validates the configuration before resource creation, ensuring that all required components are provided.
 */
export class DomainBuilder {
  private readonly scope: Construct;
  private readonly domainName: string;
  private readonly lambdaConfigs: Map<string, LambdaConfig> = new Map();
  private readonly lambdaLayers: LambdaLayerConfig[] = [];
  private readonly apiRoutes: ApiRoute[] = [];

  private vpc?: ec2.IVpc;
  private eventBus?: events.EventBus;
  private apiConfig?: ApiConfig;
  private dbConfig?: DocumentDbConfig;
  private workflowBuilder?: WorkflowBuilder;

  constructor(scope: Construct, props: { domainName: string } ) {
    this.scope = scope;
    this.domainName = props.domainName;
  }

   /**
   * Configures the VPC for the domain. A VPC is essential for network isolation 
   * and secure communication between resources.
   * @param vpc The VPC instance.
   * @returns The current `DomainBuilder` instance.
   */
  public withVpc(vpc: ec2.IVpc): this {
    this.vpc = vpc;
    return this;
  }

  /**
   * Configures the EventBus for the domain. EventBridge is used to handle event-driven workflows.
   * @param eventBus The EventBus instance.
   * @returns The current `DomainBuilder` instance.
   */
  public withEventBus(eventBus: events.EventBus): this {
    this.eventBus = eventBus;
    return this;
  }

  /**
   * Configures the API Gateway for the domain, enabling REST API interactions.
   * @param config Configuration object for API Gateway.
   * @returns The current `DomainBuilder` instance.
   */
  public withApi(config: ApiConfig): this {
    this.apiConfig = config;
    return this;
  }

  /**
   * Configures the connection to DocumentDB, allowing the domain to interact with a database.
   * @param config Configuration object for DocumentDB.
   * @returns The current `DomainBuilder` instance.
   */
  public withDocumentDb(config: DocumentDbConfig): this {
    this.dbConfig = config;
    return this;
  }

  /**
   * Configures a generic workflow with the specified Lambda steps.
   * @param id The name of the workflow.
   * @returns A `WorkflowBuilder` instance to further configure the workflow.
   */
    public withWorkflow(id: string): WorkflowBuilder {
      this.workflowBuilder = new WorkflowBuilder(this.scope, id, this);
      return this.workflowBuilder;
  }

  /**
   * Adds a shared Lambda layer to the domain. Lambda layers are used to share code or libraries
   * across multiple Lambda functions, improving reusability and maintainability.
   * @param config Configuration object for the Lambda layer.
   * @returns The current `DomainBuilder` instance.
   */
  public addLambdaLayer(config: LambdaLayerConfig): this {
    this.lambdaLayers.push(config);
    return this;
  }

  /**
   * Adds a new Lambda function to the domain, representing a "nano-service" responsible for processing server-side business logic.
   * This function is then available for routing via API Gateway.
   * @param name The unique name of the Lambda function.
   * @param config Configuration for the Lambda handler.
   * @returns A `LambdaBuilder` instance for further customization of the Lambda function.
   */
  public addLambda(name: string, config: { handler: string, handlerPath: string } ): LambdaBuilder {
    const lambdaConfig: LambdaConfig = {
      name,
      handler: config.handler,
      handlerPath: config.handlerPath,
      runtime: lambda.Runtime.PYTHON_3_9, // Default runtime set to Python 3.9
      timeout: cdk.Duration.seconds(30), // Default timeout of 30 seconds
      memorySize: 256, // Default memory allocation of 256 MB
      environment: {}
    };
    this.lambdaConfigs.set(name, lambdaConfig);
    return new LambdaBuilder(this, lambdaConfig);
  }

  /**
   * Adds a new API route to the domain, linking it to a Lambda function.
   * @param route The API route configuration.
   */
  public addApiRoute(route: ApiRoute): void {
    if (route.type === 'lambda' && !this.lambdaConfigs.has(route.target)) {
      throw new Error(`Lambda handler ${route.target} not found. Please define the lambda first.`);
    }
    this.apiRoutes.push(route);
}
  /**
   * Builds and returns a `DomainPattern` instance based on the current configuration.
   * @param scope The CDK construct scope.
   * @param id The unique identifier for the construct.
   * @returns The constructed `DomainPattern` instance.
   */
  public build(scope: Construct, id: string): DomainPattern {
    this.validateConfiguration();

    const props: DomainStackProps = {
        domainName: this.domainName,
        vpc: this.vpc!,
        eventBus: this.eventBus,
        apiConfig: this.apiConfig,
        dbConfig: this.dbConfig,
        lambdaConfigs: Array.from(this.lambdaConfigs.values()),
        lambdaLayers: this.lambdaLayers,
        workflowBuilder: this.workflowBuilder,
        apiRoutes: this.apiRoutes
    };

    return new DomainPattern(scope, id, props);
}
  
    /**
     * Validates the domain configuration to ensure all required components are provided.
     * Throws an error if any mandatory configuration is missing.
     */
    private validateConfiguration(): void {
      if (!this.vpc) {
        throw new Error('VPC must be specified using withVpc()');
      }
      if (!this.apiConfig) {
        throw new Error('API must be specified using withApi()');
      }
      if (this.lambdaConfigs.size === 0) {
        throw new Error('At least one Lambda function must be configured using addLambda()');
      }
  
      // Validate regular Lambda functions
      for (const [lambdaName, lambdaConfig] of this.lambdaConfigs) {
        const isWorkflowLambda = lambdaName.includes('StepFunction') && this.workflowBuilder?.hasStep(lambdaName.replace('StepFunction', ''));
        
        if (isWorkflowLambda) continue;
  
        const hasEventConsumer = lambdaConfig.eventConsumers && lambdaConfig.eventConsumers.length > 0;
        const hasRoute = this.apiRoutes.some(route => route.target === lambdaName);
        
        if (!hasEventConsumer && !hasRoute) {
          throw new Error(`Lambda function "${lambdaName}" must have at least one API route configured or consume events`);
        }
      }
  
      // Validate workflow if exists
      if (this.workflowBuilder) {
        if (!this.workflowBuilder.hasSteps()) {
          throw new Error('Workflow must have at least one step configured');
        }
  
        const workflowRoutes = this.apiRoutes.filter(route => route.type === 'workflow');
        if (workflowRoutes.length === 0) {
          throw new Error('Workflow must have at least one API route configured');
        }
      }
    }
}
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LambdaConfig } from '../types';
import { DomainBuilder } from './domain-builder';

/**
 * The `LambdaBuilder` class provides a fluent API for configuring individual Lambda functions as part of a domain-specific service. 
 * It works in conjunction with the `DomainBuilder` to define runtime settings, resource allocation, and event-driven integration for each Lambda function,  
 * including those that are part of a Step Function workflow (`StepFunction`), which cannot be directly exposed via API Gateway.
 * 
 * This class encapsulates the Lambda function configuration logic, ensuring that individual functions can be tailored while remaining consistent with the domain-wide architecture.
 */
export class LambdaBuilder {
  private isWorkflowStep: boolean = false;

  constructor(
    private readonly domainBuilder: DomainBuilder,
    private readonly config: LambdaConfig
  ) {
    this.isWorkflowStep = config.name.endsWith('StepFunction');
  }

  /**
   * Sets the runtime environment for the Lambda function (e.g., Python, Node.js).
   * @param runtime The desired Lambda runtime (e.g., `lambda.Runtime.NODEJS_16_X`).
   * @returns The current instance for method chaining.
   */
  public withRuntime(runtime: lambda.Runtime): this {
    this.config.runtime = runtime;
    return this;
  }

  /**
   * Allocates memory for the Lambda function in MB.
   * @param sizeInMB The memory size in megabytes (e.g., 128, 256, 512).
   * @returns The current instance for method chaining.
   */
  public withMemory(sizeInMB: number): this {
    this.config.memorySize = sizeInMB;
    return this;
  }

  /**
   * Configures the maximum execution time for the Lambda function.
   * @param duration The timeout duration (e.g., `cdk.Duration.seconds(30)`).
   * @returns The current instance for method chaining.
   */
  public withTimeout(duration: cdk.Duration): this {
    this.config.timeout = duration;
    return this;
  }

  /**
   * Adds or updates environment variables for the Lambda function.
   * @param env A key-value map of environment variables.
   * @returns The current instance for method chaining.
   */
  public withEnvironment(env: { [key: string]: string }): this {
    this.config.environment = { ...this.config.environment, ...env };
    return this;
  }

  /**
   * Marks the Lambda function as an event producer, enabling it to publish events to EventBridge.
   * @returns The current instance for method chaining.
   */
  public producesEvents(): this {
    this.config.eventProducer = true;
    return this;
  }

  /**
   * Adds an event consumer configuration for the Lambda function, allowing it to process events from specific sources and detail types.
   * @param source The source of the events (e.g., `martian-bank.accounts`).
   * @param detailType The type of event details to consume (e.g., `AccountCreated`).
   * @returns The current instance for method chaining.
   */
  public consumesEvent(source: string, detailType: string): this {
    if (!this.config.eventConsumers) {
      this.config.eventConsumers = [];
    }
    this.config.eventConsumers.push({ source, detailType });
    return this;
  }

  /**
   * Exposes the Lambda function via an API Gateway route.
   * If the function is part of a Step Function workflow, direct API exposure is not allowed.
   * @param path The API route path (e.g., `/accounts`).
   * @param method The HTTP method for the route (e.g., `GET`, `POST`).
   * @returns The current instance for method chaining.
   * @throws Error if trying to expose a workflow step directly.
   */
  public exposedVia(path: string, method: string): this {
    if (this.isWorkflowStep) {
      throw new Error(
          `Cannot expose workflow step "${this.config.name}" directly via API Gateway. ` +
          `API routes must be exposed on the workflow level using workflow.exposedVia()`
      );
  }

    this.domainBuilder.addApiRoute({
        path,
        method,
        target: this.config.name,
        type: 'lambda'
    });
    return this;
}

  /**
   * Returns control back to the parent `DomainBuilder`, allowing further configuration of the domain.
   * This marks the end of the current Lambda configuration process.
   * @returns The `DomainBuilder` instance.
   */
  public and(): DomainBuilder {
    return this.domainBuilder;
  }
}
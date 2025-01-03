import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface DomainEventBusProps {
  /**
   * The name of the EventBridge event bus.
   */
  busName: string;
}

/**
 * A custom Level 3 CDK construct that encapsulates an EventBridge event bus
 * combinied with a Dead Letter Queue (DLQ) using Amazon SQS and CloudWatch logging.
 *
 * This construct represents a EventBus Integration Pattern for cross-domain communication 
 * It provides a fluent API to manage permissions, routing rules, DLQs, and logging.
 */
export class DomainEventBusPattern extends Construct {
  public readonly eventBus: events.EventBus;
  private dlq?: sqs.Queue;

  constructor(scope: Construct, id: string, props: DomainEventBusProps) {
    super(scope, id);

    // Create the EventBridge event bus with the specified name.
    this.eventBus = new events.EventBus(this, 'Bus', {
      eventBusName: props.busName
    });
  }


  /**
   * Grants the specified Lambda function permissions to publish events to the event bus.
   *
   * @param handler - The Lambda function to which permissions are granted.
   * @returns The current instance for method chaining.
   */
  public grantPutEvents(handler: lambda.Function): this {
    this.eventBus.grantPutEventsTo(handler);
    return this;
  }

  /**
   * Adds a rule to route events matching a specific pattern to a target Lambda function.
   * Optionally integrates the DLQ for retry behavior.
   *
   * @param id - A unique identifier for the rule.
   * @param pattern - The event pattern to match.
   * @param target - The Lambda function to invoke when the rule matches.
   * @returns The current instance for method chaining.
   */
  public addRule(id: string, pattern: events.EventPattern, target: lambda.Function): this {
    new events.Rule(this, id, {
      eventBus: this.eventBus,
      eventPattern: pattern,
      targets: [new cdk.aws_events_targets.LambdaFunction(target, {
        deadLetterQueue: this.dlq,
        retryAttempts: 2,
      })]
    });
    return this;
  }

  /**
   * Enables CloudWatch logging for the event bus, with a specified retention period.
   *
   * @param retention - The retention period for the CloudWatch logs.
   * @returns The current instance for method chaining.
   */
  public enableLogging(retention: cdk.aws_logs.RetentionDays): this {
    new cdk.aws_logs.LogGroup(this, 'EventBusLogs', {
      retention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    return this;
  }

  /**
   * Configures a Dead Letter Queue (DLQ) for the event bus.
   *
   * @param queueName - The name of the DLQ.
   * @param retentionPeriod - The retention period for messages in the DLQ.
   * @returns The current instance for method chaining.
   */
  public configureDeadLetterQueue(queueName: string, retentionPeriod: cdk.Duration): this {
    this.dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName,
      retentionPeriod,
    });
    return this;
  }

  /**
   * Retrieves the configured Dead Letter Queue (DLQ).
   *
   * @returns The SQS queue configured as the DLQ, or undefined if not configured.
   */
  public getDeadLetterQueue(): sqs.Queue | undefined {
    return this.dlq;
  }
}

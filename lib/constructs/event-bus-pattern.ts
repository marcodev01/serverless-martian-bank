import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface DomainEventBusProps {
  /**
   * The name of the event bus
   */
  busName: string;
}

/**
 * Event Bus Integration Pattern for domain events communication using EventBridge
 */
export class DomainEventBus extends Construct {
  public readonly eventBus: events.EventBus;
  private dlq?: sqs.Queue;

  constructor(scope: Construct, id: string, props: DomainEventBusProps) {
    super(scope, id);

    // Create the event bus
    this.eventBus = new events.EventBus(this, 'Bus', {
      eventBusName: props.busName
    });
  }

  /**
   * Grant permissions to publish events to the bus
   */
  public grantPutEvents(handler: lambda.Function): this {
    this.eventBus.grantPutEventsTo(handler);
    return this;
  }

  /**
   * Add a rule to route specific events to a Lambda function
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
   * Enable CloudWatch logging
   */
  public enableLogging(retention: cdk.aws_logs.RetentionDays): this {
    new cdk.aws_logs.LogGroup(this, 'EventBusLogs', {
      retention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    return this;
  }

  /**
   * Configure a Dead Letter Queue (DLQ)
   */
  public configureDeadLetterQueue(queueName: string, retentionPeriod: cdk.Duration): this {
    this.dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName,
      retentionPeriod,
    });
    return this;
  }

  /**
   * Get the configured DLQ
   */
  public getDeadLetterQueue(): sqs.Queue | undefined {
    return this.dlq;
  }
}

// Example usage with fluent API:
// const eventBus = new DomainEventBus(this, 'MyEventBus', { busName: 'my-bus' })
//   .configureDeadLetterQueue('my-dlq', cdk.Duration.days(3))
//   .grantPutEvents(myLambda)
//   .addRule('MyRule', { source: ['my-app'] }, myLambda)
//   .enableLogging(cdk.aws_logs.RetentionDays.ONE_WEEK);
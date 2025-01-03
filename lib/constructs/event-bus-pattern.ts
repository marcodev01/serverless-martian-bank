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
  private readonly dlq: sqs.Queue;
  
  constructor(scope: Construct, id: string, props: DomainEventBusProps) {
    super(scope, id);
    
    // Create the event bus
    this.eventBus = new events.EventBus(this, 'Bus', {
      eventBusName: props.busName
    });

    // Create DLQ for failed events
    this.dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${props.busName}-dlq`,
      retentionPeriod: cdk.Duration.days(1),
    });    
    
    // Enable CloudWatch logging for the event bus
    const logGroup = new cdk.aws_logs.LogGroup(this, 'EventBusLogs', {
      retention: cdk.aws_logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
  }

  /**
   * Grant permissions to publish events to the bus
   */
  public grantPutEvents(handler: lambda.Function) {
    this.eventBus.grantPutEventsTo(handler);
  }

  /**
   * Add a rule to route specific events to a Lambda function
   */
  public addRule(id: string, pattern: events.EventPattern, target: lambda.Function) {
    const rule = new events.Rule(this, id, {
      eventBus: this.eventBus,
      eventPattern: pattern,
      targets: [new cdk.aws_events_targets.LambdaFunction(target, {
        deadLetterQueue: this.dlq,
        retryAttempts: 2,
      })]
    });
  }
}
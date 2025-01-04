import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DomainEventBusPattern } from '../constructs/event-bus-pattern';

/**
 * Base network infrastructure stack that provides a shared VPC and event bus for the Martian Bank application. 
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly eventBus: DomainEventBusPattern;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC using the ec2.vpc Level 2 Construct that implements AWS best practices
    this.vpc = new ec2.Vpc(this, 'SharedVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        }
      ]
    });



    // Create domain event bus with dead letter queue and logging using the custom Level 2+ Construct
    this.eventBus = new DomainEventBusPattern(this, 'MartianBankEventBus', {
      busName: 'martian-bank-event-bus'
    })
    .configureDeadLetterQueue('martian-bank-dlq', cdk.Duration.days(1))
    .enableLogging(cdk.aws_logs.RetentionDays.ONE_DAY);

  }
}
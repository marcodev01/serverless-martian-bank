import '../stacks/domains/__mocks__/lambda-mock';

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import { TransactionsStack } from '../../domains/transactions/infrastructure/transactions-stack';
import { AccountsStack } from '../../domains/accounts/infrastructure/accounts-stack';
import { LoansStack } from '../../domains/loans/infrastructure/loans-stack';

describe('Domain Stacks Snapshot Tests', () => {
  let app: cdk.App;
  let vpc: ec2.IVpc;
  let eventBus: events.EventBus;
  let testStack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    testStack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    // Create shared test infrastructure
    vpc = ec2.Vpc.fromVpcAttributes(testStack, 'TestVPC', {
      vpcId: 'vpc-12345',
      availabilityZones: ['us-east-1a', 'us-east-1b'],
      privateSubnetIds: ['subnet-12345', 'subnet-67890'],
      publicSubnetIds: ['subnet-public1', 'subnet-public2']
    });

    eventBus = new events.EventBus(testStack, 'TestEventBus', {
      eventBusName: 'test-event-bus'
    });
  });

  test('TransactionsStack snapshot', () => {
    const stack = new TransactionsStack(app, 'TestTransactionsStack', {
      vpc,
      eventBus,
      env: { account: '123456789012', region: 'us-east-1' },
      databaseEndpoint: 'test-cluster-endpoint'
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('AccountsStack snapshot', () => {
    const stack = new AccountsStack(app, 'TestAccountsStack', {
      vpc,
      eventBus,
      env: { account: '123456789012', region: 'us-east-1' },
      databaseEndpoint: 'test-cluster-endpoint'
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('LoansStack snapshot', () => {
    const stack = new LoansStack(app, 'TestLoansStack', {
      vpc,
      eventBus,
      env: { account: '123456789012', region: 'us-east-1' },
      databaseEndpoint: 'test-cluster-endpoint'
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
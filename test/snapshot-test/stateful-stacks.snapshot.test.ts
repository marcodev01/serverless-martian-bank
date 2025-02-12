import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { AuthStack } from '../../lib/stacks/auth-stack';
import { NetworkStack } from '../../lib/stacks/network-stack';
import { DocumentDBStack } from '../../lib/stacks/documentdb-stack';

describe('Stateful Stacks Snapshot Tests', () => {
  let app: cdk.App;
  let vpc: ec2.IVpc;
  let testStack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    testStack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
  });

  test('AuthStack snapshot', () => {
    const stack = new AuthStack(app, 'TestAuthStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('NetworkStack snapshot', () => {
    const stack = new NetworkStack(app, 'TestNetworkStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('DocumentDBStack snapshot', () => {
    vpc = ec2.Vpc.fromVpcAttributes(testStack, 'TestVPC', {
      vpcId: 'vpc-12345',
      availabilityZones: ['eu-central-1a', 'eu-central-1b'],
      privateSubnetIds: ['subnet-12345', 'subnet-67890'],
      publicSubnetIds: ['subnet-public1', 'subnet-public2'],
      vpcCidrBlock: '10.0.0.0/16'
    });

    const stack = new DocumentDBStack(app, 'TestDocumentDBStack', {
      vpc,
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
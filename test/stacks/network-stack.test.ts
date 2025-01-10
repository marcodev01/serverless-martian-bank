import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../../lib/stacks/network-stack';

describe('NetworkStack', () => {
  let app: cdk.App;
  let stack: NetworkStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new NetworkStack(app, 'TestNetworkStack');
    template = Template.fromStack(stack);
  });

  test('creates VPC with correct configuration', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
      CidrBlock: Match.anyValue()
    });

    // Verify subnet configuration
    template.resourceCountIs('AWS::EC2::Subnet', 4); // 2 AZs * (1 public + 1 private) = 4 subnets
   
    // Verify NAT Gateway
    template.resourceCountIs('AWS::EC2::NatGateway', 1);

    // Verify Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
  });

  test('creates correct subnet configuration', () => {
    // Check public subnets
    template.hasResourceProperties('AWS::EC2::Subnet', {
      MapPublicIpOnLaunch: true,
      Tags: Match.arrayWith([
        {
          Key: 'aws-cdk:subnet-type',
          Value: 'Public'
        }
      ])
    });

    // Check private subnets
    template.hasResourceProperties('AWS::EC2::Subnet', {
      MapPublicIpOnLaunch: false,
      Tags: Match.arrayWith([
        {
          Key: 'aws-cdk:subnet-type',
          Value: 'Private'
        }
      ])
    });
  });

  test('creates EventBridge event bus', () => {
    template.hasResourceProperties('AWS::Events::EventBus', {
      Name: 'MartianBankEventBus'
    });
  });
});
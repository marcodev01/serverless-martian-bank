import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DocumentDBStack } from '../../lib/stacks/documentdb-stack';

describe('DocumentDBStack', () => {
  let app: cdk.App;
  let stack: DocumentDBStack;
  let template: Template;
  
  beforeEach(() => {
    app = new cdk.App();
    
    // Create mock VPC
    const mockVpc = ec2.Vpc.fromVpcAttributes(new cdk.Stack(app, 'TestStack'), 'MockVPC', {
      vpcId: 'vpc-12345',
      availabilityZones: ['us-east-1a', 'us-east-1b'],
      privateSubnetIds: ['subnet-1234', 'subnet-5678'],
      vpcCidrBlock: '10.0.0.0/16'
    });

    // Create DocumentDB stack with mock VPC
    stack = new DocumentDBStack(app, 'TestDocumentDBStack', {
      vpc: mockVpc,
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    template = Template.fromStack(stack);
  });

  test('creates DocumentDB cluster with correct configuration', () => {
    template.hasResourceProperties('AWS::DocDB::DBCluster', {
      EngineVersion: '4.0.0',
      Port: 27017,
      DeletionProtection: false,
      VpcSecurityGroupIds: Match.anyValue(),
      MasterUsername: Match.anyValue(),
      MasterUserPassword: Match.anyValue()
    });
   
    template.resourceCountIs('AWS::DocDB::DBInstance', 1);
    template.hasResourceProperties('AWS::DocDB::DBInstance', {
      DBInstanceClass: 'db.t4g.small'
    });
  });

  test('creates security group with correct rules', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for shared DocumentDB cluster',
      VpcId: Match.anyValue(),
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          FromPort: 27017,
          ToPort: 27017,
          IpProtocol: 'tcp',
          Description: Match.anyValue(),
          CidrIp: Match.anyValue()  // Since we are using a mock, accept any CIDR
        })
      ])
    });
  });

  test('creates CloudFormation outputs', () => {
    template.hasOutput('DocDbClusterEndpoint', {
      Value: Match.anyValue()
    });
    template.hasOutput('DocDbSecurityGroupId', {
      Value: Match.anyValue()
    });
  });

  test('sets correct removal policy', () => {
    template.hasResource('AWS::DocDB::DBCluster', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete'
    });
  });
});
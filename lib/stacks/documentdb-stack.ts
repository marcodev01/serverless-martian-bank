import * as cdk from 'aws-cdk-lib';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Props for shared DocumentDB
 */
interface DocumentDBStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

/**
 * Shared DocumentDB infrastructure stack that provisions a MongoDB-compatible database cluster. 
 * Creates a single cluster that is shared across all domains of the Martian Bank application.
 */
export class DocumentDBStack extends cdk.Stack {
  public readonly cluster: docdb.DatabaseCluster;
  public readonly clusterEndpoint: string;
  public readonly port: number;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DocumentDBStackProps) {
    super(scope, id, props);

    // Create a security group for the DocDB cluster using L2 construct
    this.securityGroup = new ec2.SecurityGroup(this, 'DocDbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for shared DocumentDB cluster',
      allowAllOutbound: true,
    });

    // Allow inbound traffic from within VPC
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(27017),
      'Allow MongoDB access from within VPC'
    );

    // Create DocumentDB cluster using L2 construct
    this.cluster = new docdb.DatabaseCluster(this, 'SharedDocDbCluster', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      instances: 1,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroup: this.securityGroup,
      engineVersion: '4.0.0',
      port: 27017,
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.unsafePlainText('password'), // TODO: AWS Secrets Manager
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    this.clusterEndpoint = this.cluster.clusterEndpoint.hostname;
    this.port = this.cluster.clusterEndpoint.port;

    // Export cluster information for cross-stack references
    new cdk.CfnOutput(this, 'DocDbClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'DocumentDB Cluster Endpoint',
      exportName: 'DocDbClusterEndpoint',
    });
    
    new cdk.CfnOutput(this, 'DocDbSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'DocumentDB Security Group ID',
      exportName: 'DocDbSecurityGroupId',
    });
  }
}

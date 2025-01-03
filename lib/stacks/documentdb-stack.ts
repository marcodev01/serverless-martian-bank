import * as cdk from 'aws-cdk-lib';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for shared DocumentDB
 */
interface DocumentDBStackProps {
  vpc: ec2.IVpc;
}

/**
 * Shared DocumentDB stack that creates a single cluster for all domains
 */
export class DocumentDBStack extends cdk.Stack {
  public readonly cluster: docdb.DatabaseCluster;
  public readonly clusterEndpoint: string;
  public readonly port: number;

  constructor(scope: Construct, id: string, props: DocumentDBStackProps) {
    super(scope, id);

    // Create a security group for the DocDB cluster
    const securityGroup = new ec2.SecurityGroup(this, 'DocDbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for shared DocumentDB cluster',
      allowAllOutbound: true,
    });

    // Allow inbound traffic on the DocDB port
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(27017),
      'Allow MongoDB access from within VPC'
    );

    // Create the DocumentDB cluster
    this.cluster = new docdb.DatabaseCluster(this, 'SharedDocDbCluster', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      instances: 1,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroup: securityGroup,
      engineVersion: '4.0',
      port: 27017,
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('password'), // TODO: AWS Secrets Manager
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    this.clusterEndpoint = this.cluster.clusterEndpoint.hostname;
    this.port = this.cluster.clusterEndpoint.port;

    // Add CloudFormation outputs
    new cdk.CfnOutput(this, 'DocDbEndpoint', {
      value: this.clusterEndpoint,
      description: 'DocumentDB Cluster Endpoint',
      exportName: 'SharedDocDbEndpoint',
    });

    new cdk.CfnOutput(this, 'DocDbPort', {
      value: this.port.toString(),
      description: 'DocumentDB Port',
      exportName: 'SharedDocDbPort',
    });
  }

  /**
   * Grant a Lambda function access to the DocumentDB cluster
   */
  public grantAccess(func: lambda.Function) {
    const clusterArn = this.formatArn({
      service: 'docdb',
      resource: 'db-cluster',
      resourceName: this.cluster.clusterIdentifier,
    });

    this.cluster.connections.allowDefaultPortFrom(func);

    func.addToRolePolicy(new iam.PolicyStatement({
      actions: ['docdb:connect'],
      resources: [clusterArn],
    }));
  }
}

import * as cdk from 'aws-cdk-lib';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fs from 'fs';
import * as path from 'path';
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

    // Load and validate database config
    const dbConfig = this.loadDatabaseConfig();

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
        username: dbConfig.username,
        password: cdk.SecretValue.unsafePlainText(dbConfig.password),
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

  /**
  * Validates database credentials from external JSON config file.
  * 
  * NOTE: For demo/development purposes only.
  * In production environments, credentials should be managed through AWS Secrets Manager.
  * This project uses an untracked JSON file for simplicity and cost reasons.
  * 
  * Validates:
  * - Config file exists
  * - Valid JSON format
  * - Username/password present and valid strings
  * - Password meets minimum length
  * 
  * @returns {Object} Database credentials {username, password}
  * @throws {Error} If validation fails
  */  
  private loadDatabaseConfig(): { username: string; password: string } {
    const configPath = path.join(__dirname, '../config/database.json');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(
        'Database config not found at ' + configPath + 
        '\nPlease create it using database.example.json as template'
      );
    }
 
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
 
      if (!config.username || typeof config.username !== 'string') {
        throw new Error('Database config must contain a valid username string');
      }
 
      if (!config.password || typeof config.password !== 'string') {
        throw new Error('Database config must contain a valid password string'); 
      }
 
      if (config.username.length < 1) {
        throw new Error('Username cannot be empty');
      }
 
      if (config.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
 
      return config;
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON in database config file');
      }
      throw error;
    }
  }
}

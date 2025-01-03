#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DocumentDBStack } from '../lib/stacks/documentdb-stack';
import { AccountsStack } from '../domains/accounts/infrastructure/stack';

const app = new cdk.App();

// Environment configuration
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION
};

// Create VPC for all services
const networkStack = new cdk.Stack(app, 'NetworkStack', { env });
const vpc = new ec2.Vpc(networkStack, 'SharedVpc', {
  maxAzs: 2,
  natGateways: 1,
});

// Create shared DocumentDBStack
const documentDbStack = new DocumentDBStack(app, 'DocumentDBStack', {
  vpc,
});

// Create Accounts Stack
new AccountsStack(app, 'MartianBankAccountsStack', { env, vpc, documentDb: documentDbStack });

// Tags for all resources
cdk.Tags.of(app).add('project', 'serverless-martian-bank');
cdk.Tags.of(app).add('environment', 'development');

app.synth();
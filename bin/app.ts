#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DocumentDBStack } from '../lib/stacks/documentdb-stack';
import { AccountsStack } from '../domains/accounts/infrastructure/stack';
import { LoansStack } from '../domains/loans/infrastructure/stack';
import { TransactionsStack } from '../domains/transactions/infrastructure/stack';
import { DomainEventBusPattern } from '../lib/constructs/event-bus-pattern';


/**
 * The root of the AWS CDK application.
 * 
 * It serves as the entry point for defining one or more stacks. 
 * Each stack represents a collection of AWS resources that are deployed togeth
*/
const app = new cdk.App();

// Environment configuration for the deployment
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION
};

/**
 * Network Stack
 * 
 * This stack contains the VPC and EventBus, which are shared across all domain stacks.
 */
const networkStack = new cdk.Stack(app, 'NetworkStack', { env });

// Shared VPC configuration using the ec2.vpc Level 2 Construct
const vpc = new ec2.Vpc(networkStack, 'SharedVpc', {
  maxAzs: 2,
  natGateways: 1,
});

// Global configuration of shared EventBus for cross domain communication
const domainEventBusPattern = new DomainEventBusPattern(networkStack, 'MartianBankEventBus', {
  busName: 'martian-bank-event-bus'
})
.configureDeadLetterQueue('martian-bank-dlq', cdk.Duration.days(1))
.enableLogging(cdk.aws_logs.RetentionDays.ONE_DAY);


/**
 * Statefull Stack with DocumentDB
 * 
 * A shared DocumentDB instance for stateful data storage across domain stacks.
 */
const documentDbStack = new DocumentDBStack(app, 'DocumentDBStack', {
  vpc,
});

/**
 * Stateless Domain Stacks
 * 
 * Stateless stacks for Accounts, Loans, and Transactions.
 * These stacks use the shared VPC, DocumentDB, and EventBus.
 */

// Accounts domain Stack
new AccountsStack(app, 'MartianBankAccountsStack', { 
  env, 
  vpc, 
  documentDb: documentDbStack, 
  eventBus: domainEventBusPattern 
});

// Loans domain Stack
new LoansStack(app, 'MartianBankLoansStack', { 
  env, 
  vpc, 
  documentDb: documentDbStack, 
  eventBus: domainEventBusPattern 
});

// Transactions domain Stack
new TransactionsStack(app, 'MartianBankTransactionsStack', { 
  env, 
  vpc, 
  documentDb: documentDbStack, 
  eventBus: domainEventBusPattern 
});

/**
 * Global tags for resource identification
 */
cdk.Tags.of(app).add('project', 'serverless-martian-bank');
cdk.Tags.of(app).add('environment', 'development');

app.synth();
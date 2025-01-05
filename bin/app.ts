#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DocumentDBStack } from '../lib/stacks/documentdb-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { AccountsStack } from '../domains/accounts/infrastructure/accounts-stack';
import { TransactionsStack } from '../domains/transactions/infrastructure/transactions-stack';
import { LoansStack } from '../domains/loans/infrastructure/loans-stack';


/**
 * The root of the AWS CDK application.
 * 
 * It serves as the entry point for defining one or more stacks. 
 * Each stack represents a collection of AWS resources that are deployed together
 */
const app = new cdk.App();

// Environment configuration for the deployment
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION
};

/**
 * Network Stack (independent)
 * 
 * Base infrastructure stack providing shared networking resources:
 * - VPC with public and private subnets
 * - EventBus for cross-domain communication
 */
const networkStack = new NetworkStack(app, 'NetworkStack', { env });

/**
 * Statefull Stack with DocumentDB
 * 
 * Shared database stack providing MongoDB-compatible document storage:
 * - DocumentDB cluster in private subnets
 * - Security group configuration
 */
const documentDbStack = new DocumentDBStack(app, 'DocumentDBStack', { env, vpc: networkStack.vpc } );

/**
 * Stateless Domain Stacks
 * 
 * Stateless stacks for Application Domains:
 * - Serverless API with domain spefiic logic provided by Lambda functions
 * - Event-driven integration for cross domain communication
 * - Secure database access 
 */
// Loans domain Stack
const loansStack = new LoansStack(app, 'LoansStack', { 
  env, 
  vpc: networkStack.vpc, 
  eventBus: networkStack.eventBus
});
// transactions domain Stack
const transactionsStack = new TransactionsStack(app, 'TransactionsStack', { 
  env, 
  vpc: networkStack.vpc, 
  eventBus: networkStack.eventBus
});
// Accounts domain Stack
const accountsStack = new AccountsStack(app, 'AccountsStack', { 
  env, 
  vpc: networkStack.vpc, 
  eventBus: networkStack.eventBus
});

/**  
 * Make dependencies explicit between stacks as part of the Architecture as Code (AaC) paradigm.
 *
 * While the AWS CDK can infer dependencies based on resource references, explicitly defining them enhances clarity and control over deployment order. 
 * Note: CDK respects these dependencies during deployment to maintain consistency.
 */
// DocumentDB stack depends on NetworkStack for VPC. 
documentDbStack.addDependency(networkStack); 

[loansStack, transactionsStack, accountsStack].forEach(domainStack => {
  // Each domain stack depends on NetworkStack for VPC and EventBus
  domainStack.addDependency(networkStack);
  // Each domain stack depends on DocumentDBStack for database access. 
  // Note:  This dependency is resolved through CloudFormation exports, promoting loose coupling between stacks.
  domainStack.addDependency(documentDbStack);
});

/**
 * Global tags for resource tagging
 */
cdk.Tags.of(app).add('project', 'serverless-martian-bank');
cdk.Tags.of(app).add('environment', 'development');

app.synth();
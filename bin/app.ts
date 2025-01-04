#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DocumentDBStack } from '../lib/stacks/documentdb-stack';
import { AccountsStack } from '../domains/accounts/infrastructure/accounts-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { LoansStack } from '../domains/loans/infrastructure/loans-stack';
import { TransactionsStack } from '../domains/transactions/infrastructure/transactions-stack';


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
// Make dependencies explicit (AaC Paradigm)
documentDbStack.addDependency(networkStack); // Depends on NetworkStack for VPC. Note: CDK respects this order during deployment.


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
// Make dependencies explicit (AaC Paradigm)
loansStack.addDependency(networkStack); // Depends on NetworkStack for VPC and EventBus
// Note: This dependency is injected via CloudFormation exports for loose coupling and avoiding cyclic dependencies...
loansStack.addDependency(documentDbStack); // Depends on DocumentDBStack for database access. 

// // Loans domain Stack
// const transactionsStack = new TransactionsStack(app, 'TransactionsStack', { 
//   env, 
//   vpc: networkStack.vpc, 
//   eventBus: networkStack.eventBus
// });
// // Make dependencies explicit (AaC Paradigm)
// transactionsStack.addDependency(networkStack); // Depends on NetworkStack for VPC and EventBus
// // Note: This dependency is injected via CloudFormation exports for loose coupling and avoiding cyclic dependencies...
// transactionsStack.addDependency(documentDbStack); // Depends on DocumentDBStack for database access.

// // Accounts domain Stack
// const accountsStack = new AccountsStack(app, 'AccountsStack', { 
//   env, 
//   vpc: networkStack.vpc, 
//   eventBus: networkStack.eventBus
// });
// // Make dependencies explicit (AaC Paradigm)
// accountsStack.addDependency(networkStack); // Depends on NetworkStack for VPC and EventBus
// // Note: This dependency is injected via CloudFormation exports for loose coupling and avoiding cyclic dependencies...
// accountsStack.addDependency(documentDbStack); // Depends on DocumentDBStack for database access. 


/**
 * Global tags for resource tagging
 */
cdk.Tags.of(app).add('project', 'serverless-martian-bank');
cdk.Tags.of(app).add('environment', 'development');

app.synth();
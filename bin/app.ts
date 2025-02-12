#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DocumentDBStack } from '../lib/stacks/documentdb-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { AccountsStack } from '../domains/accounts/infrastructure/accounts-stack';
import { TransactionsStack } from '../domains/transactions/infrastructure/transactions-stack';
import { LoansStack } from '../domains/loans/infrastructure/loans-stack';
import { UiStack } from '../ui/infrastructure/ui-stack';
import { AtmStack } from '../domains/atm/infrastructure/atm-stack';
import { AuthStack } from '../lib/stacks/auth-stack';


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
* Auth Stack (independent)
* 
* Base authentication infrastructure using AWS Cognito BaaS (Backend as a Service):
* - User Pool for user management and authentication
* - User Pool Client for frontend application access
*/
const authStack = new AuthStack(app, 'AuthStack', { env });

/**
 * DocumentDB Stack
 * 
 * Stateful stack with shared database providing MongoDB-compatible document storage:
 * - DocumentDB cluster in private subnets
 * - Security group configuration
 */
const documentDbStack = new DocumentDBStack(app, 'DocumentDBStack', { env, vpc: networkStack.vpc } );

/**
 * Domain Stacks
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
// ATM Locator Domain Stack
// For simplicity, the ATM domain loads static ATM data from a JSON file, eliminating the need for database access.
// Additionally, the ATM domain does not use an event-driven architecture.
const atmStack = new AtmStack(app, 'AtmStack', { 
  env, 
  vpc: networkStack.vpc, 
});

/**
 * UI Stack
 * 
 * Deploys the frontend for the `serverless-martian-bank` application:
 * - Hosts the React-based frontend application in an S3 bucket.
 * - Distributes content globally using CloudFront.
 * - Dynamically injects API URLs for domain-specific APIs (Accounts, Transactions, Loans, etc.).
 * 
 *  Prerequisite: The React application must be built (e.g., using vite build), with the resulting artifacts placed in the ../build directory of the UI module.
 */
const uiStack = new UiStack(app, 'UiStack', {
  env,
  accountsApiUrl: accountsStack.api.url,
  transactionsApiUrl: transactionsStack.api.url,
  loanApiUrl: loansStack.api.url,
  atmApiUrl: atmStack.api.url, 
  cognitoPoolId: authStack.userPool.userPoolId,
  cognitoClientId: authStack.userPoolClient.userPoolClientId
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
  // Note: This dependency is resolved through CloudFormation exports, promoting loose coupling between stacks.
  domainStack.addDependency(documentDbStack);
  // UI Stack depends on each domain stack to ensure APIs are ready.
  uiStack.addDependency(domainStack);
});
// ATM Domain stack depends on NetworkStack only for VPC.
atmStack.addDependency(networkStack);
// UI Stack depends on Auth Stack for User Management with AWS Cognito BaaS
uiStack.addDependency(authStack);

/**
 * Global tags for resource tagging
 */
cdk.Tags.of(app).add('project', 'serverless-martian-bank');
cdk.Tags.of(app).add('environment', 'development');

app.synth();
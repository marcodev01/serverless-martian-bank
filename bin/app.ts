#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { AccountsStack } from '../domains/accounts/infrastructure/accounts-stack';
import { TransactionsStack } from '../domains/transactions/infrastructure/transactions-stack';
import { LoansStack } from '../domains/loans/infrastructure/loans-stack';
import { UiStack } from '../ui/infrastructure/ui-stack';
import { AtmStack } from '../domains/atm/infrastructure/atm-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { MongoDBAtlasStack } from '../lib/stacks/documentdb-stack';


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
const documentDbStack = new MongoDBAtlasStack(app, 'DocumentDBStack', { env });

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
  eventBus: networkStack.eventBus,
  databaseEndpoint: cdk.Fn.importValue('MongoDbAtlasConnectionString')
});
// transactions domain Stack
const transactionsStack = new TransactionsStack(app, 'TransactionsStack', { 
  env, 
  vpc: networkStack.vpc, 
  eventBus: networkStack.eventBus,
  databaseEndpoint: cdk.Fn.importValue('MongoDbAtlasConnectionString')
});
// Accounts domain Stack
const accountsStack = new AccountsStack(app, 'AccountsStack', { 
  env, 
  vpc: networkStack.vpc, 
  eventBus: networkStack.eventBus,
  databaseEndpoint: cdk.Fn.importValue('MongoDbAtlasConnectionString')
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
const uiStack = new UiStack(app, 'UiStack', { env });


/**  
 * Make dependencies explicit between stacks as part of the Architecture as Code (AaC) paradigm.
 *
 * While the AWS CDK can infer dependencies based on resource references, explicitly defining them enhances clarity and control over deployment order. 
 * Note: CDK respects these dependencies during deployment to maintain consistency.
 */
// Ensure DocumentDBStack is deployed after NetworkStack (VPC dependency)
documentDbStack.addDependency(networkStack);

// Ensure all domain stacks (Accounts, Transactions, Loans) are deployed after NetworkStack and DocumentDBStack
accountsStack.addDependency(networkStack);
accountsStack.addDependency(documentDbStack);

transactionsStack.addDependency(networkStack);
transactionsStack.addDependency(documentDbStack);

loansStack.addDependency(networkStack);
loansStack.addDependency(documentDbStack);

atmStack.addDependency(networkStack);

// Ensure UI Stack is deployed last, after all APIs and authentication are ready
uiStack.addDependency(authStack);      // Cognito (UserPool + Client)
uiStack.addDependency(atmStack);       // ATM API
uiStack.addDependency(accountsStack);  // Accounts API
uiStack.addDependency(transactionsStack); // Transactions API
uiStack.addDependency(loansStack);     // Loans API

/**
 * Global tags for resource tagging
 */
cdk.Tags.of(app).add('project', 'serverless-martian-bank');
cdk.Tags.of(app).add('environment', 'development');

app.synth();
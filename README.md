# serverless-martian-bank

This project demonstrates a serverless architecture using the Architecture as Code (AaC) paradigm, developed with AWS CDK (TypeScript). 
It is based on the [Martian Bank Demo](https://github.com/cisco-open/martian-bank-demo) by Outshift by Cisco and reimagines its microservice architecture in a serverless environment.

## Project Overview

The **Serverless Martian Bank** showcases a Domain-Driven Design (DDD) approach. Each business domain (Accounts, Loans, Transactions) is implemented as an independent, stateless stack. 
It incorporates the use of AWS CDK constructs across multiple levels (L1, L2, and custom L3) to showcase reusable and modular design patterns for demonstration and research purposes.
The architecture is composed of the following stack types:

### Core Stacks

1. **Network Stack**:
   - Contains foundational networking resources such as a shared VPC and a custom EventBus for cross-domain communication.
   - This stack provides the base infrastructure required by all other stacks.

2. **DocumentDB Stack**:
   - Implements a shared stateful database (AWS DocumentDB) to store data for all domains.

### Domain Stacks

Each domain (Accounts, Loans, Transactions) is designed as an independent, stateless stack that uses the shared infrastructure provided by the core stacks. These stacks include domain-specific Lambda functions, APIs, and integration with the shared EventBus for inter-domain communication.

## AWS CDK

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Build and Test
- `npm run build`   - Compile TypeScript to JavaScript. **Useful to catch syntax and type errors at compile time.**
- `npm run watch`   - Watch for changes and recompile automatically.
- `npm run test`    - Run Jest unit tests.

### CDK Commands
- `cdk synth`   - Synthesize the CloudFormation templates.
- `cdk diff`    - Compare deployed stacks with the current state.
- `cdk deploy`  - Deploy stacks to your default AWS account/region.
- `cdk destroy` - Remove deployed stacks.

## Deployment

### Deployment Order
1. Deploy the **Network Stack** (shared VPC and EventBus):
   ```bash
   cdk deploy NetworkStack
   ```
2. Deploy the **DocumentDB Stack** (shared stateful database):
   ```bash
   cdk deploy DocumentDBStack
   ```
3. Deploy the domain-specific stacks (AccountsStack, LoansStack, TransactionsStack):
   ```bash
   cdk deploy MartianBankAccountsStack
   cdk deploy MartianBankLoansStack
   cdk deploy MartianBankTransactionsStack
   ```

### Independent Deployment
Each domain stack can be deployed independently as long as its dependencies (Network Stack, DocumentDB Stack) are already provisioned.

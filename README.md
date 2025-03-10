# serverless-martian-bank

This project demonstrates a serverless application using the Architecture as Code (AaC) paradigm, developed with AWS CDK (TypeScript). 
It is based on the [Martian Bank Demo](https://github.com/cisco-open/martian-bank-demo) by Outshift by Cisco and reimagines its microservice architecture in a serverless environment.

## Project Overview

The **Serverless Martian Bank** showcases a Architecture as Code (AaC) approach applying Domain-Driven Design (DDD). Each business domain (Accounts, Loans, Transactions, ATM) is implemented as an independent, stateless stack. It incorporates the use of AWS CDK constructs across multiple levels (L1, L2, and custom L3) to showcase reusable and modular design patterns for demonstration and research purposes.
The architecture is composed of the following stack types:

### Core Stacks

1. **Network Stack**:
   - Contains foundational networking resources such as a shared VPC and a custom EventBus for cross-domain communication.
   - This stack provides the base infrastructure required by all other stacks.

2. **DocumentDB Stack**:
   - Implements a stateful database (MongoDB) to store data for all domains.
     Note: This stack is for demonstration purposes only, as MongoDB setup by CDK would require a paid plan.

3. **Auth Stack**
   - Provides authentication and authorization mechanisms for the application using AWS Cognito.
   - Includes a Cognito User Pool for user management and a Cognito Identity Pool for granting temporary AWS credentials.

### Domain Stacks

Each domain (Accounts, Loans, Transactions, ATM) is designed as an independent, stateless stack that uses the shared infrastructure provided by the core stacks. These stacks include domain-specific Lambda functions, APIs, and integration with the shared EventBus for inter-domain communication.

## AWS CDK

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Build and Test
- `npm run build`   - Compile TypeScript to JavaScript. **Useful to catch syntax and type errors at compile time.**
- `npm run watch`   - Watch for changes and recompile automatically.
- `npm run test`    - Run Jest unit tests.
- `npm run test -- -u` - update snapshorts

### CDK Commands
- `cdk synth`   - Synthesize the CloudFormation templates.
- `cdk diff`    - Compare deployed stacks with the current state.
- `cdk deploy`  - Deploy stacks to your default AWS account/region.
- `cdk destroy` - Remove deployed stacks.
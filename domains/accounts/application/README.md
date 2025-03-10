# Accounts Domain

This stack represents the serverless migration of the original Accounts microservice. The domain is implemented using AWS CDK following the Architecture as Code (AaC) paradigm and event-driven architecture.

## Core Functions

The domain provides the following features:
- Create account: Create a new bank account with initial balance
- Get account details: Retrieve account information by account number
- Get accounts: Get all accounts for a specific email address
- Update balance: Update account balances based on received events

## Event Communication

The domain consumes the following events:
- `TransactionCompleted`: Updates sender and receiver balances after money transferl

## Infrastructure 
- Lambda functions for serverless compute
- DocumentDB for account storage
- Amazon EventBridge for event communication
- API Gateway for REST endpoints

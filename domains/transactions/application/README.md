# Transactions Domain

This stack represents the serverless migration of the original Transactions microservice, implemented using AWS CDK following rchitecture as Code (AaC) paradigm.

## Functionality

The Transactions domain provides the following features:
- Retrieve transaction history for an account (including both sent and received transactions)
- Transfer money between accounts by account number with balance validation
- Transfer money between accounts by email with balance validation

## Event-Driven Integration

When a money transfer is processed successfully, the domain publishes a `TransactionCompleted` event through EventBridge containing:
- Source account number
- Destination account number 
- Transfer amount
- Reason/description

This event is consumed by the Accounts domain to update the balances of both involved accounts accordingly.

### Infrastructure
- AWS Lambda functions for serverless compute
- Amazon EventBridge for event-based communication
- DocumentDB for transaction history storage
- API Gateway for REST endpoints
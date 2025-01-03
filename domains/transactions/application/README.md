# Transactions Domain

This domain represents the serverless migration of the original Transactions microservice, implemented using AWS CDK following Domain-Driven Design (DDD) principles.

## Functionality

The Transactions domain provides the following features:
- Query transaction details by ID
- Retrieve transaction history for an account (including both sent and received transactions)
- Transfer money between accounts with balance validation

## Event-Driven Integration

When a money transfer is processed successfully, the domain publishes a `TransactionCompleted` event through EventBridge containing:
- Source account number
- Destination account number 
- Transfer amount
- Reason/description

This event is consumed by the Accounts domain to update the balances of both involved accounts accordingly.

## Implementation Details

### Infrastructure
- AWS Lambda functions for serverless compute
- Amazon EventBridge for event-based communication
- DocumentDB for transaction history storage
- API Gateway for REST endpoints

### API Endpoints
- `POST /transaction-by-id` - Get transaction details
- `POST /history` - Get account's transaction history  
- `POST /transfer` - Execute money transfer

### Prerequisites
- DocumentDB cluster
- Shared Event Bus
- VPC configuration

### Environment Variables
- `DB_URL` - DocumentDB connection string
- `EVENT_BUS_NAME` - Name of the shared event bus
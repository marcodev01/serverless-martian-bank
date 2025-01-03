# Accounts Domain

This represents the serverless migration of the original Accounts microservice. The domain is implemented using AWS CDK following Domain-Driven Design (DDD) principles and event-driven architecture.

## Core Functions

The domain provides the following features:
- Create account: Create a new bank account with initial balance
- Get account details: Retrieve account information by account number
- Get accounts: Get all accounts for a specific email address
- Update balance: Update account balances based on received events

## Event Communication

The domain consumes the following events:
- `TransactionCompleted`: Updates sender and receiver balances after money transfer
- `LoanGranted`: Updates account balance after loan approval

Events are processed by a dedicated Lambda function that handles balance updates atomically.

## Technical Implementation

### Infrastructure (AWS Services)
- Lambda functions for serverless compute
- DocumentDB for account storage
- EventBridge for event communication
- API Gateway for REST endpoints

### Dependencies
- Requires access to DocumentDB cluster
- Requires shared EventBridge event bus
- Requires VPC configuration for database access

### Database Schema
The domain manages account records in DocumentDB with the following key fields:
- Account number
- Account type
- Name
- Email ID
- Balance
- Currency
- Address
- Government ID details
- Creation timestamp

### Configuration
Required environment variables:
- `DB_URL`: DocumentDB connection string
- `EVENT_BUS_NAME`: Name of the shared event bus
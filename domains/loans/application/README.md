# Loans Domain

This represents the serverless migration of the original Loans microservice. The domain is implemented using AWS CDK following Domain-Driven Design (DDD) principles and event-driven architecture.

## Core Functions

The domain provides the following features:
- Process loan request: Evaluate and process loan applications
- Get loan history: Retrieve loan history for a specific email address

## Event Communication

When a loan is approved, the domain publishes a `LoanGranted` event containing:
- Account number
- Loan amount
- Timestamp

This event is consumed by the Accounts domain to update the account balance with the loan amount.

## Technical Implementation

### Infrastructure (AWS Services)
- Lambda functions for serverless compute
- DocumentDB for loan storage
- EventBridge for event communication
- API Gateway for REST endpoints

### Dependencies
- Requires access to DocumentDB cluster
- Requires shared EventBridge event bus
- Requires VPC configuration for database access

### Database Schema
The domain manages loan records in DocumentDB with the following key fields:
- Loan ID
- Account number
- Loan type
- Loan amount
- Interest rate
- Time period
- Status (pending, approved, failed)
- Applicant details (name, email, government ID)
- Timestamp

### Configuration
Required environment variables:
- `DB_URL`: DocumentDB connection string
- `EVENT_BUS_NAME`: Name of the shared event bus
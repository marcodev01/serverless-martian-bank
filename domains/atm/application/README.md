# ATM Domain
This stack represents the serverless migration of the original ATM Locator microservice. The domain is implemented using AWS CDK following the Architecture as Code (AaC) paradigm.

## Core Functions
The domain provides the following features:
- Get ATM list: Retrieve a filtered list of ATMs with support for:
  - Filter by operational status (isOpenNow)
  - Filter by location type (interPlanetary)
- Get ATM details: Retrieve detailed information for a specific ATM by ID

## Infrastructure
- Lambda function for serverless compute
- API Gateway for REST endpoints
- Static JSON file for ATM data storage



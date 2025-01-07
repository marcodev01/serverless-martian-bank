# ATM Domain
This represents the serverless migration of the original ATM Locator microservice. The domain is implemented using AWS CDK following Domain-Driven Design (DDD) principles and Architecture as Code (AaC) paradigm.

## Core Functions
The domain provides the following features:
- Get ATM list: Retrieve a filtered list of ATMs with support for:
  - Filter by operational status (isOpenNow)
  - Filter by location type (interPlanetary)
- Get ATM details: Retrieve detailed information for a specific ATM by ID

## Technical Implementation
### Infrastructure (AWS Services)
- Lambda function for serverless compute
- API Gateway for REST endpoints
- Static JSON file for ATM data storage
- VPC configuration for future enhancements

### Endpoints
The domain exposes two main endpoints through API Gateway:
- `POST /atm`: Retrieve filtered list of ATMs
  - Request body supports `isOpenNow` and `isInterPlanetary` filters
  - Returns ATM name, coordinates, address, and operational status
- `GET /atm/{id}`: Get specific ATM details
  - Returns coordinates, operating hours, number of ATMs, and status

### Data Schema
The ATM records contain the following key fields:
- Name
- Address (street, city, state, zip)
- Coordinates (latitude, longitude)
- Timings (monFri, satSun, holidays)
- ATM Hours
- Number of ATMs
- Operational Status (isOpen)
- Location Type (interPlanetary)
- Creation/Update timestamps

### Dependencies
- Requires VPC configuration

### Configuration
Architecture implemented following the AaC paradigm using:
- Domain Builder pattern for explicit architecture modeling
- Fluent API for infrastructure definition
- CDK Constructs for AWS resource abstraction

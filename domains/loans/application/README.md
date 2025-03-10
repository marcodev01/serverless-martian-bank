# Loans Domain

This stack represents the serverless migration of the original Loans microservice. The domain is implemented using AWS CDK following the Achitecture as Code (AaC) paradigm and event-driven architecture.

## Core Functions

The domain provides the following features:
- Process loan: Evaluate and process loan applications
- Get loan history: Retrieve loan history for a specific email address

## Workflow

The loan processing workflow is implemented using an AWS Step Functions Express Workflow, ensuring a synchronous execution with minimal latency. The workflow follows the separation of concerns principle and consists of the following steps:

- Retrieve Account Details
   - The workflow starts by invoking a Lambda function that queries the Accounts Domain for the applicant’s account details via an API call.
   - The retrieved account data, including account status and balance, is passed directly to the next step within the workflow.
- Process Loan Application
   - A separate Lambda function evaluates the loan request based on predefined criteria such as credit score, account history, and requested amount.
  - If the loan is approved, the loan details (amount, interest rate, repayment period) are stored in DocumentDB.
  - If the loan is rejected, the workflow immediately returns a rejection response to the client without proceeding further.
- Update Account Balance (Data flow: Step Functions → Accounts Service → Step Functions)
  - If the loan is approved, the workflow directly calls the Accounts Domain via an API request to update the account balance with the loan amount.
  - The updated balance is immediately returned to the workflow for confirmation.
- Finalize and Respond (Data flow: Step Functions → API Gateway → Client)
  - Once all steps are successfully completed, the workflow directly returns the loan approval response along with the updated balance via API Gateway to the requesting client.
  - Since this is a synchronous process, the client waits for the final response before continuing.


## Infrastructure 
- Lambda functions for serverless compute
- DocumentDB for loan storage
- AWS StepFunctions for Workdlow
- API Gateway for REST endpoints
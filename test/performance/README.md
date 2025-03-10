# Load Testing with Locust

## Setup
To run the load tests, you need to create a `.env` file in the same directory where the load test scripts are located. This file configures the endpoints of the services/API gateway:

```
ACCOUNTS_URL=<ACCOUNTS_URL>
TRANSFER_URL=<TRANSFER_URL>
LOAN_URL=<LOAN_URL>
ATM_URL=<ATM_URL>
```

## Running the Load Tests
Once the `.env` file is set up, you can start the Locust UI using the following command:

```
locust -f test/performance/ --class-picker
```

This will launch the Locust UI, where you can configure and execute the load tests.
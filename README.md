# serverless-martian-bank

This project demonstrates a serverless architecture using the Architecture as Code (AaC) paradigm, developed with AWS CDK (TypeScript). 
It is based on the Martian Bank Demo (https://github.com/cisco-open/martian-bank-demo) by Outshift by Cisco and reimagines its microservice architecture in a serverless environment.

## AWS CDK

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

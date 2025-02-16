import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import { Construct } from 'constructs';
import { DomainBuilder } from '../../../lib/constructs/domain-construct/domain-builder';

interface AtmStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

/**
 * The `AtmStack` represents the atm locator domain of the Martian Bank application, following DDD principles by organizing each domain in its own stack.
 *  
 * It is part of the Architecture as Code (AaC) paradigm, using a fluent API to explicitly model the serverless architecture for this domain.
 */
export class AtmStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: AtmStackProps) {
    super(scope, id, props);

    const handlerPath = path.resolve(__dirname, '../application/handlers');

    const atmDomain = new DomainBuilder(this, { domainName: 'atm' })
      .withVpc(props.vpc)
      .addLambda('AtmLocatorFunction', {
        handler: 'atm_locator.handler',
        handlerPath: handlerPath
      })
        .withRuntime(lambda.Runtime.NODEJS_22_X)
        .withMemory(128)
        .exposedVia('/atm', 'POST')
        .exposedVia('/atm/{id}', 'GET')
        .and()
      .withApi({
        name: 'ATM Locator Service',
        description: 'API for ATM location services',
        cors: { 
          allowOrigins: apigateway.Cors.ALL_ORIGINS, 
          allowMethods: apigateway.Cors.ALL_METHODS 
        }
      })
      .build(this, 'AtmDomain');

    // Expose the API Gateway as a public interface for the stack. 
    this.api = atmDomain.api;
    new cdk.CfnOutput(this, 'AtmApiUrlOutput', {
      value: atmDomain.api.url,
      exportName: 'AtmApiUrl'
    });    
  }
}
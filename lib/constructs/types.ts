import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';

export interface ApiConfig {
  name?: string;
  description?: string;
  cors?: { allowOrigins: string[], allowMethods: string[] };
}

export interface ApiRoute {
  path: string;
  method: string;
  handlerName: string;
}

export interface DocumentDbConfig {
  clusterEndpoint: string;
  securityGroupId: string;
}

export interface LambdaLayerConfig {
  layerPath: string;
  compatibleRuntimes: lambda.Runtime[];
  description?: string;
}

export interface LambdaConfig {
  name: string;
  handler: string;
  handlerPath: string;
  runtime?: lambda.Runtime;
  memorySize?: number;
  timeout?: cdk.Duration;
  environment?: { [key: string]: string };
  eventProducer?: boolean;
  eventConsumers?: EventConsumer[];
}

export interface EventConsumer {
  source: string;
  detailType: string;
}

export interface DomainStackProps {
  readonly domainName: string;
  readonly vpc: ec2.IVpc;
  readonly eventBus?: events.EventBus;
  readonly apiConfig?: ApiConfig;
  readonly dbConfig?: DocumentDbConfig;
  readonly lambdaConfigs: LambdaConfig[];
  readonly lambdaLayers: LambdaLayerConfig[];
  readonly apiRoutes: ApiRoute[];
}
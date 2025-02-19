import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import { WorkflowBuilder } from './domain-construct/workflow-builder';

export interface ApiConfig {
  name?: string;
  description?: string;
  cors?: { allowOrigins: string[], allowMethods: string[], allowHeaders: string[] };
}

export interface DocumentDbConfig {
  clusterEndpoint: string;
}

export interface ApiRoute {
  path: string;
  method: string;
  target: string; // Can be either a lambda name or workflow id
  type: 'lambda' | 'workflow';
}

export interface BaseWorkflow<T> { 
  id: string; 
  steps: { 
    name: string; 
    lambda: T; 
  }[] 
};

export interface WorkflowConfig extends BaseWorkflow<string> { 
}

export interface Workflow extends BaseWorkflow<lambda.IFunction> { 
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
  readonly workflowBuilder?: WorkflowBuilder;
  readonly apiRoutes: ApiRoute[];
}
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ServerlessMartianBankStack } from '../lib/serverless-martian-bank-stack';

const app = new cdk.App();
new ServerlessMartianBankStack(app, 'ServerlessMartianBankStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
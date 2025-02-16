import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { MongoDBAtlasStack } from '../../lib/stacks/documentdb-stack'; 

describe('MongoDBAtlasStack', () => {
  let app: cdk.App;
  let stack: MongoDBAtlasStack;
  let template: Template;
  
  beforeEach(() => {
    app = new cdk.App();
    
    // Setze die nötigen Kontextwerte
    app.node.setContext('orgId', 'my-org-id');
    app.node.setContext('profile', 'my-profile');
    app.node.setContext('clusterName', 'my-cluster');
    app.node.setContext('region', 'us-east-1');
    app.node.setContext('ip', '0.0.0.0/0');
    
    stack = new MongoDBAtlasStack(app, 'TestMongoDBAtlasStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    
    template = Template.fromStack(stack);
  });

  test('creates MongoDB Atlas connection string output', () => {
    template.hasOutput('MongoDbAtlasConnectionString', {
      Value: Match.stringLikeRegexp(
        '^mongodb\\+srv://my-cluster:my-profile@my-cluster\\.mongodb\\.net/\\?retryWrites=true&w=majority&appName=my-cluster$'
      )
    });
  });
});

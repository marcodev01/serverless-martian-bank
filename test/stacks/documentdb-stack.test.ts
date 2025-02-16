import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { MongoDBAtlasStack } from '../../lib/stacks/documentdb-stack'; 

describe('MongoDBAtlasStack', () => {
  let app: cdk.App;
  let stack: MongoDBAtlasStack;
  let template: Template;
  
  beforeEach(() => {
    app = new cdk.App();
    
    app.node.setContext('database', {
      username: 'anyname',
      password: 'pw',
      orgId: 'my-org-id',
      clusterName: 'my-cluster',
      clusterid: 'cluster-id',
      appname: 'app-name'
    });
    
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
        '^mongodb\\+srv://anyname:pw@my-cluster\\.cluster-id\\.mongodb\\.net/\\?retryWrites=true&w=majority&appName=app-name$'
      )
    });
  });
});

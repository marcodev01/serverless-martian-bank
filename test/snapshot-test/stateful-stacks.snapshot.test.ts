import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../lib/stacks/auth-stack';
import { NetworkStack } from '../../lib/stacks/network-stack';
import { MongoDBAtlasStack } from '../../lib/stacks/documentdb-stack';

describe('Stateful Stacks Snapshot Tests', () => {
  let app: cdk.App;
  let testStack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    testStack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
  });

  test('AuthStack snapshot', () => {
    const stack = new AuthStack(app, 'TestAuthStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('NetworkStack snapshot', () => {
    const stack = new NetworkStack(app, 'TestNetworkStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('DocumentDBStack snapshot', () => {
    const app = new cdk.App({
      context: {
        database: {
          username: 'anyname',
          password: 'pw',
          orgId: 'my-org-id',
          clusterName: 'my-cluster',
          clusterid: 'cluster-id',
          appname: 'app-name'
        }
      }
    });
  
    const stack = new MongoDBAtlasStack(app, 'TestDocumentDBStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const template = Template.fromStack(stack);
    const json = template.toJSON();
  
    // Normalize dynamic values 
    for (const [logicalId, resource] of Object.entries(json.Resources)) {
      const res = resource as any;
      if (res.Type === 'MongoDB::Atlas::Project') {
        res.Properties.Name = '<atlas-project>';
      }
    }
    
    expect(json).toMatchSnapshot();
  });
});
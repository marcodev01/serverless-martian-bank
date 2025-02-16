import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AtlasBasic } from 'awscdk-resources-mongodbatlas';

export class MongoDBAtlasStack extends cdk.Stack {
  public readonly connectionString: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const atlasProps = this.getContextProps();

    // Create the MongoDB Atlas resources using the AWS CDK L3 construct
    const atlasBasic = new AtlasBasic(this, 'AtlasBasic', {
      clusterProps: {
        name: atlasProps.clusterName,
        replicationSpecs: [
          {
            numShards: 1,
            advancedRegionConfigs: [
              {
                electableSpecs: {
                  instanceSize: 'M0',
                  nodeCount: 1,
                },
                regionName: 'eu_central_1',
              },
            ],
          },
        ],
      },
      projectProps: {
        orgId: atlasProps.orgId,
      },
      ipAccessListProps: {
        accessList: [{ ipAddress: '0.0.0.0/0', comment: 'Allow all IPs' }],
      },
      profile: 'default',
    });

    // The cluster URL is generated as a CDK output
    this.connectionString = `mongodb+srv://${atlasProps.username}:${atlasProps.password}@${atlasProps.clusterName}.${atlasProps.clusterid}.mongodb.net/?retryWrites=true&w=majority&appName=${atlasProps.appname}`;

    // Export the MongoDB connection string for easy usage
    new cdk.CfnOutput(this, 'MongoDbAtlasConnectionString', {
      value: this.connectionString,
      description: 'MongoDB Atlas Connection String',
      exportName: 'MongoDbAtlasConnectionString',
    });
  }

  private getContextProps() {
    const database = this.node.tryGetContext('database');
    if (!database) {
      throw new Error('No database configuration found in context. Please specify via the cdk context.');
    }

    const { username, password, orgId, clusterName, clusterid, appname } = database;

    if (!username) {
      throw new Error('No context value specified for username. Please specify via the cdk context.');
    }
    if (!password) {
      throw new Error('No context value specified for password. Please specify via the cdk context.');
    }
    if (!orgId) {
      throw new Error('No context value specified for orgId. Please specify via the cdk context.');
    }
    if (!clusterName) {
      throw new Error('No context value specified for clusterName. Please specify via the cdk context.');
    }
    if (!clusterid) {
      throw new Error('No context value specified for clusterid. Please specify via the cdk context.');
    }
    if (!appname) {
      throw new Error('No context value specified for appname. Please specify via the cdk context.');
    }

    return { username, password, orgId, clusterName, clusterid, appname };
  }
}

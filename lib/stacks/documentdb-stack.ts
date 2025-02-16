import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AtlasBasic } from 'awscdk-resources-mongodbatlas';

export class MongoDBAtlasStack extends cdk.Stack {
  public readonly connectionString: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const atlasProps = this.getContextProps();

    // Erstelle die MongoDB Atlas-Ressourcen mit dem AWS CDK L3-Konstrukt
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
                regionName: atlasProps.region,
              },
            ],
          },
        ],
      },
      projectProps: {
        orgId: atlasProps.orgId,
      },
      ipAccessListProps: {
        accessList: [{ ipAddress: atlasProps.ip, comment: 'Allow all IPs by: 0.0.0.0/0' }],
      },
      profile: atlasProps.profile,
    });

    // Die Cluster-URL wird als CDK-Ausgabe generiert
    const clusterUrl = `${atlasProps.clusterName}.mongodb.net`;
    this.connectionString = `mongodb+srv://${atlasProps.clusterName}:${atlasProps.profile}@${clusterUrl}/?retryWrites=true&w=majority&appName=${atlasProps.clusterName}`;

    // Exportiere den MongoDB Connection-String für einfache Nutzung
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

    const { orgId, profile, clusterName, region, ip } = database;

    if (!orgId) {
      throw new Error('No context value specified for orgId. Please specify via the cdk context.');
    }
    if (!profile) {
      throw new Error('No context value specified for profile. Please specify via the cdk context.');
    }
    if (!clusterName) {
      throw new Error('No context value specified for clusterName. Please specify via the cdk context.');
    }
    if (!region) {
      throw new Error('No context value specified for region. Please specify via the cdk context.');
    }
    if (!ip) {
      throw new Error('No context value specified for ip. Please specify via the cdk context.');
    }

    return { orgId, profile, clusterName, region, ip };
  }
}

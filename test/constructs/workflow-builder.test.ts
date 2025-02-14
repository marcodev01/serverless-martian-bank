import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WorkflowBuilder } from '../../lib/constructs/domain-construct/workflow-builder';
import { DomainBuilder } from '../../lib/constructs/domain-construct/domain-builder';
import * as lambda from 'aws-cdk-lib/aws-lambda';


describe('WorkflowBuilder', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let domainBuilder: DomainBuilder;
  let template: Template;
  let workflowBuilder: WorkflowBuilder;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    domainBuilder = new DomainBuilder(stack, { domainName: 'TestDomainBuilder' });
    workflowBuilder = new WorkflowBuilder(stack, 'TestWorkflowBuilder', domainBuilder);
  });

  test('creates exactly one Step Functions State Machine after adding a step', () => {
    const lambdaConfig = {
      name: 'TestLambdaStep',
      handler: 'index.handler',
      handlerPath: 'lambda/test',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: { TEST_VAR: 'test' }
    };
    workflowBuilder.addStep('TestStep', lambdaConfig);
    workflowBuilder.build();

    template = Template.fromStack(stack);
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
  });

  test('Step Function contains correct definition with StartAt and States after step addition', () => {
    const lambdaConfig = {
      name: 'TestLambdaStep',
      handler: 'index.handler',
      handlerPath: 'lambda/test',
      runtime: lambda.Runtime.NODEJS_18_X
    };
    workflowBuilder.addStep('TestStep', lambdaConfig);
    workflowBuilder.build(); 

    template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      DefinitionString: {
        'Fn::Join': [
          '',
          Match.arrayWith([
            Match.stringLikeRegexp('.*StartAt.*States.*')
          ])
        ]
      }
    });
  });

  test('Workflow adds lambda step', () => {
    const workflowBuilder = new WorkflowBuilder(stack, 'TestWorkflowBuilder', domainBuilder);
    const lambdaConfig = {
      name: 'TestLambdaStep',
      handler: 'index.handler',
      handlerPath: 'lambda/test',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: { TEST_VAR: 'test' }
    };

    workflowBuilder.addStep('TestStep', lambdaConfig);

    expect((workflowBuilder as any).steps).toHaveLength(1);
    expect((workflowBuilder as any).steps[0].name).toBe('TestStep');
  });

  test('Step Function is linked to an IAM Role after step addition', () => {
    const lambdaConfig = {
      name: 'TestLambdaStep',
      handler: 'index.handler',
      handlerPath: 'lambda/test',
      runtime: lambda.Runtime.NODEJS_18_X
    };
    workflowBuilder.addStep('TestStep', lambdaConfig);
    workflowBuilder.build();

    template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      RoleArn: Match.objectLike({
        'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('.*StateMachineRole.*'), 'Arn'])
      })
    });
  });
});
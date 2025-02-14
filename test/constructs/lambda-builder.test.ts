import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { DomainBuilder } from '../../lib/constructs/domain-construct/domain-builder';
import { LambdaBuilder } from '../../lib/constructs/domain-construct/lambda-builder';
import { LambdaConfig } from '../../lib/constructs/types';

describe('LambdaBuilder', () => {
  let stack: Stack;
  let domainBuilder: DomainBuilder;
  let lambdaConfig: LambdaConfig;

  beforeEach(() => {
    stack = new Stack();
    domainBuilder = new DomainBuilder(stack, { domainName: 'test-domain' });
    lambdaConfig = {
      name: 'TestFunction',
      handler: 'index.handler',
      handlerPath: 'test/mock-lambda',
      environment: {}
    };
    // Register the lambda config in the domain builder
    (domainBuilder as any).lambdaConfigs.set('TestFunction', lambdaConfig);
  });

  test('configures lambda function with all options', () => {
    // Arrange
    const builder = new LambdaBuilder(domainBuilder, lambdaConfig);

    // Act
    builder
      .withRuntime(lambda.Runtime.NODEJS_LATEST)
      .withMemory(512)
      .withTimeout(Duration.seconds(60))
      .withEnvironment({ TEST_VAR: 'test-value' })
      .producesEvents()
      .consumesEvent('test.source', 'TestEvent')
      .exposedVia('/test', 'POST');

    // Assert
    expect(lambdaConfig).toEqual(expect.objectContaining({
      runtime: lambda.Runtime.NODEJS_LATEST,
      memorySize: 512,
      timeout: Duration.seconds(60),
      environment: { TEST_VAR: 'test-value' },
      eventProducer: true,
      eventConsumers: [{
        source: 'test.source',
        detailType: 'TestEvent'
      }]
    }));

    // Verify API route was added
    expect((domainBuilder as any).apiRoutes).toContainEqual({
      path: '/test',
      method: 'POST',
      target: 'TestFunction',
      type: 'lambda'
    });
  });

  test('returns domain builder with and() method', () => {
    // Arrange
    const builder = new LambdaBuilder(domainBuilder, lambdaConfig);

    // Act
    const result = builder.and();

    // Assert
    expect(result).toBe(domainBuilder);
  });

  test('accumulates environment variables', () => {
    // Arrange
    const builder = new LambdaBuilder(domainBuilder, lambdaConfig);

    // Act
    builder
      .withEnvironment({ VAR1: 'value1' })
      .withEnvironment({ VAR2: 'value2' });

    // Assert
    expect(lambdaConfig.environment).toEqual({
      VAR1: 'value1',
      VAR2: 'value2'
    });
  });

  test('handles multiple event consumers', () => {
    // Arrange
    const builder = new LambdaBuilder(domainBuilder, lambdaConfig);

    // Act
    builder
      .consumesEvent('source1', 'Event1')
      .consumesEvent('source2', 'Event2');

    // Assert
    expect(lambdaConfig.eventConsumers).toEqual([
      { source: 'source1', detailType: 'Event1' },
      { source: 'source2', detailType: 'Event2' }
    ]);
  });

  test('correctly sets event producer flag', () => {
    // Arrange
    const builder = new LambdaBuilder(domainBuilder, lambdaConfig);

    // Act
    builder.producesEvents();

    // Assert
    expect(lambdaConfig.eventProducer).toBe(true);
  });
});
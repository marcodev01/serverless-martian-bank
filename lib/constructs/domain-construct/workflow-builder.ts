import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { DomainBuilder } from './domain-builder';
import { LambdaBuilder } from './lambda-builder';

/**
 * The `WorkflowBuilder` class provides a fluent API for constructing AWS Step Functions workflows 
 * where each step is represented by an AWS Lambda function.
 * 
 * It is used in conjunction with the `DomainBuilder` to define serverless workflows, enabling 
 * the execution of multiple Lambda functions in a structured, sequential manner.
 */
export class WorkflowBuilder {
    private readonly scope: Construct;
    private readonly id: string;
    private readonly domainBuilder: DomainBuilder;
    private steps: {
        name: string,
        lambdaBuilder: LambdaBuilder,
        inputPath?: string
    }[] = [];

    constructor(scope: Construct, id: string, domainBuilder: DomainBuilder) {
        this.scope = scope;
        this.id = id;
        this.domainBuilder = domainBuilder;
    }

    /**
     * Checks if a step with the given name already exists in the workflow.
     * @param stepName The name of the step.
     * @returns `true` if the step exists, otherwise `false`.
     */
    hasStep(stepName: string): boolean {
        return this.steps.some(step => step.name === stepName);
    }

    /**
     * Checks whether at least one step has been added to the workflow.
     * @returns `true` if the workflow contains steps, otherwise `false`.
     */
    hasSteps(): boolean {
        return this.steps.length > 0;
    }

    /**
     * Adds a new step to the workflow. Each step corresponds to a Lambda function.
     * @param name The name of the workflow step.
     * @param config Configuration containing the Lambda handler and handler path.
     * @param configureBuilder (Optional) A function to further customize the Lambda configuration.
     * @returns The current `WorkflowBuilder` instance for method chaining.
     * @throws Error if a step with the given name already exists.
     */
    addStep(name: string, config: { handler: string, handlerPath: string, inputPath?: string; }, configureBuilder?: (builder: LambdaBuilder) => LambdaBuilder): this {
        if (this.hasStep(name)) {
            throw new Error(`Step "${name}" already exists in workflow`);
        }

        const lambdaName = `${name}StepFunction`;
       
        const baseBuilder = this.domainBuilder.addLambda(lambdaName, { handler: config.handler, handlerPath: config.handlerPath });
        const lambdaBuilder = configureBuilder ? configureBuilder(baseBuilder) : baseBuilder;

        this.steps.push({
            name,
            lambdaBuilder: lambdaBuilder,
            inputPath: config.inputPath
        });

        return this;
    }

    /**
     * Exposes the workflow via an API Gateway route.
     * This allows external clients to trigger the workflow execution via an HTTP request.
     * @param path The API route path (e.g., `/workflow/start`).
     * @param method The HTTP method for triggering the workflow (e.g., `POST`).
     * @returns The current `WorkflowBuilder` instance for method chaining.
     */
    exposedVia(path: string, method: string): this {
        this.domainBuilder.addApiRoute({
            path,
            method,
            target: this.id,
            type: 'workflow'
        });
        return this;
    }

    /**
     * Finalizes the configuration of the workflow steps and returns to the parent `DomainBuilder`.
     * This method ensures that all Lambda function configurations are properly registered.
     * @returns The `DomainBuilder` instance.
     */
    and(): DomainBuilder {
        this.steps.forEach(step => {
            step.lambdaBuilder.and();
        });
        return this.domainBuilder;
    }

    /**
     * Builds the AWS Step Functions state machine based on the defined workflow steps.
     * @returns The constructed Step Functions state machine.
     * @throws Error if no steps have been added before building the workflow.
     */
    build(): sfn.StateMachine {
        if (this.steps.length === 0) {
            throw new Error("At least one step must be added before building the workflow.");
        }
    
        // Convert steps to tasks with explicit typing
        const workflowTasks: tasks.LambdaInvoke[] = this.steps.map((step) => {
            return new tasks.LambdaInvoke(this.scope, step.name, {
                lambdaFunction: lambda.Function.fromFunctionName(
                    this.scope,
                    `${step.name}Ref`,
                    `${step.name}StepFunction`
                ),
                payloadResponseOnly: true,
                ...(step.inputPath ? { inputPath: step.inputPath } : {})
            });
        });
    
        // Define the workflow execution sequence
        let chain = sfn.Chain.start(workflowTasks[0]);
        // Chain the remaining steps sequentially
        for (let i = 1; i < workflowTasks.length; i++) {
            chain = chain.next(workflowTasks[i]);
        }
    
        // Create the Step Functions state machine with the chain
        return new sfn.StateMachine(this.scope, `${this.id}StateMachine`, {
            definitionBody: sfn.DefinitionBody.fromChainable(chain)
        });
    }
}

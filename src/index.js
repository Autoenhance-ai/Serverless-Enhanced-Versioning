class Plugin {
    constructor(serverless) {

        this.serverless = serverless;
        this.service = this.serverless.service
        this.provider = serverless.getProvider('aws');
        this.naming = this.provider.naming
    	
        this.commands = {
            'demote': {
                lifecycleEvents: ['run'],
            },
            'promote': {
                lifecycleEvents: ['run'],
            },
        };

        this.hooks = {
            "after:aws:package:finalize:mergeCustomProviderResources": this.generateResources.bind(this),
            "demote:run": this.demote.bind(this),
            "promote:run": this.promote.bind(this),
        };
    }

    get functions() {
        return this.serverless.service.getAllFunctions()
    }

    get compiledTpl () {
        return this.service.provider.compiledCloudFormationTemplate
    }

    async demote() {

        this.serverless.cli.log("Demoting to previous version...", "versioning");

        for (var functionName of this.functions) {

            const functionObject = this.serverless.service.getFunction(functionName);
            const aliasName = "Latest"

            const currentAlias =  await this.provider.request('Lambda', 'getAlias', {
                FunctionName: functionObject.name,
                Name: aliasName
            })
            .catch((error) => {
                console.error(error)
            });

            // TODO: handle running against already demoted config or a promoted config or no rotuing config
            //
            var newWeights = {}

            for (var version in currentAlias?.RoutingConfig?.AdditionalVersionWeights ?? {}) {
                newWeights[version] = 0;
            }

            // TODO: Can we use Logical ID ? 
            //
            await this.provider.request('Lambda', 'updateAlias', {
                FunctionName: functionObject.name,
                Name: aliasName,
                RoutingConfig: {
                    AdditionalVersionWeights: newWeights
                }
            })
        }
    }

    async promote() {

        this.serverless.cli.log("Promoting to latest version...", "versioning");

        for (var functionName of this.functions) {

            const functionObject = this.serverless.service.getFunction(functionName);
            const aliasName = "Latest"

            const currentAlias =  await this.provider.request('Lambda', 'getAlias', {
                FunctionName: functionObject.name,
                Name: aliasName
            })
            .catch((error) => {
                console.error(error)
            });

            // TODO: handle running against already demoted config or a promoted config or no rotuing config
            //
            const newVersion = Object.keys(currentAlias?.RoutingConfig?.AdditionalVersionWeights ?? {})[0]

            if (!newVersion) {
                continue
            }

            await this.provider.request('Lambda', 'updateAlias', {
                FunctionName: functionObject.name,
                FunctionVersion: newVersion,
                Name: aliasName,
                RoutingConfig: {}
            })
        }
    }

    async generateResources() {

        if (!this.service.provider.versionFunctions) {
            throw Error("Versioning plugin cannot be used when versionFunctions is set to false.")
        }

        const Resources = this.compiledTpl.Resources

        this.serverless.cli.log("Generating Versions...", "versioning");

        for (var functionName of this.functions) {

            const functionObject = this.serverless.service.getFunction(functionName);
            const functionLogicalId = this.naming.getLambdaLogicalId(functionName)
            const aliasName = "Latest"

            let aliasLogicalId = Object.keys(this.compiledTpl.Resources).find((key) => {
                const resource = this.compiledTpl.Resources[key];
                if (resource.Type !== 'AWS::Lambda::Alias') return false;
                return resource.Properties?.FunctionName?.Ref === functionLogicalId;
            });

            const currentAlias = await this.provider.request('Lambda', 'getAlias', {
                FunctionName: functionObject.name,
                Name: aliasName
            })
            .catch((error) => {
                if (error.message.match(/Cannot find /)) {
                  return null
                }

                // TODO: Build a nice Serverless Error
                //
                throw error
            });

            let provisionedConcurrencyVersion = null;

            if (aliasLogicalId) {
                provisionedConcurrencyVersion = Resources[aliasLogicalId];
                delete Resources[aliasLogicalId];
            }

            aliasLogicalId = `${functionLogicalId}AliasLatest`;
            functionObject.targetAlias = { name: aliasName, logicalId: aliasLogicalId };

            // const currentCodeSha = currentAlias?.FunctionVersion

            this.serverless.cli.log("Generating Versions...", JSON.stringify(currentAlias));
            this.serverless.cli.log("Generating Versions...", JSON.stringify(functionObject));

            // {
            //     "Concurrency": {
            //         "ReservedConcurrentExecutions": 100
            //     },
            //     "Code": {
            //         "RepositoryType": "S3",
            //         "Location": "https://awslambda-us-west-2-tasks.s3.us-west-2.amazonaws.com/snapshots/123456789012/my-function..."
            //     },
            //     "Configuration": {
            //         "TracingConfig": {
            //             "Mode": "PassThrough"
            //         },
            //         "Version": "$LATEST",
            //         "CodeSha256": "5tT2qgzYUHoqwR616pZ2dpkn/0J1FrzJmlKidWaaCgk=",
            //         "FunctionName": "my-function",
            //         "VpcConfig": {
            //             "SubnetIds": [],
            //             "VpcId": "",
            //             "SecurityGroupIds": []
            //         },
            //         "MemorySize": 128,
            //         "RevisionId": "28f0fb31-5c5c-43d3-8955-03e76c5c1075",
            //         "CodeSize": 304,
            //         "FunctionArn": "arn:aws:lambda:us-west-2:123456789012:function:my-function",
            //         "Handler": "index.handler",
            //         "Role": "arn:aws:iam::123456789012:role/service-role/helloWorldPython-role-uy3l9qyq",
            //         "Timeout": 3,
            //         "LastModified": "2019-09-24T18:20:35.054+0000",
            //         "Runtime": "nodejs10.x",
            //         "Description": ""
            //     }
            // }

            const currentAlias = await this.provider.request('Lambda', 'getAlias', {
                FunctionName: functionObject.name,
                Name: aliasName
            })
            .catch((error) => {
                if (error.message.match(/Cannot find /)) {
                  return null
                }

                // TODO: Build a nice Serverless Error
                //
                throw error
            });

{
  AliasArn: 'arn:aws:lambda:eu-west-1:694064703852:function:ai-prod-warmup-plugin-warmer:Latest',
  Name: 'Latest',
  FunctionVersion: '1',
  Description: 'The latest version',
  RevisionId: 'c17e5609-f7e3-464f-877a-563cadb89f98'
}
WarmUpPluginWarmerLambdaVersionEKjorMGyRCuswKvqbYOS06cimhbW4lPDD2cszz17Tx4

            Resources[aliasLogicalId] = {
                "Type" : "AWS::Lambda::Alias",
                "Properties" : {
                    "Description" : `The latest version`,
                    "FunctionName" : { Ref: functionLogicalId },
                    "FunctionVersion" : currentAlias?.FunctionVersion ??  {
                        "Fn::GetAtt": [ functionObject.versionLogicalId, "Version" ]
                    },
                    "Name": aliasName,
                    "ProvisionedConcurrencyConfig": provisionedConcurrencyVersion?.Properties.ProvisionedConcurrencyConfig,
                    "RoutingConfig" : currentAlias ? {
                        "AdditionalVersionWeights": [{
                            "FunctionVersion" : {
                                "Fn::GetAtt": [ functionObject.versionLogicalId, "Version" ]
                            },
                            "FunctionWeight" : 0.5 
                        }]
                    } : null
                },
                DependsOn: functionLogicalId,
            }
        }
    }
}

module.exports = Plugin
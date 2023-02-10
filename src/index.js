class Plugin {
    // TODO: Document and tidy-up
    //
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

            // TODO: handle running against already demoted config or a promoted config or no routing config
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

            // TODO: handle running against already demoted config or a promoted config or no routing config
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

            this.serverless.cli.log(`Generating Version for ${functionName}...`, "versioning");

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

            const currentFunction = currentAlias ? await this.provider.request('Lambda', 'getFunction', {
                FunctionName: functionObject.name, 
                FunctionVersion: currentAlias.FunctionVersion
            })
            .catch((error) => {
                if (error.message.match(/Cannot find /)) {
                    return null
                  }
  
                  // TODO: Build a nice Serverless Error
                  //
                  throw error
            }) : null;

            // Only use routing config if we are in a situation where AWS can create it.
            //
            const version = Resources[functionObject.versionLogicalId]
            const useRouteConfig = currentAlias !== null && currentFunction && currentFunction.Configuration.CodeSha256 !== version.Properties.CodeSha256

            this.serverless.cli.log(`Current Code Hash: ${currentFunction?.Configuration.CodeSha256}`, "versioning");
            this.serverless.cli.log(`New Code Hash: ${version.Properties.CodeSha256}`, "versioning");

            if (!useRouteConfig) {
                this.serverless.cli.log(`Skipping set up of traffic splitting...`, "versioning");
            }

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
                    "RoutingConfig" : useRouteConfig ? {
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
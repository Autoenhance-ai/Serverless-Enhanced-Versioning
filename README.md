# Serverless Enhanced Versioning

This plugin extends the versioning support in Serverless, the goal is to add support for custom version names and
traffic shifting between version. But the goal is with this plugin is to allow for projects to incrementally adopt
features or to be simple by not implementing selected features.

This plugin requires versioning to be enabled for serverless.

Note: This plugin is not production ready and is in constnat development.

Configuration:

serverless.yml

```
custom:
    versioning:
        latestAliasName: "Latest" // The name of the alias that is created which always points to your latest Lambda, default: "Latest"
        versionName: "1.0" // If set - the name of the alias which will point to the version of the lambda function to be deployed, default: null
```

When deploying 50% of your traffic will automatically go to the new version. Run `sls demote` to revert ot the old veraion or `sls promote` to move to the new version.

When deploying for the first time without any aliases we will shift all traffic to the new version.

## Roadmap

- Add support to Code Deploy for incremental traffice shifting
- Add support to disable/enable canary deployment
- Resolve TODOs
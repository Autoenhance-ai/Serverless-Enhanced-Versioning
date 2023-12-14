# Serverless Enhanced Versioning

This plugin extends the versioning support in Serverless. The goal is to allow customers ways to version and 
control the rollout of new versions of their code.

When deploying 50% of your traffic will automatically go to the new version. Run `sls demote` to revert ot the old veraion or `sls promote` to move to the new version.

When deploying for the first time without any aliases we will shift all traffic to the new version.

## Roadmap

- Add support to Code Deploy for incremental traffice shifting
- Add support to disable/enable canary deployment
- Add support for creating an alias per deploy
- Resolve TODOs
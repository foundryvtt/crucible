# Contributing to the Crucible Game System
Code contributions to `foundryvtt/crucible` are accepted subject to the following conditions and expectations.

## License and Property Rights
Crucible game system code is not currently offered under a traditional open-source license. Please read the [LICENSE](LICENSE) file and make sure you understand its terms. 

By making a pull request to this repository, you agree that contributed code becomes property of Foundry Gaming LLC
and that you retain no property rights over that contributed code aside from those granted in the Crucible game system
license.

## Contribution Process
Contributions must follow a defined process.

1. A GitHub issue must be created documenting the proposed change in sufficient detail that it can be reviewed by a member of our team.
2. You may be asked to iterate on the scoping of this issue before it is approved for development. Do not start work on a PR until the issue has been marked as ready for work.
3. Issues which are acceptable to be worked on by a member of the community are assigned the `pr:available` label, indicating that they are available to be worked on by interested contributors.
4. If you begin work on an issue, please leave a comment in that issue mentioning that you are working on it so others know not to duplicate effort.

## Out of Bounds Areas
Changes of the following type are *not* currently supported for contributions.

- Introduction of entirely new game system rules. Refinement of existing rules is possible, but the addition of new rules components is exclusive to our internal team.
- Contribution of game content (Talents, Items, Archetypes, etc...). The design of game content is currently exclusive to our internal team.
- Substantial refactors to code structure or functionality. These may be suggested, but the development of such comprehensive changes is exclusive to our internal team.
- Localization to languages other than English. Eventually, this may be a goal, but for now the system is changing too rapidly for this to be productive.
- Adoption of Typescript.

## Local Development Environment
It is expected that contributors to the Crucible game system are already minimally familiar with the process for game system development in Foundry Virtual Tabletop. This is not a good choice of project to contribute to as a learning process.

Abbreviated instructions for setting up a local development environment for Crucible are:
```sh
cd {FOUNDRY_VTT_DATA_DIR}/systems
git clone https://github.com/foundryvtt/crucible.git
cd crucible
npm install
npm run compile
```

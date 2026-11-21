# Contributing to the Crucible Game System
Code and translation contributions to `foundryvtt/crucible` are accepted subject to the following conditions and
expectations.

## License and Property Rights
Crucible game system code is not currently offered under a traditional open-source license. Please read the 
[LICENSE](LICENSE) file and make sure you understand its terms.

By making a pull request to this repository, you agree that your contribution, including any code, text, or
translation, becomes property of Foundry Gaming LLC and that you retain no property rights over it aside from those
granted in the Crucible game system license. If that transfer is not legally effective, you instead grant Foundry
Gaming LLC a perpetual, irrevocable, worldwide, royalty-free license to use, modify, distribute, and relicense your
contribution under any terms.

## Ideas and Feedback
Foundry Gaming LLC may freely use any suggestions, ideas, or feedback you share in issues, discussions, or other
community spaces, with no obligation to you.

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
- Adoption of Typescript.

## AI Usage
AI tools may be used to assist with contributions, provided that use complies with the
[Foundry VTT AI Content Policy](https://foundryvtt.com/article/ai-policy/). Every pull request must have a human author
who takes responsibility for it and can understand, explain, and maintain every change it makes. Pull requests or
commits authored by an AI agent, such as Claude, ChatGPT, or Gemini, will be rejected.

All translated text, however it was produced, must be reviewed by a fluent human speaker of the target language before
it is submitted.

## Local Development Environment
It is expected that contributors to the Crucible game system are already minimally familiar with the process for game 
system development in Foundry Virtual Tabletop. This is not a good choice of project to contribute to as a learning 
process.

Abbreviated instructions for setting up a local development environment for Crucible are:
```sh
cd {FOUNDRY_VTT_DATA_DIR}/systems
git clone https://github.com/foundryvtt/crucible.git
cd crucible
npm install
npm run build
```

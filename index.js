const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

const validEvent = ['pull_request'];

function validateTitle(title) 
{
    return title.startsWith("major:") || title.startsWith("minor:") || title.startsWith("patch:");
}

async function run() 
{
    {
        try
        {
            const authToken = core.getInput('github_token', {required: true})
            const eventName = github.context.eventName;

            core.info(`Event name: ${eventName}, token: ${authToken}`);

            const owner = github.context.payload.pull_request.base.user.login;
            const repo = github.context.payload.pull_request.base.repo.name;

            const client = new github.getOctokit(authToken);
            // The pull request info on the context isn't up to date. When
            // the user updates the title and re-runs the workflow, it would
            // be outdated. Therefore fetch the pull request via the REST API
            // to ensure we use the current title.
            const {data: pullRequest} = await client.rest.pulls.get({
                owner,
                repo,
                pull_number: github.context.payload.pull_request.number
            });

            const title = pullRequest.title;

            core.info(`Pull Request title: "${title}"`);

            if (validateTitle(title))
            {
                core.info("Title was validated");

                let content = await fs.promises.readFile("ProjectSettings/ProjectSettings.asset", "utf8");

                let versionStart = content.indexOf("bundleVersion:") + ("bundleVersion:").length + 1;
                let versionEnd = content.indexOf("\n", versionStart);

                let version = content.substring(versionStart, versionEnd);

                core.info("Current version is " + version);
            }
            else
            {
                core.setFailed("The title of the PR should look like this: '[major|minor|patch]: Your title here...'");
            }
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();
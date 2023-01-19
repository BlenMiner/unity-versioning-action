const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('cross-fetch');

const endpoit = "https://build-api.cloud.unity3d.com/api/v1/orgs/20066711958695";

async function InitProject(cloudToken, repoName, repoSSHUrl)
{
    let url = `${endpoit}/projects`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        },
        body: JSON.stringify({
            name: repoName,
            disabled: false,
            disableNotifications: true,
            generateShareLinks: true,
            settings: {
                remoteCacheStrategy: "library",
                scm: {
                    type: "git",
                    url: repoSSHUrl
                }
            }
        })
    });

    let json = await response.json();
}

async function RebuildLauncher(cloudToken, prod) 
{
    let url = `${endpoit}/projects/ig-launcher${prod ? "-prod" : ""}/buildtargets/_all/builds`;

    await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        },
        body: JSON.stringify({
            clean: false,
            delay: 0
        })
    });
}

async function run()
{
    {
        try
        {
            const cloudToken = core.getInput('token', {required: true});
            const mode = core.getInput('mode', {required: false});

            await InitProject(
                cloudToken,
                github.context.payload.repository.name,
                github.context.payload.repository.ssh_url
            );

            /*if (mode == "Init")
            {
                await InitProject(
                    github.context.payload.repository.name,
                    github.context.payload.repository.ssh_url
                );
            }
            else
            {
                await RebuildLauncher(
                    cloudToken, 
                    github.context.payload.ref === "refs/heads/prod"
                );
            }*/
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();

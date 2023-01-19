const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('cross-fetch');

const endpoit = "https://build-api.cloud.unity3d.com/api/v1/api.json";

async function run()
{
    {
        try
        {
            const cloudToken = core.getInput('token', {required: true});

            let url = `${endpoit}/orgs/20066711958695/projects/${github.context.repo.repo}/buildtargets/_all/builds`;
            
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${cloudToken}`
                },
            });

            let json = await response.json();

            core.info(url);
            core.info(JSON.stringify(json));
            core.info(github);
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();
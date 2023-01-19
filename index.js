const core = require('@actions/core');
const github = require('@actions/github');

const endpoit = "https://build-api.cloud.unity3d.com/api/v1/api.json";

async function run()
{
    {
        try
        {
            const cloudToken = core.getInput('token', {required: true});

            let url = `${endpoit}/orgs/{orgid}/projects/${github.context.repo.repo}/buildtargets/${_all}/builds`;
            
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${cloudToken}`
                },
            });

            let json = await response.json();

            console.log(json);
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();
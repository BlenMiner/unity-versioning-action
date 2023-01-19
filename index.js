const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('cross-fetch');

const endpoit = "https://build-api.cloud.unity3d.com/api/v1/orgs/20066711958695";

async function SetEnvVariables(cloudToken, projectId, buildtargetid, vars)
{
    let url = `${endpoit}/projects/${projectId}/buildtargets/${buildtargetid}/envvars`;
    await fetch(url, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        },
        body: JSON.stringify(vars)
    });
}

async function CreateBuildTarget(cloudToken, projectId, branch, name)
{
    let url = `${endpoit}/projects/${projectId}/buildtargets`;
    let response = await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        },
        body: JSON.stringify({
            name: name,
            platform: name,
            enabled: true,
            settings:
            {
                autoBuild: true,
                autoDetectUnityVersion: true,
                fallbackPatchVersion: true,
                executablename: "Internet-Game",
                scm: {
                    type: "git",
                    branch: branch
                },
                platform: {
                    bundleId: "com.internetgame.launcher",
                    xcodeVersion: "latest"
                },
                buildSchedule: {
                    isEnabled: false
                },
                autoBuildCancellation : true,
                operatingSystemSelected: "mac",
                advanced: {
                    unity: {
                        preExportMethod: "",
                        postExportMethod: "",
                        scriptingDefineSymbols: "",
                        playerExporter: {
                            export: false
                        },
                        addressables: {
                            buildAddressables: true,
                            contentUpdate: false,
                            profileName: "Default",
                            failedAddressablesFailsBuild: true
                        },
                        runUnitTests: false,
                        runEditModeTests: false,
                        runPlayModeTests: false,
                        failedUnitTestFailsBuild: false,
                        enableLightBake: false
                    }
                }
            }
        })
    });

    let json = await response.json();
    const buildtargetid = json.buildtargetid;

    await SetEnvVariables(cloudToken, projectId, buildtargetid, {
        KEY: core.getInput('S3_KEY', {required: true}),
        SECRET: core.getInput('S3_SECRET', {required: true}),
        BUCKET: core.getInput('S3_BUCKET', {required: true}),
        REGION: core.getInput('S3_REGION', {required: true}),
    });
}

async function InitProject(cloudToken, repoName, repoSSHUrl)
{
    try
    {
        const projectId = await CreateProject(cloudToken, repoName, repoSSHUrl);

        await CreateBuildTarget(cloudToken, projectId, "dev", "standalonewindows64");
        await CreateBuildTarget(cloudToken, projectId, "dev", "standaloneosxuniversal");
        await CreateBuildTarget(cloudToken, projectId, "dev", "standalonelinux64");

        await CreateBuildTarget(cloudToken, projectId, "staging", "standalonewindows64");
        await CreateBuildTarget(cloudToken, projectId, "staging", "standaloneosxuniversal");
        await CreateBuildTarget(cloudToken, rojectId, "staging", "standalonelinux64");

        await CreateBuildTarget(cloudToken, projectId, "prod", "standalonewindows64");
        await CreateBuildTarget(cloudToken, projectId, "prod", "standaloneosxuniversal");
        await CreateBuildTarget(cloudToken, projectId, "prod", "standalonelinux64");
    }
    catch (error) { core.setFailed(error.message); }
}

async function GetProjectSSHKey(projectId, cloudToken, repoName, repoSSHUrl) {
    let url = `${endpoit}/projects/${projectId}/sshkey`;

    let response = await fetch(url, {
        method: "GET",
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
    const publicSSHKey = json.publickey;
    return publicSSHKey;
}

async function CreateProject(cloudToken, repoName, repoSSHUrl) {
    let url = `${endpoit}/projects`;
    let response = await fetch(url, {
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
    const projectId = json.projectid;
    return projectId;
}

async function RebuildLauncher(cloudToken) 
{
    let url = `${endpoit}/projects/ig-launcher/buildtargets/_all/builds`;

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
            
            if (mode == "Init")
            {
                await InitProject(
                    cloudToken,
                    github.context.payload.repository.name,
                    github.context.payload.repository.ssh_url
                );
            }
            else
            {
                await RebuildLauncher(cloudToken);
            }
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();

const core = require('@actions/core');
const github = require('@actions/github');
const { GitHub } = require('@actions/github/lib/utils');
const fetch = require('cross-fetch');

const endpoit = "https://build-api.cloud.unity3d.com/api/v1/orgs/will_ig";

async function GetProjectIdByName(cloudToken, projectName)
{
    let url = `${endpoit}/projects`;
    let res = await fetch(url, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        }
    });

    let json = await res.json();

    for(let i = 0; i < json.length; ++i)
    {
        if (json[i].name == projectName) return json[i].guid;
    }
    return undefined;
}

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

async function DeleteAllBuildTargets(cloudToken, projectId)
{
    let url = `${endpoit}/projects/${projectId}/buildtargets`;
    let res = await fetch(url, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        }
    });

    let json = await res.json();
    for(let i = 0; i < json.length; ++i)
    {
        await fetch(`${endpoit}/projects/${projectId}/buildtargets/${json[i].buildtargetid}`, {
            method: "DELETE",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${cloudToken}`
            }
        });

        core.notice("Deleting " + json[i].name);
    }
}

async function CreateBuildTarget(cloudToken, projectId, branch, name)
{
    core.notice("Creating " + name + "-" + branch);

    let url = `${endpoit}/projects/${projectId}/buildtargets`;
    let response = await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        },
        body: JSON.stringify({
            name: name + "-" + branch,
            platform: name,
            enabled: true,
            settings:
            {
                autoBuild: false,
                unityVersion: "latest2021_3",
                autoDetectUnityVersion: true,
                fallbackPatchVersion: true,
                executablename: "Internet-Game",
                "ccdEnabled": false,
                "ccdBucketId": "",
                "ccdApiKey": "c5643e4b0ca994341f626f2b24e8bd8c",
                "ccdStripRemotePath": false,
                "ccdPreserveBucket": false,
                "ccdCreateRelease": false,
                scm: {
                    type: "oauth",
                    branch: branch
                },
                platform: {},
                buildSchedule: {
                    isEnabled: false,
                    "date": "2023-01-20T11:11:07.928Z",
                    "repeatCycle": "once",
                    "cleanBuild": false
                },
                autoBuildCancellation : branch.toUpperCase() != "PROD",
                operatingSystemSelected: "mac",
                "rubyVersion": "ruby_version_2_7_4",
                advanced: {
                    unity: {
                        preExportMethod: "AddressableHelper.PreBuildAddressables",
                        postExportMethod: "AddressableHelper.PostBuildAddressables",
                        "preBuildScript": "",
                        "postBuildScript": "",
                        "preBuildScriptFailsBuild": false,
                        "postBuildScriptFailsBuild": false,
                        scriptingDefineSymbols: branch.toUpperCase(),
                        playerExporter: {
                            "sceneList": [],
                            export: false,
                            buildOptions: [
                                "CompressWithLz4HC"
                            ],
                        },
                        "assetBundles": {
                            "buildBundles": false,
                            "basePath": "",
                            "buildAssetBundleOptions": "",
                            "copyToStreamingAssets": false,
                            "copyBundlePatterns": [],
                            "uploadAssetBundles": false
                        },
                        addressables: {
                            buildAddressables: true,
                            "uploadAddressables": false,
                            contentUpdate: false,
                            profileName: "",
                            failedAddressablesFailsBuild: true,
                            "contentUpdateSettings": {
                                "contentStatePath": "",
                                "linkedTargetId": ""
                            }
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
    let buildtargetid = json.buildtargetid;

    if (buildtargetid == null || buildtargetid == undefined)
        buildtargetid = name;

    await SetEnvVariables(cloudToken, projectId, buildtargetid, {
        KEY:    core.getInput('S3_KEY', {required: true}),
        SECRET: core.getInput('S3_SECRET', {required: true}),
        BUCKET: core.getInput('S3_BUCKET', {required: true}),
        REGION: core.getInput('S3_REGION', {required: true}),
    });
}

async function InitProject(cloudToken, repoName, repoSSHUrl)
{
    try
    {
        let projectId = await CreateProject(cloudToken, repoName, repoSSHUrl);

        if (projectId == null || projectId == undefined)
            projectId = repoName;

        await DeleteAllBuildTargets(cloudToken, projectId);

        await CreateBuildTarget(cloudToken, projectId, "dev", "standalonewindows64");
        await CreateBuildTarget(cloudToken, projectId, "dev", "standaloneosxuniversal");
        await CreateBuildTarget(cloudToken, projectId, "dev", "standalonelinux64");

        await CreateBuildTarget(cloudToken, projectId, "staging", "standalonewindows64");
        await CreateBuildTarget(cloudToken, projectId, "staging", "standaloneosxuniversal");
        await CreateBuildTarget(cloudToken, projectId, "staging", "standalonelinux64");

        await CreateBuildTarget(cloudToken, projectId, "prod", "standalonewindows64");
        await CreateBuildTarget(cloudToken, projectId, "prod", "standaloneosxuniversal");
        await CreateBuildTarget(cloudToken, projectId, "prod", "standalonelinux64");
    }
    catch (error) { core.setFailed(error.message); }
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
                    type: "oauth",
                    url: repoSSHUrl,
                    useEncryption: false,
                    oauth: {
                        scm_provider: "github",
                        github: {
                            repository: {
                                owner: {
                                    "avatar_url": "https://avatars.githubusercontent.com/u/103954087?v=4",
                                    "login": "Internet-Game"
                                },
                                clone_url: `https://github.com/Internet-Game/${repoName}.git`,
                                forks: 0,
                                full_name: "Internet-Game/" + repoName,
                                name: repoName,
                                scm: "git",
                                provider_id: "588266512"
                            }
                        }
                    }
                }
            }
        })
    });

    let json = await response.json();

    if (json.guid === undefined)
    {
        return GetProjectIdByName(cloudToken, repoName);
    }
    else
    {
        return json.guid;
    }
}

async function RebuildLauncher(cloudToken, branch) 
{
    await Rebuild(cloudToken, "ig-launcher", branch);
}

async function Rebuild(cloudToken, projectId, branch) 
{
    const pid = await GetProjectIdByName(cloudToken, projectId);

    let url = `${endpoit}/projects/${pid}/buildtargets`;
    let res = await fetch(url, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${cloudToken}`
        }
    });

    let json = await res.json();
    for(let i = 0; i < json.length; ++i)
    {
        if (json[i].name.endsWith(branch))
        {
            core.notice("Trigger build for: " + json[i].name);

            await fetch(`${endpoit}/projects/${pid}/buildtargets/${json[i].buildtargetid}/builds`, {
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
    }
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
            else if (mode == "Trigger")
            {
                const branch = github.context.ref.substring("refs/heads/".length);
                await Rebuild(cloudToken, github.context.payload.repository.name, branch);
            }
            else
            {
                const branch = github.context.ref.substring("refs/heads/".length);
                await RebuildLauncher(cloudToken, branch);
            }
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();

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

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function CreateBuildTarget(cloudToken, projectId, branch, name, isLauncher, isServer)
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
            name: name + (isServer ? "-server" : "") + "-" + makeid(5) + "-" + branch,
            platform: name,
            enabled: true,
            settings:
            {
                autoBuild: false,
                unityVersion: "latest2021_3",
                autoDetectUnityVersion: true,
                fallbackPatchVersion: true,
                executablename: isServer ? "Server" : "Internet-Game",
                "ccdEnabled": false,
                "ccdBucketId": "",
                "ccdApiKey": "",
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
                autoBuildCancellation : false,
                operatingSystemSelected: "mac",
                "rubyVersion": "ruby_version_2_7_4",
                advanced: {
                    unity: {
                        preExportMethod: isLauncher ? "AddressableHelper.PreBuildScript" : "AddressableHelper.PreBuildAddressables",
                        postExportMethod: isLauncher ? "AddressableHelper.PostBuildScript" : "AddressableHelper.PostBuildAddressables",
                        "preBuildScript": "",
                        "postBuildScript": "",
                        "preBuildScriptFailsBuild": false,
                        "postBuildScriptFailsBuild": false,
                        scriptingDefineSymbols: isServer ? `${branch.toUpperCase()}; SERVER; UNITY_SERVER` : 
                                                            branch.toUpperCase(),
                        playerExporter: {
                            "sceneList": [],
                            export: true,
                            buildOptions: isServer ? [
                                "CompressWithLz4HC",
                                "EnableHeadlessMode" 
                            ]: [
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
                            buildAddressables: !isLauncher,
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
        PLAYFLOW: core.getInput('PLAYFLOW_' + branch.toUpperCase(), {required: true}),
    });
}

async function InitProject(cloudToken, repoName, repoSSHUrl, isLauncher)
{
    try
    {
        let projectId = await CreateProject(cloudToken, repoName, repoSSHUrl);

        if (projectId == null || projectId == undefined)
            projectId = repoName;

        await DeleteAllBuildTargets(cloudToken, projectId);

        await CreateBuildTarget(cloudToken, projectId, "dev", "standalonewindows64", isLauncher, false);
        await CreateBuildTarget(cloudToken, projectId, "dev", "standaloneosxuniversal", isLauncher, false);
        await CreateBuildTarget(cloudToken, projectId, "dev", "standalonelinux64", isLauncher, false);

        await CreateBuildTarget(cloudToken, projectId, "staging", "standalonewindows64", isLauncher, false);
        await CreateBuildTarget(cloudToken, projectId, "staging", "standaloneosxuniversal", isLauncher, false);
        await CreateBuildTarget(cloudToken, projectId, "staging", "standalonelinux64", isLauncher, false);

        await CreateBuildTarget(cloudToken, projectId, "prod", "standalonewindows64", isLauncher, false);
        await CreateBuildTarget(cloudToken, projectId, "prod", "standaloneosxuniversal", isLauncher, false);
        await CreateBuildTarget(cloudToken, projectId, "prod", "standalonelinux64", isLauncher, false);

        if (isLauncher)
        {
            await CreateBuildTarget(cloudToken, projectId, "dev", "standalonelinux64", true, true);
            await CreateBuildTarget(cloudToken, projectId, "staging", "standalonelinux64", true, true);
            await CreateBuildTarget(cloudToken, projectId, "prod", "standalonelinux64", true, true);
        }
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
                    delay: 0,
                    commit: github.context.payload.sha
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
            const isLauncher = core.getInput('launcher', {required: false}) == "true";
            
            if (mode == "Init")
            {
                await InitProject(
                    cloudToken,
                    github.context.payload.repository.name,
                    github.context.payload.repository.ssh_url,
                    isLauncher
                );
            }
            else if (mode == "Trigger")
            {
                const branch = github.context.ref.substring("refs/heads/".length);
                await Rebuild(cloudToken, github.context.payload.repository.name, branch);
            }
            else
            {
                /*const branch = github.context.ref.substring("refs/heads/".length);
                await RebuildLauncher(cloudToken, branch);*/

                core.info("Currently launcher triggering is disabled");

            }
        }
        catch (error)
        {
            core.setFailed(error.message);
        }
    }
}

run();

const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

function isMajor(title)
{
    return title.startsWith("major:");
}

function isMinor(title)
{
    return title.startsWith("minor:");
}

function isPatch(title)
{
    return title.startsWith("patch:");
}

function validateTitle(title) 
{
    return isMajor(title) || isMinor(title) || isPatch(title);
}

async function run()
{
    {
        try
        {
            const title = core.getInput('pr_title', {required: true})

            core.info(`Pull Request title: "${title}"`);

            if (validateTitle(title))
            {
                core.info("Title was validated");

                let content = await fs.promises.readFile("ProjectSettings/ProjectSettings.asset", "utf8");

                let versionStart = content.indexOf("bundleVersion:") + ("bundleVersion:").length + 1;
                let versionEnd = content.indexOf("\n", versionStart);

                let version = content.substring(versionStart, versionEnd);
                let versionList = version.split('.');

                if (versionList.length == 3)
                {
                    if (isPatch(title))
                    {
                        versionList[2] = parseInt(versionList[2]) + 1;
                    }
                    else if (isMinor(title))
                    {
                        versionList[2] = "0";
                        versionList[1] = parseInt(versionList[1]) + 1;
                    }
                    else if (isMajor(title))
                    {
                        versionList[2] = "0";
                        versionList[1] = "0";
                        versionList[0] = parseInt(versionList[0]) + 1;
                    }
                }
                else
                {
                    core.setFailed("Unity version is in a wrong format");
                }

                let newVersion = versionList[0] + "." + versionList[1] + "." + versionList[2]
                let newFileContent = content.substring(0, versionStart) + newVersion + content.substring(versionEnd, content.length);

                await fs.promises.writeFile("ProjectSettings/ProjectSettings.asset", newFileContent, {
                    encoding: 'utf8'
                });

                core.info(`Updated from ${version} to ${newVersion}`);
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
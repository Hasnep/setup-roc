import * as core from "@actions/core";
import * as fs from "fs";
import * as gh from "@actions/github";
import * as os from "os";
import * as path from "path";
import * as tc from "@actions/tool-cache";

interface Asset {
  name: string;
  browser_download_url: string;
  updated_at: string;
}

interface Release {
  tag_name: string;
  assets: Asset[];
}

const TOKEN = core.getInput("token");
const VERSION = core.getInput("roc-version");
const VERSION_FILE = core.getInput("roc-version-file");
const ROC_REPO_OWNER = "roc-lang";
const ROC_REPO_NAME = "roc";
const OCTOKIT_CLIENT = gh.getOctokit(TOKEN);

const getVersion = () => {
  if (VERSION && VERSION_FILE) {
    core.warning(
      "Both 'roc-version' and 'roc-version-file' inputs were specified, only 'roc-version' will be used.",
    );
    core.info(`Using version '${VERSION}' from 'roc-version'.`);
    return VERSION;
  } else if (VERSION) {
    core.info(`Using version '${VERSION}' from 'roc-version'.`);
    return VERSION;
  } else if (VERSION_FILE) {
    if (!fs.existsSync(VERSION_FILE)) {
      throw new Error(
        `The specified Roc version file at: '${VERSION_FILE}' doesn't exist.`,
      );
    }
    const version = fs.readFileSync(VERSION_FILE).toString();
    core.info(`Using version '${version}' from file '${VERSION_FILE}'.`);
    return version;
  } else {
    throw new Error(
      "Neither `roc-version` or `roc-version-file` inputs were specified.",
    );
  }
};

const getPlatformAndArchitecture = () => {
  const platform = process.platform;
  const architecture = os.arch();
  const platformAndArchitecture =
    platform === "linux"
      ? architecture === "x64"
        ? "linux_x86_64"
        : null
      : platform === "darwin"
      ? architecture === "arm64"
        ? "macos_apple_silicon"
        : architecture === "x64"
        ? "macos_x86_64"
        : null
      : null;
  if (platformAndArchitecture === null) {
    throw new Error(
      `Unsupported combination of platform '${platform}' and architecture '${architecture}'.`,
    );
  }
  core.info(`Using platform and architecture '${platformAndArchitecture}'.`);
  return platformAndArchitecture;
};

const getRocReleases = async () => {
  const response = await OCTOKIT_CLIENT.rest.repos.listReleases({
    owner: ROC_REPO_OWNER,
    repo: ROC_REPO_NAME,
  });
  if (response === undefined) {
    throw new Error("Oh no!"); // TODO: Better error message here
  }
  const releases = response.data;
  core.info(`Found ${releases.length} releases.`);
  return releases;
};

const getAsset = (
  releases: Release[],
  version: string,
  platformAndArchitecture: string,
) => {
  // Get the release matching the version specifier
  const release = releases.find((release) => release.tag_name === version);
  if (release === undefined) {
    throw new Error(`A release with the tag '${version}' could not be found.`);
  }
  core.info(`Found a release with the tag '${release.tag_name}'.`);

  // Get the releases matching the specified platform and architecture
  if (release.assets.length == 0) {
    throw new Error(`Release ${release.tag_name} has no assets.`);
  }
  const assetsForPlatformAndArchitecture = release.assets.filter((asset) =>
    asset.name.includes(platformAndArchitecture),
  );
  if (assetsForPlatformAndArchitecture.length === 0) {
    throw new Error(
      `Release '${release.tag_name}' has no assets matching the platform and architecture '${platformAndArchitecture}'.`,
    );
  }

  // Find the most recently released asset for the selected platform and architecture
  const asset = assetsForPlatformAndArchitecture.sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0];
  core.info(`Found the asset '${asset.name}'.`);
  return asset;
};

const downloadRocBinary = async (asset: Asset) => {
  const assetUrl = asset.browser_download_url;
  core.info(`Downloading asset from '${assetUrl}'.`);
  const downloadPath = await tc.downloadTool(assetUrl);
  core.info(`Extracting archive at '${downloadPath}'.`);
  const extractedPath = await tc.extractTar(downloadPath);
  // Get the first folder in the extracted archive
  const archiveRootFolderName = fs.readdirSync(extractedPath)[0];
  const rocBinaryFolder = path.join(extractedPath, archiveRootFolderName);
  const rocBinaryPath = path.join(rocBinaryFolder, "roc");
  core.info(`The Roc binary was downloaded to '${rocBinaryPath}'.`);
  return { rocBinaryFolder, rocBinaryPath };
};

const main = async () => {
  try {
    const rocVersion = getVersion();
    core.setOutput("roc-version", rocVersion);

    const platformAndArchitecture = getPlatformAndArchitecture();

    const releases = await getRocReleases();

    const asset = await getAsset(releases, rocVersion, platformAndArchitecture);

    const { rocBinaryFolder, rocBinaryPath } = await downloadRocBinary(asset);
    core.setOutput("roc-path", rocBinaryPath);

    core.info(`Adding '${rocBinaryFolder}' to the PATH.`);
    core.addPath(rocBinaryFolder);

    core.info("Roc has been set up successfully.");
  } catch (err) {
    core.setFailed((err as Error).message);
  }
};

main();

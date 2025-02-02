import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  addPath,
  getInput,
  info,
  setFailed,
  setOutput,
  warning,
} from "@actions/core";
import { getOctokit } from "@actions/github";
import { downloadTool, extractTar } from "@actions/tool-cache";

interface Asset {
  name: string;
  browserDownloadUrl: string;
  updatedAt: string;
}

interface Release {
  tagName: string;
  assets: Asset[];
}

const TOKEN = getInput("token");
const AUTH = TOKEN ? `token ${TOKEN}` : undefined;
const VERSION = getInput("roc-version");
const VERSION_FILE = getInput("roc-version-file");
const ROC_REPO_OWNER = "roc-lang";
const ROC_REPO_NAME = "roc";
const OCTOKIT_CLIENT = getOctokit(TOKEN);

const getVersion = () => {
  if (VERSION && VERSION_FILE) {
    warning(
      "Both 'roc-version' and 'roc-version-file' inputs were specified, only 'roc-version' will be used.",
    );
    info(`Using version '${VERSION}' from 'roc-version'.`);
    return VERSION;
  } else if (VERSION) {
    info(`Using version '${VERSION}' from 'roc-version'.`);
    return VERSION;
  } else if (VERSION_FILE) {
    if (!fs.existsSync(VERSION_FILE)) {
      throw new Error(
        `The specified Roc version file at: '${VERSION_FILE}' doesn't exist.`,
      );
    }
    const version = fs.readFileSync(VERSION_FILE).toString();
    info(`Using version '${version}' from file '${VERSION_FILE}'.`);
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
        : architecture === "arm64"
          ? "linux_arm64"
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
  info(`Using platform and architecture '${platformAndArchitecture}'.`);
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
  info(`Found ${releases.length} releases.`);
  return releases.map((r) => ({
    tagName: r.tag_name,
    assets: r.assets.map((a) => ({
      name: a.name,
      browserDownloadUrl: a.browser_download_url,
      updatedAt: a.updated_at,
    })),
  }));
};

const getAsset = (
  releases: Release[],
  version: string,
  platformAndArchitecture: string,
) => {
  // Get the release matching the version specifier
  const release = releases.find((release) => release.tagName === version);
  if (release === undefined) {
    throw new Error(`A release with the tag '${version}' could not be found.`);
  }
  info(`Found a release with the tag '${release.tagName}'.`);

  if (release.assets.length === 0) {
    throw new Error(`Release ${release.tagName} has no assets.`);
  }
  // Get the releases matching the specified filters
  info("Finding assets matching the platform and architecture.");
  const assetsMatchingFilters = release.assets.filter((asset) =>
    asset.name.includes(platformAndArchitecture),
  );
  if (assetsMatchingFilters.length === 0) {
    throw new Error(
      `Release '${release.tagName}' has no assets matching the platform and architecture '${platformAndArchitecture}'.`,
    );
  }

  // Find the most recently released asset for the selected platform and architecture
  const asset = assetsMatchingFilters.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];
  info(`Found the asset '${asset.name}'.`);
  return asset;
};

const downloadRocBinary = async (asset: Asset) => {
  const assetUrl = asset.browserDownloadUrl;
  info(`Downloading asset from '${assetUrl}'.`);
  const downloadPath = await downloadTool(assetUrl, undefined, AUTH);
  info(`Extracting archive at '${downloadPath}'.`);
  const extractedPath = await extractTar(downloadPath);
  // Get the first folder in the extracted archive
  const archiveRootFolderName = fs.readdirSync(extractedPath)[0];
  const rocBinaryFolder = path.join(extractedPath, archiveRootFolderName);
  const rocBinaryPath = path.join(rocBinaryFolder, "roc");
  info(`The Roc binary was downloaded to '${rocBinaryPath}'.`);
  return { rocBinaryFolder, rocBinaryPath };
};

const main = async () => {
  try {
    const rocVersion = getVersion();
    setOutput("roc-version", rocVersion);

    const platformAndArchitecture = getPlatformAndArchitecture();

    const releases = await getRocReleases();

    const asset = await getAsset(releases, rocVersion, platformAndArchitecture);

    const { rocBinaryFolder, rocBinaryPath } = await downloadRocBinary(asset);
    setOutput("roc-path", rocBinaryPath);

    info(`Adding '${rocBinaryFolder}' to the PATH.`);
    addPath(rocBinaryFolder);

    info("Roc has been set up successfully.");
  } catch (err) {
    setFailed((err as Error).message);
  }
};

main();

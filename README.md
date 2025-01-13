# setup-roc

A GitHub Action to install Roc.
Currently, only installs the latest nightly version.

## Usage

Add a step that uses `hasnep/setup-roc` to a GitHub actions workflow file to install Roc and add the binary to the `PATH`.

```yaml
steps:
  - name: Install Roc
    uses: hasnep/setup-roc@main
    with:
      roc-version: nightly
  - name: Check the Roc version
    run: roc --version
```

The action is designed to work on

- Linux
  - ARM64
  - x86-64
- MacOS
  - ARM64 (Apple Silicon)
  - x86-64

Other combinations of OS and architecture are not currently supported.

### Inputs

- `roc-version` - The version of Roc to use, defaults to `nightly`.
  Mutually exclusive with the `roc-version-file` input.
- `roc-version-file` - Path to a file containing the Roc version to use.
  Mutually exclusive with the `roc-version` input.
- `testing` - If this is set to the string `"true"`, the action will use a version of Roc marked as testing, any other value disables testing versions.
  Defaults to `"false"`.
- `token` - GitHub token to use when accessing the GitHub API.
  Defaults to the automatically generated GitHub token.

### Outputs

- `roc-version` - The installed Roc version.
- `roc-path` - The absolute path to the Roc executable.

## Licence

This repository is released under the [MIT licence](./LICENCE) and is based on the [actions/setup-python](https://github.com/actions/setup-python) repository which is also released under the [MIT licence](./LICENCE-actions-setup-python).

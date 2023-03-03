# setup-roc

A GitHub Action to install Roc.

## Usage

Add the following step to a GitHub actions workflow file to install Roc.

```yaml
steps:
  - name: Install Roc
    uses: hasnep/setup-roc@main
    with:
      roc-version: nightly
```

### Inputs

- `roc-version` - The version of Roc to use, defaults to `nightly`.
  Mutually exclusive with the `roc-version-file` input.
- `roc-version-file` - Path to the file containing the Roc version to use.
  Mutually exclusive with the `roc-version` input.
- `token` - The token used to authenticate when fetching from GitHub.

### Outputs

- `roc-version` - The installed Roc version.
- `roc-path` - The absolute path to the Roc executable.

## Licence

This repository is released under the [MIT licence](./LICENCE) and is based on the [actions/setup-python](https://github.com/actions/setup-python) repository which is also released under the [MIT licence](./LICENCE-actions-setup-python).

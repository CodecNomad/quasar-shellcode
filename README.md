# quASAR

![quasar](./quasar.png)

quASAR: ASAR manipulation made easy - Fork, which changes it to inject js files instead of commands.

This project is a proof-of-concept for manipulating ASAR files for code injection in Electron apps.

This capability works across all platforms, and compiled binaries are available on the [releases](https://github.com/mttaggart/quasar/releases) page.

## Usage

```shell
quasar [options]

Options:
  -i, --input <inputFile>  asar file to mutate (default: "app.asar")
  -f, --file <filePath>  file path (default: "index.js")
  -w --write               write evil files directly to application dir
  -h, --help               display help for command
```

`quasar` requires a `.asar` file as a target. It can either be located elsewhere on the filesystem or, as is default, an `app.asar` file local to the current directory. 

Without `-w`, the resulting `app.asar` and `app.asar.unpacked` will be created in a new `evil` directory within the current directory. However, if `-w` is provided, the ASAR files will be written back to the original path, and the original files will have `.bak` appended to their filenames.

const asar = require("asar");
const { program } = require("commander");
const { questionInt } = require("readline-sync");
const { copyFile, readdir, readFile, writeFile, rename, stat, mkdir } = require("node:fs/promises");
const { copy, ensureDir } = require("fs-extra");
const path = require("path");

const EVIL_DIR = "evil";

async function retrieveAsar(asarPath) {
    console.log("[+] Copying asar files...");
    const localAsar = path.join(".", path.basename(asarPath));
    const localAsarUnpacked = `${localAsar}.unpacked`;

    try {
        await copy(asarPath, localAsar);
        await copy(`${asarPath}.unpacked`, localAsarUnpacked);
    } catch (error) {
        console.error(`[!] Error copying asar files: ${error.message}`);
        process.exit(1);
    }
}

async function findJS(inputFile) {
    try {
        const contents = asar.listPackage(inputFile);
        const jsFiles = contents.filter(f =>
            f.endsWith(".js") &&
            !f.includes(".json") &&
            !f.includes("node_modules")
        );

        if (jsFiles.length === 0) {
            console.error("[!] No suitable JS files found");
            process.exit(1);
        }

        console.log("[+] Found the following JS files:");
        jsFiles.forEach((file, index) => {
            console.log(`${index}: ${file}`);
        });

        const patchChoice = questionInt("Which JS File shall we patch? ");

        if (patchChoice < 0 || patchChoice >= jsFiles.length) {
            console.error("[!] Invalid file selection");
            process.exit(1);
        }

        const patchFile = jsFiles[patchChoice];
        console.log(`[+] Okay, patching ${patchFile}`);
        return patchFile;
    } catch (error) {
        console.error(`[!] Error finding JS files: ${error.message}`);
        process.exit(1);
    }
}

async function ensureUnpackedExists(inputFile) {
    try {
        await ensureDir(`${inputFile}.unpacked`);
        return true;
    } catch (error) {
        console.error(`[!] Error checking/creating unpacked directory: ${error.message}`);
        return false;
    }
}

async function pack(inputFile) {
    try {
        console.log("[+] Determining excludes");
        const unpackedPaths = await readdir(`${inputFile}.unpacked`);

        const unpackDirs = unpackedPaths.length > 1
            ? `{${unpackedPaths.join(",")}}`
            : unpackedPaths[0];

        console.log(`[+] Excluding ${unpackDirs}`);
        console.log(`[+] Creating modified ASAR File: ${inputFile}`);

        await asar.createPackageWithOptions(
            path.join(".", EVIL_DIR, `${inputFile}.extracted`),
            path.join(".", EVIL_DIR, inputFile),
            { unpackDir: unpackDirs }
        );
    } catch (error) {
        console.error(`[!] Error packing ASAR: ${error.message}`);
        process.exit(1);
    }
}

async function mutate(asarFile, jsFile, injectionFile) {
    try {
        console.log(`[+] Injecting contents from: ${injectionFile}`);
        const jsPath = path.join(".", EVIL_DIR, `${asarFile}.extracted`, jsFile);
        const originalContent = (await readFile(jsPath)).toString();
        const injectionContent = (await readFile(injectionFile)).toString();

        await writeFile(jsPath, originalContent + "\n" + injectionContent);
        console.log("[+] File contents injected successfully");
    } catch (error) {
        console.error(`[!] Error injecting file contents: ${error.message}`);
        process.exit(1);
    }
}

async function writeEvil(inputFile, newAsarPath) {
    try {
        console.log("[+] Backing up original ASAR assets");
        await rename(inputFile, `${inputFile}.bak`);
        await rename(`${inputFile}.unpacked`, `${inputFile}.unpacked.bak`);

        console.log("[+] Copying modified files");
        await copyFile(path.join(".", EVIL_DIR, newAsarPath), inputFile);
        await copy(
            path.join(".", EVIL_DIR, `${newAsarPath}.unpacked`),
            `${inputFile}.unpacked`
        );
    } catch (error) {
        console.error(`[!] Error writing modified files: ${error.message}`);
        process.exit(1);
    }
}

async function unpack(inputFile) {
    try {
        if (!await ensureUnpackedExists(inputFile)) {
            console.error(`[!] Missing ${inputFile}.unpacked directory!`);
            process.exit(1);
        }

        console.log("[+] Extracting ASAR");
        await asar.extractAll(
            inputFile,
            path.join(EVIL_DIR, `${inputFile}.extracted`)
        );
    } catch (error) {
        console.error(`[!] Error unpacking ASAR: ${error.message}`);
        process.exit(1);
    }
}

async function main() {
    program
        .option("-i, --input <inputFile>", "asar file to modify", "app.asar")
        .option("-f, --file <injectionFile>", "JS file to inject")
        .option("-w, --write", "write modified files directly to application dir")
        .parse(process.argv);

    const options = program.opts();

    if (!options.file) {
        console.error("[!] Missing required --file option");
        process.exit(1);
    }

    try {
        try {
            await stat(options.file);
        } catch {
            console.error("[!] Injection file not found:", options.file);
            process.exit(1);
        }

        try {
            await stat(EVIL_DIR);
        } catch {
            await mkdir(EVIL_DIR);
        }

        let newAsarPath = options.input;
        if (path.basename(options.input) !== options.input) {
            await retrieveAsar(options.input);
            newAsarPath = path.basename(options.input);
        }

        const patchFile = await findJS(newAsarPath);
        await unpack(newAsarPath);
        await mutate(newAsarPath, patchFile, options.file);
        await pack(newAsarPath);

        if (options.write) {
            await writeEvil(options.input, newAsarPath);
            console.log("[+] Modified assets copied. Remember to restore the originals!");
        } else {
            console.log("[+] Done! Move the new app.asar and app.asar.unpacked into place");
        }
    } catch (error) {
        console.error(`[!] Fatal error: ${error.message}`);
        process.exit(1);
    }
}

main().then();
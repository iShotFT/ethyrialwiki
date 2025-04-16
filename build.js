/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const { exec } = require("child_process");
const { readdirSync, existsSync } = require("fs");
const path = require("path");
const fs = require("fs-extra");

const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout ? stdout : stderr);
      }
    });
  });
}

async function build() {
  const buildDir = path.resolve(__dirname, "build");
  const serverBuildDir = path.join(buildDir, "server");
  const pluginsBuildDir = path.join(buildDir, "plugins");
  const seederBuildDir = path.join(buildDir, "seeder");
  const pluginsSourceDir = path.resolve(__dirname, "plugins");
  const seederSourceDir = path.resolve(__dirname, "seeder");

  // Clean previous build
  console.log("Clean previous build…");

  await Promise.all([
    fs.remove(serverBuildDir), 
    fs.remove(pluginsBuildDir),
    fs.remove(seederBuildDir)
  ]);

  const d = getDirectories(pluginsSourceDir);

  // Compile server and shared
  console.log("Compiling…");
  await Promise.all([
    execAsync(
      "yarn babel --extensions .ts,.tsx --quiet -d ./build/server ./server"
    ),
    execAsync(
      "yarn babel --extensions .ts,.tsx --quiet -d ./build/shared ./shared"
    ),
    execAsync(
      "yarn babel --extensions .ts,.tsx --quiet -d ./build/seeder ./seeder"
    ),
    ...d.map(async (plugin) => {
      const pluginSourcePath = path.join(pluginsSourceDir, plugin);
      const pluginBuildPath = path.join(pluginsBuildDir, plugin);

      const hasServer = await fs.pathExists(
        path.join(pluginSourcePath, "server")
      );
      if (hasServer) {
        await execAsync(
          `yarn babel --extensions .ts,.tsx --quiet -d "${path.join(
            pluginBuildPath,
            "server"
          )}" "${path.join(pluginSourcePath, "server")}"`
        );
      }

      const hasShared = await fs.pathExists(
        path.join(pluginSourcePath, "shared")
      );
      if (hasShared) {
        await execAsync(
          `yarn babel --extensions .ts,.tsx --quiet -d "${path.join(
            pluginBuildPath,
            "shared"
          )}" "${path.join(pluginSourcePath, "shared")}"`
        );
      }
    }),
  ]);

  // Copy static files
  console.log("Copying static files…");
  await Promise.all([
    fs.copy(
      path.resolve(__dirname, "server/collaboration/Procfile"),
      path.join(serverBuildDir, "collaboration/Procfile")
    ),
    fs.copy(
      path.resolve(__dirname, "server/static/error.dev.html"),
      path.join(buildDir, "server/error.dev.html")
    ),
    fs.copy(
      path.resolve(__dirname, "server/static/error.prod.html"),
      path.join(buildDir, "server/error.prod.html")
    ),
    fs.copy(
      path.resolve(__dirname, "package.json"),
      path.join(buildDir, "package.json")
    ),
    ...d.map(async (plugin) => {
      const pluginSourceFile = path.join(
        pluginsSourceDir,
        plugin,
        "plugin.json"
      );
      const pluginDestFile = path.join(pluginsBuildDir, plugin, "plugin.json");
      await fs.ensureDir(path.dirname(pluginDestFile));
      if (await fs.pathExists(pluginSourceFile)) {
        await fs.copy(pluginSourceFile, pluginDestFile);
      }
    }),
  ]);

  console.log("Done!");
}

void build();

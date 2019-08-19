const gulp = require("gulp");
const debug = require("gulp-debug");
const flatMap = require("gulp-flatmap");
const closureCompiler = require("google-closure-compiler").gulp();
const inject = require("gulp-inject-string");
const fs = require("fs");
const util = require("util");
const mustache = require("mustache");

const readFile = util.promisify(fs.readFile);

async function readLicense() {
  try {
    return await readFile("./licenseheader.txt");
  } catch (err) {
    console.log(err);
    console.log("### using fallback license ###");
    return "// Symlink GmbH. All rights reserverd \n";
  }
}

async function readPackageJson() {
  try {
    return await readFile("./package.json");
  } catch (err) {
    console.log(err);
  }
}

async function loadReadmeTemplate() {
  try {
    return await readFile("_assets/readme.tpl.md");
  } catch (err) {
    console.log(err);
  }
}

gulp.task("compile:hard", () => {
  return gulp
    .src("./lib/**/*.js", { base: "./" })
    .pipe(debug())
    .pipe(
      flatMap(function(stream, file) {
        return stream.pipe(
          closureCompiler({
            compilation_level: "SIMPLE_OPTIMIZATIONS",
            warning_level: "DEFAULT",
            language_in: "ECMASCRIPT6_STRICT",
            language_out: "ECMASCRIPT5_STRICT",
            js_output_file: file.path,
          }),
        );
      }),
    )
    .pipe(gulp.dest("."));
});

gulp.task("inject:license", async () => {
  const license = await readLicense();
  return gulp
    .src("./lib/**/*.js", { base: "./" })
    .pipe(debug())
    .pipe(inject.prepend(license + "\n"))
    .pipe(gulp.dest("."));
});

gulp.task("build:readme", async () => {
  const package = JSON.parse(await readPackageJson());
  const template = await loadReadmeTemplate();
  const renderedTemplate = await mustache.render(template.toString(), {
    name: package.name,
    description: package.description,
  });
  fs.writeFile("readme.md", renderedTemplate, "utf-8", (err) => {
    if (err) {
      console.log(err);
    }

    console.log("successful build reamde.md");
  });
});

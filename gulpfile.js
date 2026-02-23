const gulp = require("gulp");
const less = require("gulp-less");

/* ----------------------------------------- */
/*  Compile LESS
/* ----------------------------------------- */

/**
 * Compile LESS stylesheets to CSS.
 */
function compileLESS() {
  return gulp.src("less/crucible.less")
    .pipe(less())
    .pipe(gulp.dest("./"));
}
const css = gulp.series(compileLESS);

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

/**
 * Watch LESS source files and recompile CSS on changes.
 */
function watchUpdates() {
  gulp.watch(["less/*.less"], css);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
  gulp.parallel(css),
  watchUpdates
);
exports.css = css;

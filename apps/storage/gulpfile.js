var gulp       = require('gulp'),
    path       = require('path'),
    browserify = require('browserify'),
    reactify   = require('reactify'),
    uglify     = require('gulp-uglify'),
    minifycss  = require('gulp-minify-css'),
    concat     = require('gulp-concat'),
    transform  = require('vinyl-transform'),
    source     = require('vinyl-source-stream'),
    buffer     = require('vinyl-buffer'),
    del        = require('del');

var LIB_PATH   = '../../lib',
    APP_ENTRY  = './js/app.jsx',
    OUTPATH    = 'build/' + path.basename(__dirname),
    DEBUG      = false;

gulp.task('default', function() {
    var b = browserify({
            entries: [ APP_ENTRY ],
            paths: [ LIB_PATH ],
            debug: DEBUG
        })
        .transform(reactify)
        .bundle()
        .pipe(source('app.min.js'));

    if (!DEBUG)
        b = b.pipe(buffer()).pipe(uglify());

    b.pipe(gulp.dest(OUTPATH + '/js/'));

    /* Build app css bundle */
    gulp.src('css**/*.css')
        .pipe(concat('app.min.css'))
        .pipe(minifycss())
        .pipe(gulp.dest(OUTPATH + '/css'));

    /* Copy rest app resources */
    gulp.src([
        'index.html',
        'manifest.json',
        'img**/*',
    ])
    .pipe(gulp.dest(OUTPATH));
});

gulp.task('clean', function(cb) {
    del(OUTPATH, cb);
});

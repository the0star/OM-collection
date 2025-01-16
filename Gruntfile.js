module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    eslint: {
      target: ["app.js", "public/javascripts/signUpFunctions.js"],
    },
    uglify: {
      dev: {
        files: [
          {
            expand: true,
            src: ["public/javascripts/*.js"],
            dest: "public/dist/js",
            cwd: ".",
            rename: function (dst, src) {
              console.log(dst, src);
              return dst + "/" + src.replace("public/javascripts", "");
            },
          },
        ],
      },
    },
    watch: {
      files: ["<%= uglify.dev.files[0].src %>"],
      tasks: ["uglify"],
    },
  });

  grunt.loadNpmTasks("grunt-eslint");
  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-watch");

  grunt.registerTask("default", ["eslint", "uglify"]);
};

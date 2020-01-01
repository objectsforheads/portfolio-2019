const glob = require('glob');
const handlebars = require('handlebars')
const marked = require('marked');
const matter = require('gray-matter');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const Entities = require('html-entities').XmlEntities;
const entities = new Entities();

const inputDirectory = './src/pages';
const templateDirectory = './src/templates';
const outputDirectory = './dist';

// Convert all template files into handlebar objects
const templates = {};
const templateFiles = glob.sync(`${templateDirectory}/*.template`);
const convertedAllTemplates = [];
templateFiles.forEach(function(file) {
    convertedAllTemplates.push(new Promise((resolve, reject) => {
        fs.readFile(file, function(readError, data) {
            const templateName = file.match(/[ \w-]+?(?=\.)/)[0];
            if (readError) reject(error);
            const fileContents = data.toString('utf-8');
            const parsedTemplate = handlebars.compile(fileContents, {noEscape: true});
            templates[templateName] = parsedTemplate;
            resolve();
        })
    }))
})

Promise.all(convertedAllTemplates).then(() => {
    // Set up an array that will hold all of our processed files
    // They'll be batch written after all processing has been completed
    const output = [];

    // Look for all pages in ./src/pages (supports .md, .html)
    const convertedAllContentToHtml = [];

    // Markdown files should be processed using gray-matter and marked into html
    const markdownFiles = glob.sync(`${inputDirectory}/**/*.md`);
    markdownFiles.forEach(function(file) {
        convertedAllContentToHtml.push(new Promise((resolve, reject) => {
            fs.readFile(file, function(readError, data) {
                if (readError) reject(readError);
                const fileContents = data.toString('utf-8');
                // Pull frontmatter out
                const fileData = matter(fileContents);
                // Convert markdown to html
                fileData.content = marked(fileData.content);
                // Marked has encoded the text, decode it here
                fileData.content = entities.decode(fileData.content);
                // Pass both to handlebars to generate final html
                const frontmatter = {content: fileData.content, ...fileData.data};
                const template = frontmatter.template || 'default';
                const outputFile = templates[template](frontmatter);
                // Save output
                output.push({
                    path: file.replace(inputDirectory, '').replace('\.md', ''),
                    html: outputFile
                })
                resolve();
            })
        }))
    })

    // Html files go as-is
    const htmlFiles = glob.sync(`${inputDirectory}/*.html`);
    htmlFiles.forEach(function(file) {
        convertedAllContentToHtml.push(new Promise((resolve, reject) => {
            fs.readFile(file, function(readError, data) {
                if (readError) reject(readError);
                const fileContents = data.toString('utf-8');
                // Pull frontmatter out
                const fileData = matter(fileContents);
                // Pass both to handlebars to generate final html
                const frontmatter = {content: fileData.content, ...fileData.data};
                const template = frontmatter.template || 'default';
                const outputFile = templates[template](frontmatter);
                // Save output
                output.push({
                    path: file.replace(inputDirectory, '').replace('\.html', ''),
                    html: outputFile
                })
                resolve();
            })
        }))
    })

    // Write all output to files
    Promise.all(convertedAllContentToHtml).then(() => {
        output.forEach(function(file) {
            const directoryPath = path.dirname(`${outputDirectory}${file.path}.html`);
            mkdirp.sync(directoryPath);
            fs.writeFile(`${outputDirectory}${file.path}.html`, file.html, function(error) {
                if (error) throw error;
            })
        })
    })
});

// TODO: fix deploy script (make sure it's on master, remove DS_Store, etc etc)
// TODO: add automatically generated meta data on frontmatter (created, last updated, etc)
// TODO: add cache busting
// TODO: build in a staging environment so deploy doesn't just push to production
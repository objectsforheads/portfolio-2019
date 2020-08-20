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

    // Parse links with an extra span wrapper for the aesthetic
    // copy pasta-ing from https://github.com/markedjs/marked/blob/b6773fca412c339e0cedd56b63f9fa1583cfd372/src/Renderer.js#L134
    const renderer = {
        link: function(href, title, text) {
            // Also copying the helper from marked because it's not in this function's scope
            function cleanUrl(sanitize, base, href) {
                if (sanitize) {
                  let prot;
                  try {
                    prot = decodeURIComponent(unescape(href))
                      .replace(nonWordAndColonTest, '')
                      .toLowerCase();
                  } catch (e) {
                    return null;
                  }
                  if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
                    return null;
                  }
                }
                if (base && !originIndependentUrl.test(href)) {
                  href = resolveUrl(base, href);
                }
                try {
                  href = encodeURI(href).replace(/%25/g, '%');
                } catch (e) {
                  return null;
                }
                return href;
            }
            href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
            if (href === null) {
                return text;
            }

            // Allow for mailto links
            if (href.startsWith('mailto:')) {
                href = href.split('mailto:')[1];
                href = `mailto:` + escape(href);
            } else {
                href = escape(href);
            }

            let out = '<a href="' + href + '"';
            if (title) {
                out += ' title="' + title + '"';
            }
            out += '><span>' + text + '</span></a>';
            return out;
        }
    }
    marked.use({renderer});

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
                const frontmatter = {
                    content: fileData.content,
                    ...fileData.data,
                    created: Date.now(),
                    year: (new Date()).getFullYear(),
                    stylesheets: ['main'].concat(fileData.data.styles || [])
                };
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
                const frontmatter = {
                    content: fileData.content,
                    ...fileData.data,
                    created: Date.now(),
                    stylesheets: ['main'].concat(fileData.data.styles || [])
                };
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

// TODO: add automatically generated meta data on frontmatter (created, last updated, etc)
// TODO: build in a staging environment so deploy doesn't just push to production
// TODO: refactor templates so they're nestable or something - copy pasting basic HTML is 🙅
// TODO: refactor functions so there's less copy pasta
// TODO: remove browser-sync if possible
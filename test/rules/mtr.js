/* eslint-env mocha */
const MTR = require('../../modules/rules/mtr');
const _ = require('lodash');
const chai = require('chai');
const cheerio = require('cheerio');
const fs = require('fs');

const expect = chai.expect;

describe('MTR', function () {
    let mtr;
    beforeEach(function () {
        mtr = new MTR(false);
    });

    describe('parsing', function () {
        describe('#cleanup', function () {
            it('should remove empty p tags', function () {
                const $ = cheerio.load('<body><p>\n</p><p><p><p>With text</p><p> </p><p>With more text</p></body>');
                mtr.cleanup($);
                expect($('p').length).to.equal(2);
            });
            it('should mark chapter headers', function () {
                const $ = cheerio.load('<body><h4>1. A Chapter</h4><h4>1.1 A Section</h4><p>Some Content</p><h4>2. Another Chapter</h4><p>More content</p></body>');
                mtr.cleanup($);
                expect($('.chapter-header').length).to.equal(2);
            });
            it('should mark section headers', function () {
                const $ = cheerio.load('<body><h4>1. A Chapter</h4><h4>1.1 A Section</h4><p>Some Content</p><h4>1.2 Another Section</h4>' +
                    '<h4>2. Another Chapter</h4><h4>2.1 Yet another section</h4><p>More content</p></body>');
                mtr.cleanup($);
                expect($('.section-header').length).to.equal(3);
            });
        });
        describe('#handleChapter', function () {
            it('should produce chapter entries for each chapter', function () {
                 const $ = cheerio.load('<body><h4 class="chapter-header">1. A Chapter</h4><h4>1.1 A Section</h4><p>Some Content</p><h4 class="chapter-header">2. Another Chapter</h4>');
                 mtr.handleChapters($);
                 expect(mtr.mtrData.chapters).to.have.deep.property('1.title', '1. A Chapter');
                 expect(mtr.mtrData.chapters).to.have.deep.property('2.title', '2. Another Chapter');
            });
        });
        describe('#handleSection', function () {
            beforeEach(function () {
                const $ = cheerio.load([
                    '<body><h4 class="chapter-header">1. A Chapter</h4><h4 class="section-header">1.1 A Section</h4><p>Some Content</p>',
                    '<h4 class="section-header">1.2 Another Section</h4>',
                    '<h4 class="section-header">Appendix A-An Appendix</h4>'].join('\n'));
                mtr.handleChapters($);
                mtr.handleSections($); 
            });
             
            it('should produce section entries for each section', function () {
                expect(mtr.mtrData.sections).to.have.deep.property('1\\.1.title', '1.1 A Section');
                expect(mtr.mtrData.sections).to.have.deep.property('1\\.1.content', 'Some Content');
           
                expect(mtr.mtrData.sections).to.have.deep.property('1\\.2.title', '1.2 Another Section');
            });
            it('should add section entries to the appropriate chapter', function () {
                expect(mtr.mtrData.chapters).to.have.deep.property('1.sections[0]', '1.1');
                expect(mtr.mtrData.chapters).to.have.deep.property('1.sections[1]', '1.2');
            });
        });
        describe('#handleSectionContent', function () {
            it('should handle regular paragraphs', function () {
                const $ = cheerio.load('<body><h4 class="section-header">1.1 A Section</h4><p>Some section content\n</p><p>\nMore section content</p><h4 class="section-header">Another Section</h4>');
                const result = mtr.handleSectionContent($, $('.section-header').first(), "1.1 A Section", "1.1");
                expect(result).to.equal('Some section content\n\nMore section content');
            });
        });
    });
    describe('output', function () {
        describe('#generateLink', function () {
            const rulesBlogMTR = 'http://blogs.magicjudges.org/rules/mtr'
            it('should work for sections', function () {
                const result = mtr.generateLink('3.5');
                expect(result).to.equal(rulesBlogMTR + '3-5');
            });
        });
        describe('#formatChapter', function () {
            let chapter;
            before(function () {
                mtr.mtrData.sections = {'1.1' : {title: '1.1 A Section'}, '1.2': {title: '1.2 Another Section'}};
                chapter = mtr.formatChapter({title: '1. A Chapter', sections: ['1.1', '1.2']});
            });
            it('should contain the title', function () {
                expect(chapter).to.contain('1. A Chapter');
            });
            it('should contain the available Sections', function () {
                expect(chapter).to.contain('1.1 A Section').and.to.contain('1.2 Another Section');
            })
        });
        describe('#formatSection', function () {
            let section;
            let sectionText;
            beforeEach(function () {
                section = {title: '1.1 A Section', content: 'The section\'s content', key: '1.1'};
                sectionText = mtr.formatSection(section);
            });
            it('should contain the title', function () {
                expect(sectionText).to.contain('1.1 A Section');
            });
            it('should contain the content', function () {
                expect(sectionText).to.contain('1.1 A Section');
            });
            it('should truncate long section texts and display a link', function () {
                section.content = _.repeat("123456789\n", 250);
                sectionText = mtr.formatSection(section);
                expect(sectionText).to.have.length.of.at.most(1500);
                expect(sectionText).to.contain('\u2026');
                expect(sectionText).to.contain('http://blogs.magicjudges.org/rules/mtr1-1');
            });
        });
    });
     describe('tests based on real data', function() {
        let mtr;

        before(function () {
            this.timeout(5000);
            mtr = new MTR(false);
            mtr.init(fs.readFileSync(`${__dirname}/mtr.html`, 'utf8'));
        });
        it('should have downloaded and parsed the mtr', function () {
            expect(mtr.mtrData.chapters).to.have.keys(_.flatten([_.range(1, 11).map(_.toString), 'appendices']));

            expect(mtr.mtrData.sections).to.contain.keys(_.range(1, 11).map(n => `${n}.1`));
        });

         describe('#find', function() {
            it('should work for chapter queries', function() {
                expect(mtr.find('2')).to.contain('Tournament Mechanics');
            });
            it('should work for section queries', function() {
                expect(mtr.find('4.4')).to.contain('Players are expected to remember their own triggered abilities');
            });

            it('should give an error on unknown chapters', function() {
                expect(mtr.find('11')).to.contain('not exist').and.to.contain('Available Chapters');
            });
             it('should give an error on unknown chapters', function() {
                expect(mtr.find('8.7')).to.contain('not exist').and.to.contain('available sections');
            });
        });
     });
});
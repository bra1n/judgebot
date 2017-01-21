/* eslint-env mocha */
const IPG = require('../../modules/rules/ipg');
const chai = require('chai');
const cheerio = require('cheerio');
const fs = require('fs');

const expect = chai.expect;

describe('IPG', function () {
    let ipg;
    before(function () {
        ipg = new IPG(false);
    });

    describe("#cleanup", function () {
        it('should wrap all text nodes in p tags', function () {
            const $ = cheerio.load("<body>Text Node\n<h4>Header</h4>\nAnother Text Node\n<p>A paragraph</p>\nYet another text node</body>");

            ipg.cleanup($);

            expect($("p").length).to.equal(4);
        });
        it('should add header classes as appropriate', function () {
            const chapterHeader = "1 A Chapter Header";
            const sectionHeader = "1.1 A Section Header";
            const subsectionHeader = "Philosophy";
            const notASectionHeader = "5.3.7 Not a section header";
            const $ = cheerio.load([chapterHeader, sectionHeader, subsectionHeader, notASectionHeader].map(h => `<h4>${h}</h4>`).join("<p>A random paragraph</p>"));

            ipg.cleanup($);

            expect($(".chapter-header").text()).to.equal(chapterHeader);
            expect($(".section-header").text()).to.equal(sectionHeader);
            expect($(".subsection-header").length).to.equal(2);
            expect($(".subsection-header").first().text()).to.equal(subsectionHeader);
            expect($(".subsection-header").last().text()).to.equal(notASectionHeader);
        });
        it('should place a header before pseudo subsections', function() {
            const upgradeSection = "Upgrade: This is a pseudo Subsection.";
            const downgradeSection = "Downgrade: And another pseudo Subsection.";
            const randomParagraph1 = "A random paragraph containing the words downgrade and Upgrade: Followed by a colon.";
            const randomParagraph2 = "Word: A random paragraph Starting with a word followed by a colon.";
            const $ = cheerio.load([upgradeSection, randomParagraph1, downgradeSection, randomParagraph2].map(p => `<p>${p}</p>`).join("\n"));

            ipg.cleanup($);

            expect($("h4").length).to.equal(2);
            expect($(".subsection-header").first().next().text()).to.equal(upgradeSection.replace("Upgrade: ", ""));
            expect($(".subsection-header").last().next().text()).to.equal(downgradeSection.replace("Downgrade: ", ""));
        });
    });
    describe('parse functions', function() {
        const c1 = '<h4 class="chapter-header">1 A Chapter</h4>';
        const c2 = '<h4 class="chapter-header">2 ANOTHER CHAPTER</h4>';
        const s1 = '<h4 class="section-header">1.1 A Section</h4>';
        const s2 = '<h4 class="section-header">1.2 Another Section</h4>';
        const sub1 = '<h4 class="subsection-header">Philosophy</h4>';
        const sub2 = '<h4 class="subsection-header">Additional Remedy</h4>';
        const subDowngrade = '<h4 class="subsection-header">Downgrade</h4>';
        const p1 = '<p>A paragraph</p>';
        const ps = '<p>A philosophical paragraph</p>';
        const pd1 = '<p>A Downgrade paragraph</p>';
        const pd2 = '<p>Another Downgrade paragraph</p>';
        const penalty = '<table><th>Penalty</th><td>Disqualification</td></table>';


        before(function() {
            const $ = cheerio.load([c1, p1, s1, penalty, p1, sub1, ps, sub2, s2, subDowngrade, pd1, subDowngrade, pd2, c2].join('\n'));
            ipg.handleChapters($);
            ipg.handleSections($);
            ipg.handleSubsections($);
        });

        describe('#handleChapters', function() {
            it("should create an entry for each chapter header", function() {
                expect(ipg.ipgData).to.have.deep.property('1.title', '1 A Chapter');
                expect(ipg.ipgData).to.have.deep.property('2.title', '2 Another Chapter');
                expect(ipg.ipgData).to.have.deep.property('1.text', 'A paragraph');
            });
        });
        describe('#handleSections', function() {
            it("should create an entry for each section header", function() {
                expect(ipg.ipgData).to.have.deep.property('1\\.1.title', '1.1 A Section');
                expect(ipg.ipgData).to.have.deep.property('1\\.2.title', '1.2 Another Section');
                expect(ipg.ipgData).to.have.deep.property('1\\.1.text', 'A paragraph');
            });
            it('should add the sections to the appropriate chapter', function() {
                expect(ipg.ipgData['1'].sections).to.have.members(['1.1', '1.2']);
            });
            it('should handle penalties', function() {
                expect(ipg.ipgData['1.1']).to.have.property('penalty', 'Disqualification');
                expect(ipg.ipgData['1.2'].penalty).to.be.not.ok;

            });
        });
        describe('#handleSubsections', function() {
            it("should create an entry for each subsection header", function() {
                expect(ipg.ipgData['1.1'].subsectionContents).to.have.keys(['philosophy', 'additional-remedy']);
                expect(ipg.ipgData['1.1'].subsectionContents.philosophy).to.have.deep.property('text[0]', 'A philosophical paragraph');
            });
            it('should add the subsections to the appropriate section', function() {
                expect(ipg.ipgData['1.1'].subsections).to.have.members(['philosophy', 'additional-remedy']);
            });
            it('should handle the subsection with the same heading appearing multiple times', function() {
                expect(ipg.ipgData['1.2'].subsections).to.have.length(1).and.contain('downgrade');
                expect(ipg.ipgData['1.2'].subsectionContents.downgrade.text).to.have.length(2).and.to
                    .have.members(["A Downgrade paragraph", "Another Downgrade paragraph"]);
            });
        });

    });

    describe("#formatChapterEntry", function() {
        let chapterEntry;
        let formatted;
        let ipg;

        before(function () {
            ipg = new IPG(false);
            chapterEntry = {
                title: "1 A Chapter",
                text: "Text contained in the chapter",
                sections: ["1.1", "1.2", "1.3"]
            };
            formatted = ipg.formatChapterEntry(chapterEntry);
        });

        it("should contain the formatted chapter's title", function() {
            expect(formatted).to.contain(chapterEntry.title);
        });
        it("should contain the chapter's text if present", function() {
            expect(formatted).to.contain(chapterEntry.text);
        });
        it("should contain a preview if there is no text directly in the entry", function () {
            delete chapterEntry.text;
            ipg.ipgData['1.1'] = {title: "Section Title", text: "Section Text"};
            formatted = ipg.formatChapterEntry(chapterEntry);
            expect(formatted).to.contain(ipg.ipgData['1.1'].title).and.to.contain(ipg.ipgData['1.1'].text);
        });
        it("should contain a list of available sections", function () {
            const availableSections = chapterEntry.sections.map(s => `*${s}*`).join(', ');
            expect(formatted).to.contain(availableSections);
        });
    });
    describe("#formatSectionEntry", function() {
        let sectionEntry;
        let formatted;
        let ipg;

        beforeEach(function () {
            ipg = new IPG(false);
            sectionEntry = {
                title: "1.1 A Section",
                penalty: "Disqualification",
                text: "Text contained in the section",
                subsections: ["definition", "philosophy", "additional-remedy"],
                subsectionContents: {definition: {title: "Definition", text: "The content of the definition"}}
            };
            formatted = ipg.formatSectionEntry(sectionEntry);
        });

        it("should contain the section's title", function() {
            expect(formatted).to.contain(sectionEntry.title);
        });
        it("should contain the penalty, if there is one", function() {
            expect(formatted).to.contain(sectionEntry.penalty);
        });
        it("should contain the section's text if present", function() {
            expect(formatted).to.contain(sectionEntry.text);
        });
        it("should contain a preview if there is no text directly in the section", function () {
            delete sectionEntry.text;
            formatted = ipg.formatSectionEntry(sectionEntry);
            const definitionEntry = sectionEntry.subsectionContents.definition;
            expect(formatted).to.contain(definitionEntry.title).and.to.contain(definitionEntry.text);
        });
        it("should contain a list of available subsections", function () {
            const availableSubsections = sectionEntry.subsections.map(s => `*${s}*`).join(', ');
            expect(formatted).to.contain(availableSubsections);
        });
    });
    describe("#formatSubsectionEntry", function() {
        let sectionEntry;
        let subsectionEntry;
        let formatted;
        let ipg;

        beforeEach(function () {
            ipg = new IPG(false);
            sectionEntry = {
                title: "1.1 A Section",
                text: "Text contained in the section",
                subsections: ["definition", "philosophy", "additional-remedy"],
                subsectionContents: {definition: {title: "Definition", text: ["The content of the definition"]}}
            };
            subsectionEntry = sectionEntry.subsectionContents.definition;
            formatted = ipg.formatSubsectionEntry(sectionEntry, subsectionEntry);
        });

        it("should contain the section's title and the subsection's title", function() {
            expect(formatted).to.contain(sectionEntry.title).and.to.contain(subsectionEntry.title);
        });
        it("should contain the subsection's text if present", function() {
            expect(formatted).to.contain(subsectionEntry.text);
        });

        it("should contain a list of other available subsections", function () {
            const otherSubsections = sectionEntry.subsections.filter(s => s !== 'definition').map(s => `*${s}*`).join(', ');
            expect(formatted).to.contain(otherSubsections);
        });
    });

    describe("tests based on real data", function() {
        let ipg;

        before(function () {
            this.timeout(5000);
            ipg = new IPG(false);
            ipg.init(fs.readFileSync(`${__dirname}/ipg.html`, 'utf8'));
        });
        it("should have downloaded and parsed the ipg", function () {
            expect(ipg.ipgData).to.contain.keys(["1", "2", "3", "4"]);
            expect(ipg.ipgData).to.contain.keys(["1.1", "2.1", "3.1", "4.1"]);
            expect(ipg.ipgData["2.1"].subsectionContents).to.have.keys(["definition", "examples", "philosophy", "additional-remedy", "upgrade"]);
        });

        describe("#find", function() {
            it('should work for chapter queries', function() {
                expect(ipg.find(["2"])).to.contain("Game Play Errors are");
            });
            it('should work for section queries', function() {
                expect(ipg.find(["4.4"])).to.contain("Penalty: Disqualification");
            });
            it('should work for subsection queries', function() {
                expect(ipg.find(["3.1", "philosophy"])).to.contain("Players are responsible for being on time");
            });
            it('should give an error on unknown chapters and sections', function() {
                expect(ipg.find(["8"])).to.contain("don't match any").and.to.contain("Available entries");
            });
            it('should give an error on unknown subsections', function() {
                expect(ipg.find(["2.1", "nonexistant-subsection"])).to.contain("does not have a subsection")
                    .and.to.contain("Available Subsections");
            });
            it('should give an error for subsection queries on chapters', function() {
                expect(ipg.find(["2", "philosophy"])).to.contain("isn't a section");
            });
            it('should show all topics for ddlp', function () {
                expect(ipg.find(["3.5"])).to
                    .contain("definition")
                    .contain("examples")
                    .contain("philosophy")
                    .contain("downgrade");
            });
        });
    });

});

import CR from "../../modules/cr.js";
import {expect} from "chai";

describe('CR', function () {
  let cr: any;
  beforeEach(function () {
    cr = new CR();
  })

  describe('output', function () {
    describe('#ruleToUrl', function () {
      const ruleBaseUrl = 'https://yawgatog.com/resources/magic-rules/#R';
      it('should work for rule sections', function () {
        const url = cr.ruleToUrl('4', false);
        expect(url).to.equal(ruleBaseUrl + '4');
      });
      it('should work for non-dotted rules', function () {
        const url = cr.ruleToUrl('702', false);
        expect(url).to.equal(ruleBaseUrl + '702');
      })
      it('should work for regular rules', function () {
        let url = cr.ruleToUrl('100.1', false);
        expect(url).to.equal(ruleBaseUrl + '1001');
      });
      it('should work for subrules', function () {
        const url = cr.ruleToUrl('104.3a', false);
        expect(url).to.equal(ruleBaseUrl + '1043a');
      });
      // examples don't have their own IDs on the page
      it('should link to correct rule for examples', function () {
        const url = cr.ruleToUrl('614.12 ex', false);
        expect(url).to.equal(ruleBaseUrl + '61412');
      });
      it('should link to correct subrule for examples', function () {
        const url = cr.ruleToUrl('607.5a ex', false);
        expect(url).to.equal(ruleBaseUrl + '6075a');
      });

      const glossBaseUrl = 'https://yawgatog.com/resources/magic-rules/#'
      it('should work for simple glossary entries', function () {
        const url = cr.ruleToUrl('abandon', true);
        expect(url).to.equal(glossBaseUrl + 'abandon');
      });
      it('should work for multiple word glossary entries', function () {
        const url = cr.ruleToUrl('Alternating Teams Variant', true);
        expect(url).to.equal(glossBaseUrl + 'alternating_teams_variant');
      });
      it('should work for glossary entries with punctuation', function () {
        let url = cr.ruleToUrl('Active Player, Nonactive Player Order', true);
        expect(url).to.equal(glossBaseUrl + 'active_player_nonactive_player_order');
        url = cr.ruleToUrl('Free-for-All', true);
        expect(url).to.equal(glossBaseUrl + 'free-for-all');
        url = cr.ruleToUrl('Double-Faced Cards', true);
        expect(url).to.equal(glossBaseUrl + 'double-faced_cards');
        url = cr.ruleToUrl("City's Blessing", true);
        expect(url).to.equal(glossBaseUrl + 'citys_blessing');
        url = cr.ruleToUrl('partner, "partner with [name]"', true);
        expect(url).to.equal(glossBaseUrl + 'partner_partner_with_name');
      });
      it('should work for obsolete glossary entries', function () {
        const url = cr.ruleToUrl('mana burn (obsolete)', true);
        expect(url).to.equal(glossBaseUrl + 'mana_burn');
      })
    })
  })
})
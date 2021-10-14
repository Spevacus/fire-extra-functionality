/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { Domains } from '../src/domain_stats.js';
import { helpers } from '../src/index.js';

describe('index helpers', () => {
    before(async () => await Domains.fetchAllDomainInformation());
    it('should find if a domain with specific stats qualifies for watch', () => {
        expect(helpers.qualifiesForWatch([1, 0, 0], '0')).to.be.true;
        expect(helpers.qualifiesForWatch([5, 0, 0], '10')).to.be.false;
        expect(helpers.qualifiesForWatch([1, 0, 1], '2')).to.be.false;
    });

    it('should find if a domain with specific stats qualifies for blacklist', () => {
        expect(helpers.qualifiesForBlacklist([5, 0, 0], '4')).to.be.true;
        expect(helpers.qualifiesForBlacklist([10, 0, 0], '5')).to.be.false;
        expect(helpers.qualifiesForBlacklist([10, 2, 0], '4')).to.be.false;
    });

    it('should get the correct li id given a domain', () => {
        expect(helpers.getDomainId('stackoverflow.com')).to.be.equal('fire-extra-stackoverflow-com');
        expect(helpers.getDomainId('many.many.dots.here')).to.be.equal('fire-extra-many-many-dots-here');
    });

    it('should return valid and correct MS search URLs', () => {
        // test the whitelisted domains and the redirectors which are all valid domains
        Domains.whitelistedDomains.concat(Domains.redirectors).split('\n').forEach(domainName => {
            const urlObject = new URL(helpers.getMetasmokeSearchUrl(domainName));
            expect(urlObject.searchParams.get('body')).to.be.equal(`(?s:\\b${domainName}\\b)`);
        });
    });

    it('should figure out if a domain is caught or not', () => {
        const {
            watchedWebsites: watched,
            blacklistedWebsites: blacklisted 
        } = Domains;

        const isWatched = (keyword: string): boolean => helpers.isCaught(watched, keyword);
        const isBlacklisted = (keyword: string): boolean => helpers.isCaught(blacklisted, keyword);

        const validWatches = ['essayssos.com', 'trimfire', 'dream-night-tours'];
        const invalidWatches = ['non-existent-keyword, google.com'];
        validWatches.forEach(keyword => expect(isWatched(keyword)).to.be.true);
        invalidWatches.forEach(keyword => expect(isWatched(keyword)).to.be.false);

        const validBlacklists = ['powerigfaustralia', 'ewebtonic.in', 'beautyskin'];
        const invalidBlacklists = invalidWatches;
        validBlacklists.forEach(keyword => expect(isBlacklisted(keyword)).to.be.true);
        invalidBlacklists.forEach(keyword => expect(isBlacklisted(keyword)).to.be.false);
    });

    it('should correctly pluralise words', () => {
        expect(helpers.pluralise('hit', 1)).to.be.equal('hit');
        expect(helpers.pluralise('hit', 0)).to.be.equal('hits');
    });

    it('should correctly fetch accurate tooltip texts for the emojis', () => {
        expect(helpers.getActionDone('watched', true)).to.be.equal('watched: yes');
        expect(helpers.getActionDone('watched', false)).to.be.equal('watched: no');

        expect(helpers.getActionDone('blacklisted', true)).to.be.equal('blacklisted: yes');
        expect(helpers.getActionDone('blacklisted', false)).to.be.equal('blacklisted: no');
    });

    it('should correctly fetch accurate tooltip texts for !!/watch and !!/blacklist', () => {
        const watchedNoAction = helpers.getButtonsText('watch', 'example\\.com', true);
        const blacklistedNoAction = helpers.getButtonsText('blacklist', 'example\\.com', true);

        const watchExampleCom = helpers.getButtonsText('watch', 'example\\.com', false);
        const blacklistManyDots = helpers.getButtonsText('blacklist', 'many\\.dots\\.\\.com', false);

        expect(watchedNoAction).to.be.equal(blacklistedNoAction);
        expect(watchExampleCom).to.be.equal('!!/watch- example\\.com');
        expect(blacklistManyDots).to.be.equal('!!/blacklist-website- many\\.dots\\.\\.com');
    });
});
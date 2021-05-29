import * as chat from './chat.js';
import { Domains } from './domain_stats.js';
import * as github from './github.js';
import * as metasmoke from './metasmoke.js';
import * as stackexchange from './stackexchange.js';

export interface Toastr {
    success(message: string): void;
    error(message: string): void;
}

declare const CHAT: chat.ChatObject;
declare const toastr: Toastr;
declare const fire: {
    reportCache: {
        [key: string]: { id: number; }
    }
};

await Promise.resolve('testing');

const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';

const waitGifHtml = '<img class="fire-extra-wait" src="/content/img/progress-dots.gif">';
const greenTick = '<span class="fire-extra-green"> ✓</span>', redCross = '<span class="fire-extra-red"> ✗</span>';

const getMetasmokeSearchUrl = (domain: string): string =>
    encodeURI(`${metasmokeSearchUrl}?utf8=✓&body_is_regex=1&body=(?s:\\b${domain}\\b)`); // returns an MS search URL for a domain
// According to https://charcoal-se.org/smokey/Guidance-for-Blacklisting-and-Watching (as much as possible at least)
// TP count between 1 and 5, there must be no FPs.
const qualifiesForWatch = ([tpCount, fpCount, naaCount]: number[], seHits: string): boolean =>
    tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10;
// "The site has at least five hits in metasmoke, with no false positives". Assumes that the current post is <=6 months old.
const qualifiesForBlacklist = ([tpCount, fpCount, naaCount]: number[], seHits: string): boolean =>
    tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5;
const isCaught = (regexesArray: RegExp[], domain: string): boolean => regexesArray.some(regex => regex.test(domain));
// get the id the domain li has - dots are replaced with dash
export const getDomainId = (domainName: string): string => `fire-extra-${domainName.replace(/\./g, '-')}`;

function updateDomainInformation(domainName: string): void {
    const seResultCount = Domains.allDomainInformation[domainName]?.stackexchange;
    const metasmokeStats = Domains.allDomainInformation[domainName]?.metasmoke;
    // the SE hits might be zero, so using !hits returns true!!
    if ((!seResultCount && seResultCount !== '0') || !metasmokeStats?.length) return;

    const isWatched = isCaught(Domains.watchedWebsitesRegexes, domainName);
    const isBlacklisted = isCaught(Domains.blacklistedWebsitesRegexes, domainName);
    const escapedDomain = domainName.replace(/\./, '\\.'); // escape dots
    const watch = {
        human: 'watched: ' + (isWatched ? 'yes' : 'no'),
        tooltip: isWatched || isBlacklisted ? 'domain already watched' : `!!/watch- ${escapedDomain}`,
        suggested: qualifiesForWatch(metasmokeStats, seResultCount) && !isWatched && !isBlacklisted,
        class: `fire-extra-${isWatched || isBlacklisted ? 'disabled' : 'watch'}`
    };
    const blacklist = {
        human: 'blacklisted: ' + (isBlacklisted ? 'yes' : 'no'),
        tooltip: isBlacklisted ? 'domain already blacklisted' : `!!/blacklist-website- ${escapedDomain}`,
        suggested: qualifiesForBlacklist(metasmokeStats, seResultCount) && !isBlacklisted,
        class: `fire-extra-${isBlacklisted ? 'disabled' : 'blacklist'}`
    };

    const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
    const watchButton = domainElementLi?.querySelector('.fire-extra-watch'), blacklistButton = domainElementLi?.querySelector('.fire-extra-blacklist');
    const watchInfo = domainElementLi?.querySelector('.fire-extra-watch-info'), blacklistInfo = domainElementLi?.querySelector('.fire-extra-blacklist-info');

    // add the tooltip to the emojis, e.g. watched: yes, blacklisted: no
    watchInfo?.setAttribute('fire-tooltip', watch.human);
    blacklistInfo?.setAttribute('fire-tooltip', blacklist.human);
    // append the tick or the cross (indicated if it should be watched/blacklisted or not)
    if (!watchInfo || !blacklistInfo) return;

    watchInfo.innerHTML = '👀: ' + (isWatched ? greenTick : redCross);
    blacklistInfo.innerHTML = '🚫: ' + (isBlacklisted ? greenTick : redCross);
    if (!watchButton || !blacklistButton) return; // the buttons do not exist if a PR is pending

    // add some ticks if the domain should be watch/blacklisted
    if (watch.suggested) watchButton.insertAdjacentHTML('afterend', greenTick);
    if (blacklist.suggested) blacklistButton.insertAdjacentHTML('afterend', greenTick);
    // disable buttons if necessary
    if (!watchButton.classList.contains(watch.class)) watchButton.classList.add(watch.class);
    if (!blacklistButton.classList.contains(blacklist.class)) blacklistButton.classList.add(blacklist.class);
    // add the tooltips (either !!/<action> example\.com or domain already <action>)
    watchButton.setAttribute('fire-tooltip', watch.tooltip);
    blacklistButton.setAttribute('fire-tooltip', blacklist.tooltip);
}

async function addHtmlToFirePopup(): Promise<void> {
    const reportedPostDiv = document.querySelector('.fire-reported-post');
    const fireMetasmokeButton = document.querySelector<HTMLAnchorElement>('.fire-metasmoke-button');
    const nativeSeLink = [...new URL(fireMetasmokeButton?.href || '').searchParams][0][1];
    const metasmokePostId = fire.reportCache[nativeSeLink].id; // taking advantage of FIRE's cache :)
    const domains = await metasmoke.getAllDomainsFromPost(metasmokePostId);
    if (!domains.length) return; // no domains; nothing to do

    const divider = document.createElement('hr');
    const dataWrapperElement = document.createElement('div');
    dataWrapperElement.classList.add('fire-extra-functionality');

    const header = document.createElement('h3');
    header.innerText = 'Domains';
    dataWrapperElement.appendChild(header);
    reportedPostDiv?.insertAdjacentElement('afterend', dataWrapperElement);
    reportedPostDiv?.insertAdjacentElement('afterend', divider);

    const domainList = document.createElement('ul');
    domainList.classList.add('fire-extra-domains-list');

    // exclude whitelisted domains, redirectors and domains that have a pending PR
    const domainIdsValid = domains.filter(domainObject => !github.getWhitelisted().includes(domainObject.domain)
        && !github.getRedirectors().includes(domainObject.domain)).map(item => item.id);

    Domains.triggerDomainUpdate(domainIdsValid)
        .then(domainNames => domainNames.forEach(domainName => updateDomainInformation(domainName)))
        .catch(error => toastr.error(error));

    domains.map(item => item.domain).forEach(domainName => {
        Domains.allDomainInformation[domainName] = {} as { metasmoke: number[]; stackexchange: string; };
        const domainItem = document.createElement('li');
        domainItem.innerHTML = domainName + '&nbsp;';
        domainItem.id = getDomainId(domainName);
        domainList.appendChild(domainItem);

        // if the domain is whitelisted or a redirector, don't search for TPs/FPs/NAAs. They often have too many hits on SE/MS, and they make the script slower
        if (github.getWhitelisted().includes(domainName)) {
            domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#whitelisted</span>');
            return;
        } else if (github.getRedirectors().includes(domainName)) {
            domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#redirector</span>');
            return;
        }

        const githubPrOpenItem = Domains.githubPullRequests.find(item => item.regex.test(domainName));
        const escapedDomain = domainName.replace(/\./g, '\\.'); // escape dots
        // use a function in case githubPrOpenItem is null (then it'd throw an error because we use .id)
        const watchBlacklistButtons = '<a class="fire-extra-watch">!!/watch</a>&nbsp;&nbsp;<a class="fire-extra-blacklist">!!/blacklist</a>&nbsp;&nbsp;';
        const actionsAreaHtml = githubPrOpenItem ? github.getPendingPrHtml(githubPrOpenItem) : watchBlacklistButtons;

        domainItem.insertAdjacentHTML('beforeend',
            `(
           <a href="${getMetasmokeSearchUrl(escapedDomain)}">MS</a>: <span class="fire-extra-ms-stats">${waitGifHtml}</span>&nbsp;
         |&nbsp;
           <span class="fire-extra-se-results"><a href="${stackexchange.seSearchPage}${domainName}">${waitGifHtml}</a></span>
         )&nbsp;&nbsp;${actionsAreaHtml}
         (<span class="fire-extra-watch-info">👀: ${waitGifHtml}</span>/<span class="fire-extra-blacklist-info">🚫: ${waitGifHtml}</span>)`
                .replace(/^\s+/mg, '').replace(/\n/g, ''));

        stackexchange.getSeSearchResultsForDomain(domainName).then(hitCount => {
            const domainElementLi = document.getElementById(getDomainId(domainName));
            if (!domainElementLi) return; // in case the popup is closed before the request is finished

            Domains.allDomainInformation[domainName].stackexchange = hitCount;
            const seHitCountElement = domainElementLi.querySelector('.fire-extra-se-results a');
            if (!seHitCountElement) return;

            seHitCountElement.innerHTML = `SE: ${hitCount}`;
            updateDomainInformation(domainName);
        }).catch(error => {
            toastr.error(error);
            console.error(error);
        });

        chat.addActionListener(domainItem.querySelector('.fire-extra-watch'), 'watch', escapedDomain);
        chat.addActionListener(domainItem.querySelector('.fire-extra-blacklist'), 'blacklist', escapedDomain);
        if (githubPrOpenItem) chat.addActionListener(domainItem.querySelector('.fire-extra-approve'), 'approve', githubPrOpenItem.id);
    });

    dataWrapperElement.appendChild(domainList);
}

void (async function(): Promise<void> {
    CHAT.addEventHandlerHook(chat.newChatEventOccurred);
    await Domains.fetchAllDomainInformation();
    window.addEventListener('fire-popup-appeared', addHtmlToFirePopup);
    GM_addStyle(`
.fire-extra-domains-list {
  padding: 5px !important;
  margin-left: 12px;
}

.fire-extra-tp, .fire-extra-green { color: #3c763d; }
.fire-extra-fp, .fire-extra-red { color: #a94442; }
.fire-extra-naa { color: #8a6d3b; }
.fire-extra-blacklist, .fire-extra-watch, .fire-extra-approve { cursor: pointer; }
.fire-popup { width: 700px !important; }
.fire-extra-none { display: none; }
.fire-extra-wait { padding-bottom: 5px; }

/* copied from the MS CSS for domain tags */
.fire-extra-tag {
  background-color: #5bc0de;
  padding: .2em .6em .3em;
  font-size: 75%;
  font-weight: 700;
  color: #fff;
  border-radius: .25em;
}

.fire-extra-disabled {
  color: currentColor;
  opacity: 0.8;
}`);
})();
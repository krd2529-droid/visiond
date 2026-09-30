import assert from 'node:assert/strict';
import { isNonSoccerNews, isSoccerEligibleNews, isDisplayEligibleImageCandidate, isLikelyContentImageUrl, parseNewsRss, newsRssUrlForWindow, bingNewsRssUrlForWindow } from '../functions/_vsport.js';

const allTeamSubject='(soccer OR "Premier League" OR "Champions League" OR UEFA OR "La Liga" OR Bundesliga OR "Serie A" OR "Football League")';
const googleAllTeams=new URL(newsRssUrlForWindow('2026-10-01','all_teams_for_day','','exact'));
const bingAllTeams=new URL(bingNewsRssUrlForWindow('2026-10-01','all_teams_for_day','','exact'));
assert.equal(googleAllTeams.searchParams.get('q'),`${allTeamSubject} after:2026-09-30 before:2026-10-02`);
assert.equal(bingAllTeams.searchParams.get('q'),allTeamSubject);
assert.ok(bingAllTeams.href.length<400);
assert.doesNotMatch(allTeamSubject,/\b(?:manager|player|college|gridiron)\b/i);

const rejected = [
  ['College football picks: Coaches know all too well seasons can turn against most unlikely opponents', 'Ohio State Buckeyes face another test', 'https://apnews.com/article/ap-college-football-picks-test'],
  ['College football picks: Ohio State faces USC', 'Compared with Premier League rivalries', 'https://apnews.com/article/ap-college-football-picks-test'],
  ['NFL quarterback scores touchdown', 'Premier League comparison', 'https://sports.example.test/soccer/story'],
  ['College Football Club hosts NFL Super Bowl event', 'Soccer players attend', 'https://sports.example.test/news/story'],
  ["College football's new OC-QB pairings", 'Washington Huskies and USC Trojans', 'https://www.cbssports.com/college-football/news/test'],
  ['High-school flag football championship', 'Quarterback scores a touchdown', 'https://sports.example.test/flag-football'],
  ['Fantasy football rankings: Brock Bowers', 'The tight end is a top NFL pick', 'https://sports.example.test/fantasy-football'],
  ['Fitzmaurice confirmed as Galway football manager', "Fitzmaurice won three All-Irelands as a player with Kerry before managing the Kingdom to the 2014 title", 'https://www.bbc.com/sport/articles/c6r7d7587vpeo'],
  ['Washington Football Set to Face Former Starting LB Against USC', 'As the Huskies prepare to take on their first ranked opponent of the year, No. 18 USC, Jedd Fisch and his offense will game plan for a familiar face in fourth-year linebacker Deven Bryant', 'https://uwhuskieswire.usatoday.com/story/sports/college/huskies/football/2026/09/30/uw-football-washington-huskies-jedd-fisch-deven-bryant-transfer-portal-jacob-manu/91995707007/'],
  ['Fantasy Football Trade Tips: Try to get off the Omarion Hampton train as soon as you can', "Yes, the Browns game last weekend didn't go as planned and McMillan only came away with a pair of receptions and 17 yards, but most pass-catchers are susceptible to down weeks. The Panthers were", 'https://sports.yahoo.com/fantasy/article/fantasy-football-trade-tips-try-to-get-off-the-omarion-hampton-train-as-soon-as-you-can-180001405.html'],
  ["Texas AD calls out football viral celebrations 'embarrassing'", 'Texas athletic director Chris Del Conte publicly said he is not happy about the celebrations from the win over Tennessee.', 'https://www.usatoday.com/story/sports/ncaaf/sec/2026/09/30/texas-football-celebrations-embarrassing-chris-del-conte/92023777007/'],
  ['Video shows Maryland football’s Josiah Teasley putting ex-girlfriend on ground', 'Ring-camera footage shows Maryland football player Josiah Teasley grabbing his former girlfriend', 'https://www.baltimoresun.com/2026/09/30/maryland-football-josiah-teasley-assault-case-video/'],
  ["Grading college football's new OC-QB pairings", 'New coordinators and quarterbacks take the field', 'https://www.cbssports.com/college-football/news/new-oc-qb-pairings/'],
  ['USA TODAY Sports Super 25 high school flag football rankings, Week 6', 'High school flag football teams', 'https://www.usatoday.com/sports/high-school/flag-football/rankings/'],
  ['Fantasy Football: Brock Bowers is back — and he looks ready to break the game', 'Mackey Award winner returns', 'https://sports.yahoo.com/fantasy/article/brock-bowers/'],
];
for (const [headline, summary, sourceUrl] of rejected) assert.equal(isNonSoccerNews(headline, summary, sourceUrl), true, headline);
for (const [headline, summary, sourceUrl] of rejected) assert.equal(isSoccerEligibleNews(headline, summary, sourceUrl), false,headline);
for (const [headline, summary, sourceUrl] of [
  ['Liverpool football manager confirms transfer', 'Premier League fixture', 'https://sports.example.test/football/liverpool'],
  ['Galway United football manager confirms signing', 'League of Ireland soccer club', 'https://sports.example.test/soccer/galway-united'],
  ['College football star signs for Arsenal', 'Former university soccer player joins the Premier League', 'https://sports.example.test/soccer/arsenal'],
  ['Fantasy Football Premier League tips', 'FPL captain picks for Arsenal and Liverpool', 'https://sports.example.test/fantasy-premier-league'],
  ['Boy recovering after cardiac arrest during football game', 'Youth player was hit in the chest', 'https://www.ktvu.com/sports/boy-recovering-cardiac-arrest-football-game'],
  ["Walter Bowman: The Canadian who became the Football League's first foreign footballer", 'Accrington FC and the Football League', 'https://www.msn.com/sports/football/walter-bowman'],
]) assert.equal(isNonSoccerNews(headline, summary, sourceUrl), false, headline);
assert.equal(isSoccerEligibleNews('Boy, 11, recovering after going into cardiac arrest during football game: report','Youth player was hit in the chest during the game','https://www.ktvu.com/sports/boy-recovering-cardiac-arrest-football-game'),false,'ambiguous all-team football is not used automatically');
assert.equal(isSoccerEligibleNews('Boy, 11, recovering after going into cardiac arrest during football game: report','Youth player was hit in the chest during the game','https://www.ktvu.com/sports/boy-recovering-cardiac-arrest-football-game','specific_team'),true,'specific-team ambiguity remains reviewable after team matching');
assert.equal(isSoccerEligibleNews("Walter Bowman: The Canadian who became the Football League's first foreign footballer",'Accrington FC and the Football League','https://www.msn.com/sports/football/walter-bowman'),true);

const item=(headline,summary,sourceUrl,index)=>`<item><title>${headline}</title><description>${summary}</description><source>Fixture News</source><link>${sourceUrl}</link><pubDate>Thu, 01 Oct 2026 08:00:00 GMT</pubDate></item>`;
const rss=`<rss><channel>${rejected.map(([h,s,u],i)=>item(h,s,u,i)).join('')}${Array.from({length:15},(_,i)=>item(`Arsenal soccer update ${i}`, 'Premier League football club news', `https://sports.example.test/soccer/${i}`,i)).join('')}</channel></rss>`;
const parsed=parseNewsRss(rss,{newsDate:'2026-10-01'});
assert.equal(parsed.length,15,'rejected stories do not consume the 15 soccer slots');
assert.ok(parsed.every(story=>story.headline.startsWith('Arsenal')));

const productionJunkUrls=[
  'https://dims.apnews.com/dims4/default/94c503b/2147483647/strip/true/crop/640x236+0+0/resize/320x118!/quality/90/?url=https%3A%2F%2Fassets.apnews.com%2Fc3%2F4c%2F65482a7b452db66043542c093eaf%2Fpromo-2x.png',
  'https://assets.apnews.com/54/95/4fab11fc4f1bb6e1c6d486086a02/getitongoogleplay-badge-web-color-english.png',
  'https://assets.apnews.com/9f/14/e730153245ddbefdf1f69031adea/download-on-the-app-store-badge-us-uk-rgb-blk-01.png',
];
for(const source_url of productionJunkUrls){assert.equal(isLikelyContentImageUrl(source_url),false,'known junk URL is rejected before discovery');assert.equal(isDisplayEligibleImageCandidate({source_url,state:'candidate'}),false,'junk candidate never appears initially');assert.equal(isDisplayEligibleImageCandidate({source_url,state:'failed',error_message:'IMAGE_DECODE_OR_SIZE_INVALID'}),false,'terminal junk remains hidden')}
assert.equal(isLikelyContentImageUrl('https://media.example.test/news/football-photo.jpg?resize=1280%2C720'),true);
console.log('PASS v0.20.145 soccer classification and preflight candidate URL regression');

/* =========================================================================
   data.js: Build-A-Politician
   All static game data for the candidate creator and the election
   simulator. Nothing in this file touches the DOM. It is pure data plus
   a few small generator helpers.

   Candidate schema (v2). Every candidate (player-built, custom opponent,
   or pre-built roster character) uses exactly this shape:

     {
       name, age, party, occupation, state, topIssue, slogan, about,
       logoColor, prebuilt }
   ========================================================================= */

/* -------------------------------------------------------------------------
   Parties. Real party names are included because students will reach for
   them, plus a "create your own" escape hatch. The simulator is explicitly
   instructed not to advantage any one of these.
   ------------------------------------------------------------------------- */
const PARTIES = [
  { value: "Democrat", blurb: "Runs on the Democratic ticket." },
  { value: "Republican", blurb: "Runs on the Republican ticket." },
  { value: "Independent", blurb: "No party. Answers to voters only." },
  { value: "Libertarian", blurb: "Maximum personal and economic freedom." },
  { value: "Green", blurb: "Environment and social justice first." },
  { value: "Custom", blurb: "Invent your own party name." }
];

/* -------------------------------------------------------------------------
   Top issues: the single thing the candidate is known for.
   ------------------------------------------------------------------------- */
const TOP_ISSUES = [
  { value: "Economy", blurb: "Jobs, wages, prices, taxes." },
  { value: "Healthcare", blurb: "Coverage, costs, prescriptions." },
  { value: "Education", blurb: "Schools, teachers, college costs." },
  { value: "Immigration", blurb: "Borders, visas, citizenship." },
  { value: "Environment & Energy", blurb: "Climate, power, clean water." },
  { value: "Crime & Public Safety", blurb: "Policing, courts, safe streets." },
  { value: "National Security", blurb: "Defense, alliances, cyber threats." },
  { value: "Jobs & Workers", blurb: "Unions, trades, manufacturing." },
  { value: "Housing", blurb: "Rent, home prices, homelessness." },
  { value: "Technology & AI", blurb: "Innovation, privacy, automation." },
  { value: "Government Reform", blurb: "Corruption, term limits, spending." },
  { value: "Veterans", blurb: "Benefits, care, and jobs for vets." }
];

/* -------------------------------------------------------------------------
   Occupation tiles. Students can also type their own.
   ------------------------------------------------------------------------- */
const OCCUPATIONS = [
  { value: "Small Business Owner" },
  { value: "Teacher" },
  { value: "Doctor" },
  { value: "Nurse" },
  { value: "Military Veteran" },
  { value: "Lawyer" },
  { value: "Farmer" },
  { value: "Police Officer" },
  { value: "Firefighter" },
  { value: "Engineer" },
  { value: "Software Developer" },
  { value: "Construction Worker" },
  { value: "Factory Worker" },
  { value: "Journalist" },
  { value: "College Professor" },
  { value: "Nonprofit Director" },
  { value: "Pastor" },
  { value: "Scientist" },
  { value: "Accountant" },
  { value: "Mayor" },
  { value: "Truck Driver" },
  { value: "Athlete" },
  { value: "Custom" }
];

/* -------------------------------------------------------------------------
   The five guided questions for the "About Your Candidate" box. These are
   shown as clickable hint chips; clicking one drops a sentence starter
   into the textarea.
   ------------------------------------------------------------------------- */
const ABOUT_PROMPTS = [
  { q: "What kind of person are they?", starter: "NAME is a " },
  { q: "Why did they run for office?",  starter: "They ran for office because " },
  { q: "How do they lead?",             starter: "As a leader, NAME " },
  { q: "What makes them different?",    starter: "What sets NAME apart is " },
  { q: "How do voters view them?",      starter: "Supporters see NAME as ___, while critics say " }
];

/* The worked example from the project brief. Used by the "See an example"
   button on the create page. */
const EXAMPLE_CANDIDATE = {
  name: "John Carter",
  age: 46,
  party: "Independent",
  occupation: "Small Business Owner",
  state: "Texas",
  topIssue: "Economy",
  slogan: "Common Sense. Real Results.",
  about: "John Carter is a blunt, confident leader who believes politicians spend too much time arguing instead of solving problems. He built a successful business before entering politics and wants to bring a different approach to government. Supporters see him as honest and decisive, while critics see him as stubborn.",
  logoColor: "#b22234" };

const US_STATE_LIST = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
  "District of Columbia"
];

/* Rough regional grouping, used only by the offline fallback engine to
   add a little geographic texture. No real-world political meaning. */
const STATE_REGION = {
  "Alabama":"South","Alaska":"West","Arizona":"West","Arkansas":"South",
  "California":"West","Colorado":"West","Connecticut":"Northeast","Delaware":"Northeast",
  "Florida":"South","Georgia":"South","Hawaii":"West","Idaho":"West","Illinois":"Midwest",
  "Indiana":"Midwest","Iowa":"Midwest","Kansas":"Midwest","Kentucky":"South",
  "Louisiana":"South","Maine":"Northeast","Maryland":"Northeast","Massachusetts":"Northeast",
  "Michigan":"Midwest","Minnesota":"Midwest","Mississippi":"South","Missouri":"Midwest",
  "Montana":"West","Nebraska":"Midwest","Nevada":"West","New Hampshire":"Northeast",
  "New Jersey":"Northeast","New Mexico":"West","New York":"Northeast","North Carolina":"South",
  "North Dakota":"Midwest","Ohio":"Midwest","Oklahoma":"South","Oregon":"West",
  "Pennsylvania":"Northeast","Rhode Island":"Northeast","South Carolina":"South",
  "South Dakota":"Midwest","Tennessee":"South","Texas":"South","Utah":"West",
  "Vermont":"Northeast","Virginia":"South","Washington":"West","West Virginia":"South",
  "Wisconsin":"Midwest","Wyoming":"West","District of Columbia":"Northeast" };

/* Slogan generator word banks */
const SLOGAN_OPENERS = [
  "Forward Together", "A New Chapter", "Building Something Better", "Stronger",
  "Rise Up for", "The Future is", "Real Leadership for", "Restoring",
  "One Nation,", "Time for", "Common Sense.", "Enough Talk."
];
const SLOGAN_CLOSERS = [
  "for Every Family", "for a Brighter Tomorrow", "Starts Now", "with Us",
  "for the People", "for Main Street", "That Works", "for All of Us",
  "for the Next Generation", "Together", "Real Results.", "Let's Get to Work."
];

function generateRandomSlogan() {
  const o = SLOGAN_OPENERS[Math.floor(Math.random() * SLOGAN_OPENERS.length)];
  const c = SLOGAN_CLOSERS[Math.floor(Math.random() * SLOGAN_CLOSERS.length)];
  return o + " " + c; }

const FIRST_NAMES = ["Alex","Jordan","Morgan","Taylor","Casey","Riley","Sam","Jamie",
  "Avery","Quinn","Reese","Emerson","Rowan","Dakota","Skyler","Elliot","Marcus",
  "Nadia","Theo","Camila","Devon","Priya","Wesley","Imani"];
const LAST_NAMES = ["Winters","Hale","Prescott","Reyes","Whitfield","Barnett","Sinclair",
  "Delgado","Ashford","Monroe","Callahan","Ferris","Whitmore","Castellan","Beaumont",
  "Okafor","Nakamura","Vasquez","Lindqvist","Boyd"];

function generateRandomName() {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return f + " " + l; }

/* Campaign colors. Kept muted and few so a candidate card never fights
   the rest of the interface. */
const LOGO_COLOR_PALETTE = ["#b22234", "#233c56", "#8e1a29", "#2f7a4d", "#4a5b8c", "#7a6a3a"];

/* Personality fragments used by the "Surprise Me" random candidate button
   to assemble a coherent About paragraph. */
const RANDOM_TEMPERAMENTS = [
  "a plain-spoken, no-nonsense",
  "a warm, endlessly patient",
  "a restless, impatient",
  "a careful, detail-obsessed",
  "a fiery, unapologetic",
  "a quiet, steady",
  "an optimistic, relentlessly upbeat"
];
const RANDOM_MOTIVES = [
  "they watched their hometown lose its biggest employer",
  "they spent years cleaning up problems the government created",
  "every official they called told them nothing could be done",
  "their own kids were priced out of the town they grew up in",
  "they saw the same broken system fail people every single day at work"
];
const RANDOM_LEAD_STYLES = [
  "runs a meeting like a job site: short, direct, and finished on time",
  "refuses to vote on anything they have not read cover to cover",
  "brings the loudest critic in the room into the conversation first",
  "decides fast and takes the blame publicly when they get it wrong",
  "would rather build a slow consensus than win a fast argument"
];
const RANDOM_VIEWS = [
  "honest and refreshing, while critics call them stubborn",
  "principled and hardworking, while critics call them naive",
  "energetic and bold, while critics call them reckless",
  "thoughtful and fair, while critics call them indecisive",
  "authentic and grounded, while critics say they lack experience"
];

/* -------------------------------------------------------------------------
   25 fictional pre-built opponents.
   Every one is an ORIGINAL fictional character with an invented name and
   an invented party. None use the name or likeness of any real person.
   They share the exact schema produced by the builder so the simulator can
   treat them identically to a student-made candidate.
   ------------------------------------------------------------------------- */
function mk(name, age, party, occupation, state, topIssue, slogan, about) {
  return {
    id: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    name: name, age: age, party: party, occupation: occupation, state: state,
    topIssue: topIssue, slogan: slogan, about: about,
    logoColor: LOGO_COLOR_PALETTE[name.length % LOGO_COLOR_PALETTE.length],
    prebuilt: true }; }

const PREBUILT_POLITICIANS = [
  mk("Jack Thompson", 68, "Golden Freedom Party", "Business Executive", "New York", "Economy",
    "Make It Great Again",
    "Jack Thompson is a loud, combative dealmaker who spent forty years in real estate before deciding the country was being run badly by people who had never met a payroll. He ran because he believed career politicians had sold out American workers. He leads by instinct and rarely backs down from a fight. Supporters love that he says exactly what he thinks; critics say he never admits a mistake."),
  mk("Michael Carter", 47, "Unity Coalition", "Nonprofit Director", "Illinois", "Healthcare",
    "Hope and Change",
    "Michael Carter is a calm, deliberate speaker who built his career organizing neighborhoods that politicians had written off. He ran because he watched families ration medicine while insurance profits climbed. He leads by building broad coalitions and talking people out of their corners. Supporters find him inspiring; critics say he explains more than he delivers."),
  mk("William Harris", 76, "Working Families Party", "Career Legislator", "Delaware", "Jobs & Workers",
    "Restoring the Soul of the Nation",
    "William Harris has spent most of his adult life in public office and knows every committee chair by first name. He ran because he believed the country needed steadiness more than excitement. He leads by working the phones and cutting deals in private. Supporters trust his experience; critics say he is a product of the very system he promises to fix."),
  mk("Thomas Walker", 70, "Liberty & Prosperity Party", "Mayor", "California", "Economy",
    "Morning in America",
    "Thomas Walker is a natural performer who can make a budget speech feel like a pep rally. He ran because he thought government had grown too large to be accountable to anyone. He leads by setting a simple direction and letting his cabinet handle the details. Supporters find him reassuring; critics say the optimism papers over hard tradeoffs."),
  mk("Nathan Adams", 57, "Founders' Party", "Military Veteran", "Virginia", "National Security",
    "A Union Worth Fighting For",
    "Nathan Adams is a disciplined career officer who is visibly uncomfortable with applause. He ran only after being asked repeatedly, believing it was a duty rather than an ambition. He leads through chain-of-command clarity and expects the same of everyone around him. Supporters see unmatched integrity; critics say he treats a democracy like a battalion."),
  mk("Daniel Brooks", 79, "People's Progress Party", "College Professor", "Vermont", "Healthcare",
    "Not Me, Us",
    "Daniel Brooks is a blunt, rumpled populist who has been making the same argument for forty years and never softened it. He ran because he believes the economy is rigged toward people who already have everything. He leads by rallying crowds rather than courting colleagues. Supporters admire that he cannot be bought; critics say he cannot compromise either."),
  mk("Samuel Grant", 52, "National Union Party", "Lawyer", "Kentucky", "Government Reform",
    "A House United",
    "Samuel Grant is a self-taught country lawyer with a gift for defusing a room with a story. He ran because he believed a divided nation would not survive another decade of shouting. He leads by listening far longer than anyone expects, then deciding firmly. Supporters call him the most decent man in politics; critics say decency is not a policy."),
  mk("Henry Marshall", 42, "Progressive Rough Riders Party", "Mayor", "New York", "Government Reform",
    "A Square Deal for All",
    "Henry Marshall is a hyperactive reformer who treats every day as an opportunity to break something that needs breaking. He ran because he watched a handful of companies write the rules for everyone else. He leads loudly, publicly, and without waiting for permission. Supporters find him thrilling; critics say he mistakes motion for progress."),
  mk("Edward Franklin", 51, "New Deal Coalition", "Lawyer", "New York", "Economy",
    "The Only Thing We Have to Fear",
    "Edward Franklin is a patrician optimist who learned patience the hard way through a long illness. He ran during a crisis because he thought fear was doing more damage than the crisis itself. He leads by talking directly to the public and experimenting until something works. Supporters credit him with saving the country; critics say he concentrated too much power."),
  mk("James Sullivan", 43, "New Frontier Party", "Military Veteran", "Massachusetts", "Technology & AI",
    "Ask What You Can Do",
    "James Sullivan is a young, quick-witted war veteran who is at his best under pressure and in front of a camera. He ran because he thought the country was drifting while rivals raced ahead. He leads by surrounding himself with sharp advisers and demanding they argue in front of him. Supporters find him magnetic; critics say the glamour outpaces the record."),
  mk("Robert Collins", 56, "Silent Majority Party", "Lawyer", "California", "Crime & Public Safety",
    "Law and Order",
    "Robert Collins is a brilliant, guarded strategist who has never quite trusted anyone in the room. He ran because he believed ordinary people were being ignored in favor of whoever protested loudest. He leads through tight control and a very small circle. Supporters credit real results abroad; critics say the secrecy eventually consumed him."),
  mk("David Cooper", 52, "Peanut Farmers Alliance", "Farmer", "Georgia", "Environment & Energy",
    "A Government as Good as Its People",
    "David Cooper is an earnest engineer-turned-farmer who reads every briefing himself and answers his own mail. He ran because he thought Washington had lost the trust of the people paying for it. He leads by mastering detail, sometimes at the cost of the big picture. Supporters call him the most honest man to hold the office; critics say he could not manage Congress."),
  mk("Christopher Evans", 54, "Compassionate Union Party", "Small Business Owner", "Texas", "Education",
    "A Uniter, Not a Divider",
    "Christopher Evans is an easygoing, backslapping Texan who is far more disciplined than he lets on. He ran promising to end the partisan food fight and focus on schools. He leads by picking a handful of goals and delegating everything else. Supporters find him likeable and steady; critics say he leaned too hard on the people around him."),
  mk("Andrew Mitchell", 46, "New Democrat Alliance", "Lawyer", "Arkansas", "Economy",
    "Building a Bridge to Tomorrow",
    "Andrew Mitchell is a policy obsessive with a small-town charm that plays in any room in the country. He ran because he believed his party had stopped speaking to working families. He leads by absorbing every detail and negotiating relentlessly. Supporters call him the best retail politician of his generation; critics say his personal conduct undercut everything."),
  mk("Victoria Lewis", 59, "Forward Horizon Party", "Lawyer", "California", "Crime & Public Safety",
    "For the People",
    "Victoria Lewis is a sharp, exacting former prosecutor who is most comfortable cross-examining a witness. She ran because she believed the justice system worked well for some people and failed everyone else. She leads by preparing harder than anyone in the room. Supporters admire her toughness; critics say her record does not match her rhetoric."),
  mk("Rebecca Turner", 68, "Glass Ceiling Coalition", "Lawyer", "New York", "Healthcare",
    "Stronger Together",
    "Rebecca Turner is a relentlessly prepared policy veteran who has been in public life so long that voters think they already know her. She ran because she believed she was the only person with the experience to do the job on day one. She leads through detailed plans and institutional knowledge. Supporters call her the most qualified candidate in decades; critics say she has never connected emotionally."),
  mk("Harold Whitmore", 68, "Silent Generation Party", "Farmer", "Missouri", "Government Reform",
    "Steady as She Goes",
    "Harold Whitmore is a plain, unhurried man who still keeps his own ledger by hand. He ran because he thought the federal budget had stopped resembling anything a family would recognize. He leads by refusing to be rushed and saying no more often than yes. Supporters trust him completely; critics say he is out of step with a faster country."),
  mk("Franklin Osgood", 50, "Coastal Reform Party", "College Professor", "Massachusetts", "Environment & Energy",
    "A Fresh Wind Blowing",
    "Franklin Osgood is a cerebral former diplomat who thinks in decades rather than news cycles. He ran because he believed climate policy was being handed to whoever shouted about it most recently. He leads by convening experts and refusing to oversimplify. Supporters value the seriousness; critics say he sounds like a seminar."),
  mk("Gregory Vance", 61, "Heartland Values Party", "Mayor", "Ohio", "Jobs & Workers",
    "Faith, Family, Freedom",
    "Gregory Vance is a small-town mayor who still answers his own phone on the first ring. He ran because he watched three factories close and no one in either party seemed to notice. He leads by showing up in person, constantly. Supporters find him genuine and rooted; critics say he has no experience beyond a town of nine thousand."),
  mk("Patricia Reyes", 55, "New Horizons Party", "Lawyer", "New Mexico", "Immigration",
    "Lifting Every Voice",
    "Patricia Reyes is a civil rights attorney who spent twenty years suing the government she now wants to run. She ran because she believed immigration policy had become a talking point instead of a plan. She leads by putting the affected people in the room before the lobbyists. Supporters call her fearless; critics say she is an activist, not an administrator."),
  mk("Douglas Kerrigan", 63, "Industrial Heartland Party", "Factory Worker", "Michigan", "Jobs & Workers",
    "Bring the Jobs Home",
    "Douglas Kerrigan is a former line worker and union organizer with a handshake like a vice grip. He ran because he negotiated too many contracts that ended in layoffs anyway. He leads the way he bargained: bluntly, patiently, and never blinking first. Supporters see one of their own; critics say he is fighting an economy that no longer exists."),
  mk("Eleanor Vance", 49, "Suburban Alliance Party", "Small Business Owner", "Colorado", "Housing",
    "Common Sense, Common Ground",
    "Eleanor Vance is a practical business owner who got into politics after a zoning fight she did not expect to win. She ran because her employees could not afford to live in the town they worked in. She leads by finding the version of a plan that everyone can live with. Supporters like that she is not a lifer; critics say she avoids taking hard positions."),
  mk("Marcus Delaney", 39, "Bright Future Party", "Software Developer", "Washington", "Technology & AI",
    "Innovate. Include. Inspire.",
    "Marcus Delaney is a young founder who built and sold two companies before he turned thirty-five. He ran because he believed lawmakers were regulating technology they had never used. He leads by shipping fast, measuring, and changing his mind in public. Supporters find him refreshingly modern; critics say governing is not a startup."),
  mk("Rosalind Bennett", 58, "Prairie Independence Party", "Farmer", "Nebraska", "Environment & Energy",
    "Rooted in the Land",
    "Rosalind Bennett is a fourth-generation rancher who speaks slowly and means every word. She ran because water and land policy were being written by people who had never worked either. She leads by consulting the people who will live with the decision. Supporters call her the most grounded voice in the race; critics say her focus is too narrow for a national office."),
  mk("Theodore Ashcombe", 66, "Constitutional Guard Party", "Lawyer", "Texas", "Government Reform",
    "Return to First Principles",
    "Theodore Ashcombe is a former judge and constitutional scholar who quotes founding documents from memory and expects you to keep up. He ran because he believed both parties had stopped caring what the law actually says. He leads by argument, not persuasion. Supporters call him the last principled man in the country; critics say he is rigid to the point of uselessness.")
];

/* Expose everything as a single namespace to avoid polluting globals. */
if (typeof window !== "undefined") {
  window.GameData = {
    PARTIES: PARTIES,
    TOP_ISSUES: TOP_ISSUES,
    OCCUPATIONS: OCCUPATIONS,
    ABOUT_PROMPTS: ABOUT_PROMPTS,
    EXAMPLE_CANDIDATE: EXAMPLE_CANDIDATE,
    US_STATE_LIST: US_STATE_LIST,
    STATE_REGION: STATE_REGION,
    LOGO_COLOR_PALETTE: LOGO_COLOR_PALETTE,
    PREBUILT_POLITICIANS: PREBUILT_POLITICIANS,
    RANDOM_TEMPERAMENTS: RANDOM_TEMPERAMENTS,
    RANDOM_MOTIVES: RANDOM_MOTIVES,
    RANDOM_LEAD_STYLES: RANDOM_LEAD_STYLES,
    RANDOM_VIEWS: RANDOM_VIEWS,
    generateRandomSlogan: generateRandomSlogan,
    generateRandomName: generateRandomName }; }

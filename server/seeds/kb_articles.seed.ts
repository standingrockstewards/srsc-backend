/**
 * server/seeds/kb_articles.seed.ts  (Brick 10j)
 *
 * Upserts at least 2 KB articles per category (18 total across 9 categories).
 * Safe to re-run: INSERT … ON CONFLICT (id) DO UPDATE preserves existing data
 * while refreshing body/tags/title if the seed changes.
 *
 * Deterministic IDs: kbart_<cat>_01, kbart_<cat>_02, etc.
 * Category IDs: kbcat_bait, kbcat_duck, kbcat_fish, kbcat_hunt,
 *               kbcat_lake, kbcat_prop, kbcat_rods, kbcat_scope, kbcat_weather
 *
 * Run: npx tsx server/seeds/kb_articles.seed.ts
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://srsc_db_user:dorn07GvLwOz3JPwz9mHFpdmSnfcW6pn@dpg-d9keftm1egvs738988jg-a.oregon-postgres.render.com/srsc_db?sslmode=require";

interface ArticleSeed {
  id:           string;
  category_id:  string;
  title:        string;
  slug:         string;
  body_md:      string;
  tags:         string[];
  asset_type:   string;
  status:       "published";
  author_id:    string;
  author_name:  string;
  published_at: string;  // ISO string
}

const NOW = new Date().toISOString();

const ARTICLES: ArticleSeed[] = [

  // ── Lake Life (kbcat_lake) ─────────────────────────────────────────────────
  {
    id:          "kbart_lake_01",
    category_id: "kbcat_lake",
    title:       "Understanding Lake Eufaula Water Levels",
    slug:        "lake-eufaula-water-levels",
    body_md: `## Why Water Levels Matter

Lake Eufaula (Robert S. Kerr Reservoir) is managed by the Army Corps of Engineers and can fluctuate several feet seasonally. Understanding these changes helps you plan dock access, boat launches, and shoreline maintenance.

## Seasonal Patterns

- **Spring (March–May):** Levels typically rise due to rainfall and upstream inflow from the Canadian River. Watch for floating debris near docks.
- **Summer (June–August):** Levels stabilize. Peak recreation season. Monitor evaporation drawdown in dry years.
- **Fall (Sept–Nov):** Controlled releases begin. Excellent fishing but some ramps may go shallow.
- **Winter (Dec–Feb):** Minimum pool maintained. Dock inspections are easiest when water is low.

## Monitoring Resources

The Corps of Engineers posts daily pool elevation data at [swt.usace.army.mil](https://www.swt.usace.army.mil). Target pool elevation is 585 ft MSL (full pool). Flood pool is 594 ft MSL.

## What Your Stewardship Plan Includes

SRSC monitors your dock clearance and ramp accessibility as part of routine visits. If elevation drops below your dock's lower limit, we'll flag it in your Signal Flare alerts.`,
    tags:        ["water levels", "dock care", "Corps of Engineers", "seasonal"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_lake_02",
    category_id: "kbcat_lake",
    title:       "Dock Maintenance Checklist — Spring & Fall",
    slug:        "dock-maintenance-checklist",
    body_md: `## Twice-a-Year Dock Inspections

A well-maintained dock protects your investment and keeps your family safe. SRSC performs these inspections as part of your stewardship plan, but here's what we look for.

## Spring Checklist

- **Decking:** Check for cracked, warped, or soft boards. Replace any with visible rot.
- **Flotation:** Inspect foam billets or barrels for waterlogging or damage.
- **Hardware:** Re-torque all through-bolts and hinge plates after winter freeze-thaw cycles.
- **Bumpers:** Replace cracked or missing rubber bumpers along finger piers.
- **Electrical:** Test GFI outlets and dock lighting. Confirm shore power is properly bonded.
- **Anchoring:** Verify all anchor cables and auger anchors are tensioned correctly.

## Fall Checklist

- **Winterization:** Remove personal watercraft lifts if water levels are expected to drop.
- **Cover:** Install dock cover system if you own one.
- **Lines:** Replace worn dock lines before winter storms.
- **Debris:** Clear accumulated leaves and algae from decking to prevent slip hazards.

> **Tip:** Photos taken during each inspection are stored in your SRSC portal for insurance documentation.`,
    tags:        ["dock", "maintenance", "seasonal", "inspection"],
    asset_type:  "how-to",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Fishing (kbcat_fish) ───────────────────────────────────────────────────
  {
    id:          "kbart_fish_01",
    category_id: "kbcat_fish",
    title:       "Top 5 Fish Species at Lake Eufaula",
    slug:        "top-fish-species-lake-eufaula",
    body_md: `## What You'll Find in Lake Eufaula

Lake Eufaula is one of Oklahoma's premier fishing destinations with over 100,000 surface acres. Here are the five species that draw the most anglers.

## 1. Largemouth Bass

The king of Eufaula fishing. Spawns in April–May along rocky points and flooded timber. Best patterns: Texas-rigged creature baits in summer, crankbaits and lipless rattlebaits in fall.

## 2. Striped Bass & Hybrid Stripers

Stripers run 5–25 lbs and school heavily near the dam and river channels. Umbrella rigs, live shad, and large swimbaits produce in cooler months. Often caught at night under lights.

## 3. White Bass / Sand Bass

The most abundant gamefish in the lake. Explosive topwater action during "runs" in spring when they chase shad to the surface. Small white jigs and crankbaits work year-round.

## 4. Crappie

Exceptional crappie fishery. Brush piles in 10–18 ft of water hold fish year-round. Tube jigs and live minnows under lights produce limits after dark.

## 5. Catfish

Blue and channel cats up to 40+ lbs. Best near the dam and river channel ledges. Fresh cut shad or chicken liver on the bottom after dark.

## Oklahoma Regulations

A valid Oklahoma fishing license is required. Current limits and size minimums are posted at [wildlifedepartment.com](https://www.wildlifedepartment.com).`,
    tags:        ["bass", "crappie", "stripers", "catfish", "species"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_fish_02",
    category_id: "kbcat_fish",
    title:       "Fishing Seasonal Calendar — Lake Eufaula",
    slug:        "fishing-seasonal-calendar-lake-eufaula",
    body_md: `## When to Fish What

Timing your trips to match fish behavior dramatically improves your success rate.

## January – February (Winter)
- **Best species:** Crappie (slow-pitch near brush), stripers (deep channel jigging)
- **Water temp:** 42–52°F. Fish are lethargic. Slow presentations win.
- **Tip:** Fish south-facing coves that warm up first on sunny days.

## March – April (Pre-Spawn)
- **Best species:** Largemouth bass (staging on secondary points), crappie (moving to shallows)
- **Water temp:** 55–65°F. The best bass fishing of the year begins.
- **Tip:** Jerkbaits and swimbaits on main-lake points.

## May – June (Spawn & Post-Spawn)
- **Best species:** Bass on beds in 2–6 ft, white bass runs on flats
- **Water temp:** 65–78°F. Topwater action is excellent at dawn.

## July – August (Summer)
- **Best species:** Night fishing for catfish, deep bass on ledges (18–25 ft), stripers at dawn
- **Water temp:** 82–88°F. Fish go deep or feed at night.

## September – October (Fall Turnover)
- **Best species:** All species — the second-best season of the year
- **Water temp:** 65–75°F. Bass chase shad to the surface on main-lake points.

## November – December (Late Fall)
- **Best species:** Stripers, crappie, big bass on deep brush
- **Water temp:** 52–62°F. Last chance for topwater before cold sets in.`,
    tags:        ["seasonal", "bass", "crappie", "stripers", "catfish", "calendar"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Bait & Tackle (kbcat_bait) ────────────────────────────────────────────
  {
    id:          "kbart_bait_01",
    category_id: "kbcat_bait",
    title:       "Live Bait Guide — Lake Eufaula",
    slug:        "live-bait-guide-lake-eufaula",
    body_md: `## Live Bait That Produces at Eufaula

Fresh live bait consistently outperforms artificials for several species at Lake Eufaula.

## Threadfin & Gizzard Shad

The #1 forage fish in the lake. Used live for striped bass and hybrids. Cast-net shad at dawn near creek channel points. Keep in a round livewell with an aerator — shad die quickly in square livewells or low oxygen.

**Tip:** Gizzard shad hold up better than threadfin in heat. Hook through the nose or back just behind the dorsal.

## Crawfish (Crawdads)

Deadly for largemouth bass from March through June. Find them under rocks in shallow coves. Hook through the tail and fish them on a Carolina rig or drop shot near rocky points and riprap.

## Nightcrawlers / Worms

The universal bait. Best for catfish, white bass, and crappie. Store in a cool, moist container. Change out dead ones frequently — fresh worms produce significantly better.

## Minnows

Fathead minnows are the go-to for crappie. Buy from any local tackle shop. Hook through the back (not through the spine) under a slip float at the depth fish are holding.

## Where to Get Bait Near Eufaula

Several bait shops along Highway 69 carry live shad, minnows, and crawfish during the season. SRSC can advise on current availability during your visit prep.`,
    tags:        ["live bait", "shad", "minnows", "crawfish", "crappie", "bass"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_bait_02",
    category_id: "kbcat_bait",
    title:       "Top Lure Picks for Lake Eufaula Bass",
    slug:        "top-lures-lake-eufaula-bass",
    body_md: `## Must-Have Lures for Eufaula Bass

These artificial lures have proven track records on Lake Eufaula across all seasons.

## Lipless Crankbaits (Fall & Winter)

A 1/2 oz red or chrome lipless rattlebait retrieved over submerged grass in 4–8 ft of water is one of the most consistent patterns in fall. Rip it through the grass, pause, and hang on.

## Texas-Rigged Soft Plastics (Summer)

When it's hot, go heavy and slow. A 3/4 oz bullet sinker with a 10" straight tail worm in green pumpkin or black-blue. Fish it in 15–25 ft of water on main-lake ledges.

## Shallow Squarebill Crankbaits (Spring)

A 1.5 or 2.5 squarebill in crawfish colors deflecting off riprap and wood is a spring staple. Chartreuse with brown is a Eufaula local favorite.

## Topwater Poppers (Dawn, Summer & Fall)

A walk-the-dog topwater or popper worked over main-lake flats at first light produces explosive strikes from largemouth and stripers. Work it slowly in calm water.

## Jigs (Year-Round)

A 3/8 or 1/2 oz football jig with a trailer is the most versatile presentation for big bass. Drag it on points, ledges, and hard-bottom areas. Green pumpkin with an orange craw trailer is a confidence choice.

## Tube Jigs (Crappie)

1/16 to 1/8 oz tube jigs in chartreuse, white, or pink dropped vertically into brush piles in 12–18 ft produce limits of crappie.`,
    tags:        ["lures", "bass", "crappie", "crankbaits", "jigs", "topwater"],
    asset_type:  "tip",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Rods & Reels (kbcat_rods) ─────────────────────────────────────────────
  {
    id:          "kbart_rods_01",
    category_id: "kbcat_rods",
    title:       "Choosing a Rod for Lake Eufaula Fishing",
    slug:        "choosing-fishing-rod-lake-eufaula",
    body_md: `## Matching Your Rod to the Technique

The right rod makes a significant difference in sensitivity, hook-setting power, and cast accuracy. Here's how to think about rod selection for common Eufaula techniques.

## Bass Fishing

**Flipping/Pitching (Heavy Cover):** 7'3" to 7'6" heavy power, fast action baitcaster. You need backbone to pull bass out of thick timber and grass mats.

**Crankbaits:** 7'0" medium power, moderate action. A softer tip loads the rod and prevents ripping the bait out of the fish's mouth on treble hooks.

**Drop Shot / Drop Shaker:** 6'10" to 7'0" medium-light spinning rod, fast action. Sensitivity is key to feeling light bites at depth.

**Topwater:** 7'0" medium power, moderate-fast action baitcaster. Moderate tip helps with walking-the-dog cadence.

## Striper Fishing

**Trolling or Live Bait:** 7'0" to 7'6" heavy-power rod with a solid backbone. Stripers over 15 lbs require serious pulling power.

## Crappie Fishing

**Brush Pile Drop:** Ultra-light to light power, 5'6" to 6'0". A long crappie pole (10'–14') is effective for lowering jigs vertically without tangles.

## Rod Material

- **Graphite (High-Modulus):** Most sensitive; good for finesse techniques
- **Fiberglass Composite:** More flex; great for crankbaits and topwater
- **Carbon Fiber Blend:** Versatile all-rounder

## Budget Tips

You don't need to spend $400 on a rod. Brands like St. Croix Triumph, Ugly Stik Elite, and Lew's Custom Pro offer excellent performance in the $60–$120 range.`,
    tags:        ["rod selection", "bass", "crappie", "stripers", "technique"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_rods_02",
    category_id: "kbcat_rods",
    title:       "Reel Maintenance — Keeping Your Gear Lake-Ready",
    slug:        "reel-maintenance-lake-ready",
    body_md: `## Why Reel Maintenance Matters

A poorly maintained reel causes backlashes, line breaks, and missed fish. A clean, lubricated reel casts farther and lasts years longer.

## Baitcasting Reel — After Each Trip

1. Wipe down the exterior with a damp cloth to remove salt, grime, and sunscreen residue.
2. Rinse lightly with fresh water if used in saltwater or extremely dirty conditions.
3. Apply one drop of reel oil to each side plate bearing access port.
4. Check the drag washers — if they feel gritty, a full service is due.

## Spinning Reel — After Each Trip

1. Clean the bail arm pivot points with a cotton swab.
2. Apply a thin film of grease to the bail spring.
3. Check line roller bearing — a rough feel means it needs replacement.
4. Re-spool if line has significant memory coils or visible UV damage.

## Full Service (Once per Season)

- Disassemble the gear side.
- Clean all gears with isopropyl alcohol.
- Apply fresh grease to all gear teeth and the worm gear.
- Replace worn drag washers.
- Reassemble and test drag at 30% of line test weight.

## Recommended Products

- **Oil:** Ardent Reel Oil or Penn Rod & Reel Oil
- **Grease:** Cal's Universal Reel Grease
- **Cleaner:** Isopropyl alcohol (91%+) on cotton swabs

> **Tip:** Keep a small maintenance kit in your boat console. Quick field maintenance after a full day prevents corrosion from setting in overnight.`,
    tags:        ["reel", "maintenance", "baitcaster", "spinning", "gear care"],
    asset_type:  "how-to",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Duck Hunting (kbcat_duck) ─────────────────────────────────────────────
  {
    id:          "kbart_duck_01",
    category_id: "kbcat_duck",
    title:       "Duck Hunting at Lake Eufaula — Season Overview",
    slug:        "duck-hunting-lake-eufaula-season-overview",
    body_md: `## Oklahoma Duck Season Basics

Oklahoma offers excellent waterfowl hunting, and the shallow coves, flooded timber, and creek arms of Lake Eufaula provide prime habitat. The Oklahoma duck season typically runs in two segments from late November through late January, with specific dates set annually by ODWC based on USFWS frameworks.

## Key Species at Eufaula

- **Mallards:** Primary target. Stage heavily in flooded timber and agricultural fields adjacent to the lake.
- **Teal (Blue-wing & Green-wing):** Early teal season opens in September before the main duck season. Fast fliers that respond well to spinning-wing decoys.
- **Ringnecks & Scaup:** Dive ducks found on open water. Target them from a layout boat or point blind.
- **Wood Ducks:** Year-round residents of the timber. Morning flights along creek channels.
- **Gadwall & Wigeon:** Common in mixed bags. Prefer flooded vegetation.

## Licensing Requirements

- Oklahoma Hunting License
- Federal Duck Stamp (required for all waterfowl hunters 16+)
- Oklahoma Waterfowl Stamp
- HIP Certification (free, done at license purchase)

## On Your Property

If your SRSC-managed property includes access to coves or creek arms, we can assess hunting potential and help identify blind locations as part of a seasonal consultation.`,
    tags:        ["duck hunting", "mallards", "teal", "season", "Oklahoma"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_duck_02",
    category_id: "kbcat_duck",
    title:       "Decoy Spreads & Blind Setup for Timber Hunting",
    slug:        "decoy-spread-blind-setup-timber-hunting",
    body_md: `## Hunting Flooded Timber at Eufaula

Flooded timber hunting is one of the most exciting and productive waterfowl experiences available at Lake Eufaula. The key is positioning — in timber, ducks land in the hole, not on the water's edge.

## Creating the Landing Hole

- Clear a 15–20 foot diameter hole in the decoys in front of your blind position.
- Ducks will work to that open water. Your shots are straight down as they set their wings.
- Don't make the hole too large — it loses the natural funnel effect.

## Decoy Spread in Timber

- **Total count:** 18–24 mallard decoys is plenty. Timber chokes long shots anyway.
- **Placement:** Loose J or C shape around the hole. Avoid straight lines.
- **Motion:** One or two spinning-wing decoys (Mojo Mallard) on the outer edge. Remove them once birds are working nearby — shy ducks flare from spinners at close range.
- **Floaters vs. Fakes:** Full-body floaters in timber-dark water look more natural than foam decoys.

## Blind Setup

- Position your blind so the wind is at your back or quartering — ducks land into the wind.
- Trim shoot-hole openings the day before. Freshly cut timber smells natural.
- Use natural camo materials from the site. Avoid shiny surfaces.

## Calling in Timber

A basic three-note hail call and feeding chuckle is all you need. Over-calling in timber spooks birds. When they're cupped and dropping — stop calling.`,
    tags:        ["duck hunting", "decoys", "blind setup", "timber", "calling"],
    asset_type:  "how-to",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── General Hunting (kbcat_hunt) ──────────────────────────────────────────
  {
    id:          "kbart_hunt_01",
    category_id: "kbcat_hunt",
    title:       "Whitetail Deer Hunting — Eastern Oklahoma",
    slug:        "whitetail-deer-hunting-eastern-oklahoma",
    body_md: `## Deer Hunting Near Lake Eufaula

The hardwood and river-bottom country surrounding Lake Eufaula holds excellent populations of whitetail deer. Pitchfork County and surrounding areas offer a mix of public land (mostly McAlester Army Ammunition Plant buffer lands) and private properties.

## Season Structure (Oklahoma)

- **Archery:** October 1 – January 15
- **Primitive Firearm:** Muzzleloader-only period (dates vary annually)
- **Rifle:** November — check ODWC for current zone-specific dates
- **Youth Season:** Weekend before rifle season opens

A valid Oklahoma hunting license and deer license are required. Check the current ODWC regulations at wildlifedepartment.com before each season.

## Habitat Near the Lake

- **River Bottoms:** Thick cover along the Canadian River and its tributaries. Deer funnel through these corridors between bedding and feeding areas.
- **Oak Ridges:** White and red oak ridges adjacent to the lake shed mast in October. Set up downwind of oak flats during the rut.
- **Agriculture:** Wheat and soybean fields on adjacent private land draw deer at first and last light.

## Rut Timing

The Oklahoma rut typically peaks in late November to early December in the Eufaula area. Pre-rut scrape activity begins around Halloween. Chasing and breeding peaks around Thanksgiving week.

## Property Access

If your SRSC-managed property includes wooded areas, we can note deer sign, trail camera locations, and stand opportunities during routine visits.`,
    tags:        ["whitetail", "deer", "rut", "Oklahoma", "archery", "rifle"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_hunt_02",
    category_id: "kbcat_hunt",
    title:       "Wild Turkey Hunting — Spring Season Tips",
    slug:        "wild-turkey-hunting-spring-season",
    body_md: `## Oklahoma Spring Turkey Season

Oklahoma's spring turkey season runs from early April through late May and offers some of the best Eastern wild turkey hunting in the South Central region. McIntosh, Pittsburg, and Haskell counties — all bordering Lake Eufaula — produce quality birds each year.

## Where to Find Birds

- **River Bottoms:** Toms roost over water and fly down to hardwood flats. Set up along roost trees at first light.
- **Pasture Edges:** Birds strut in open fields and pastures adjacent to timber. A full-strut decoy visible from distance brings longbeards in.
- **Ridgeline Hardwoods:** Birds work from roost down to benches. Find strutting areas by locating feathers and droppings.

## Calling Sequence

1. **Pre-dawn:** Locate roosting birds by owl hooting or box call on roost. Listen for shock gobbles.
2. **At first light:** Position 150–200 yards from the roost tree. Begin with soft tree yelps.
3. **After fly-down:** Switch to aggressive cutting and cackling if a bird is hung up.
4. **Midday:** Hens leave. A lonely hen yelp sequence and patient setup often produces a longbeard looking for one more date.

## Equipment

- **Shotgun:** 12-gauge with a full or extra-full turkey choke. #4, #5, or #6 TSS loads.
- **Calls:** Box call, slate/glass pot call, mouth diaphragm.
- **Decoy:** Hen + jake combo is the most aggressive setup.

## Regulations

A valid Oklahoma hunting license and turkey license are required. Check ODWC for current limits (typically 2 birds per season in spring) and legal shooting hours (30 minutes before sunrise to sunset).`,
    tags:        ["turkey", "spring season", "calling", "decoys", "Oklahoma"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Optics & Scopes (kbcat_scope) ─────────────────────────────────────────
  {
    id:          "kbart_scope_01",
    category_id: "kbcat_scope",
    title:       "Choosing a Rifle Scope for Deer Season",
    slug:        "choosing-rifle-scope-deer-season",
    body_md: `## How to Select the Right Scope

A quality optic is one of the most important investments a hunter makes. Here's how to think about scope selection for deer hunting in the timber and field environments around Lake Eufaula.

## Magnification

For most Oklahoma deer hunting at 25–200 yards, a variable 3-9x40 or 2-7x35 scope covers everything. If you're shooting open fields at 200–350 yards, a 4-12x44 or 4-14x44 gives you more precision at distance.

**Avoid over-magnification** for timber hunting — a 20x scope at 40 yards is unusable. The rule: your maximum magnification should not exceed the typical shooting distance in yards divided by 10.

## Objective Lens Size

The second number in a scope's specification (e.g., 3-9**x40**) is the objective lens diameter in millimeters. Larger objectives gather more light in low-light conditions (dawn/dusk). For deer hunting, 40mm–44mm is the sweet spot.

## Reticle Types

- **Duplex/Plex:** Simple crosshair. Best for hunters who want a clean sight picture.
- **BDC (Bullet Drop Compensator):** Sub-tension marks for holdover at 200–500 yards. Useful if you practice at distance.
- **Illuminated:** Red or green lit reticle for low-light. Useful for dawn deer hunting.

## Budget Ranges

- **$100–$250:** Vortex Crossfire II, Nikon Prostaff — reliable, fog-proof, lifetime warranties
- **$250–$500:** Vortex Diamondback HD, Leupold VX-Freedom — noticeably better glass
- **$500+:** Leupold VX-3HD, Nightforce SHV — heirloom quality

## Mounting

A quality scope ring set is as important as the scope itself. Misaligned or loose rings cause zero loss. Loctite 242 on ring screws (not base screws) prevents backing out under recoil.`,
    tags:        ["scope", "rifle", "deer hunting", "optics", "magnification"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_scope_02",
    category_id: "kbcat_scope",
    title:       "Binoculars for Hunting & Lake Property Use",
    slug:        "binoculars-hunting-lake-property",
    body_md: `## Why Binoculars Matter on a Lake Property

Good binoculars serve double duty at a lake property — glassing deer at distance and scanning your shoreline, dock, and neighbors' activity from across the cove.

## Magnification & Field of View

**8x42** is the standard recommendation for most users — stable handheld, wide field of view (400+ ft at 1000 yards), and adequate light transmission for dawn use.

**10x42** gives more reach but a narrower field and more hand-shake at distance. Best for open country or glassing large fields.

**12x50+** should be mounted on a tripod or truck window mount. Too heavy and shaky for extended handheld use.

## Glass Quality

The most important factor. Better glass (ED or HD glass elements) produces sharper, higher-contrast images at dawn and dusk when deer and ducks are most active.

- **Entry level ($100–$200):** Vortex Diamondback HD 8x42, Nikon Prostaff — good for casual use
- **Mid range ($200–$500):** Vortex Viper HD, Leupold BX-4 — noticeably better edge-to-edge sharpness
- **Premium ($500+):** Swarovski EL, Leica Noctivid — best available low-light performance

## For Waterfowl Hunters

8x32 compact binoculars fit in a blind bag or chest waders pocket. Smaller objective is fine — most duck hunting happens at dawn with some ambient light. Waterproof and fog-proof rating is essential.

## Care & Maintenance

- Store in a dry bag or case — humidity causes internal fogging on cheaper binoculars.
- Clean lenses only with lens-specific microfiber — never paper towels.
- Check eyecup positioning — diopter adjustment should match your eyes for best focus.`,
    tags:        ["binoculars", "optics", "glassing", "waterfowl", "deer"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Property Care (kbcat_prop) ────────────────────────────────────────────
  {
    id:          "kbart_prop_01",
    category_id: "kbcat_prop",
    title:       "Shoreline Management at Lake Eufaula",
    slug:        "shoreline-management-lake-eufaula",
    body_md: `## Protecting Your Shoreline Investment

Shoreline erosion is the #1 long-term threat to lake property values at Eufaula. Wave action, boat wakes, and water level fluctuations all contribute to bank loss. A proactive stewardship plan addresses these threats before they become expensive.

## Riprap & Rock Armor

The most effective erosion control. Limestone or granite riprap placed at the base of your bank dissipates wave energy. Properly sized stone (6"–12" in diameter for most residential applications) stays in place through flood events.

**SRSC Service:** We photograph and document riprap condition on every visit, noting displacement or void areas that need re-dressing before the next flood season.

## Native Shoreline Plantings

Native emergent plants like cattails, sedges, and native willows stabilize bank soil with their root systems. They also provide wildlife habitat. A 3–5 foot planted buffer between your lawn and the water's edge dramatically reduces erosion.

**Species to plant:** Buttonbush, native willow, river cane, American lotus, rushes.
**Avoid:** Bermuda grass to the water's edge — it provides zero erosion protection.

## Seawalls

Steel, concrete, or vinyl sheet pile seawalls provide hard armoring. They work well but require permits from the Army Corps of Engineers for installation at Eufaula. SRSC can document the permit application process.

## What We Monitor

During each stewardship visit, SRSC records:
- Bank erosion measurements at flagged reference points
- Riprap displacement or void areas
- Invasive species encroachment (water hyacinth, giant salvinia)
- Dock anchor stability as it relates to bank condition`,
    tags:        ["shoreline", "erosion", "riprap", "native plants", "stewardship"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_prop_02",
    category_id: "kbcat_prop",
    title:       "Vacancy Security Checklist — Lake Property",
    slug:        "vacancy-security-checklist-lake-property",
    body_md: `## Keeping Your Property Secure When You're Away

Most lake property break-ins and vandalism occur during extended vacancies — between Memorial Day and Labor Day weekend visits, or during the winter. A layered approach to security is the most effective deterrent.

## Physical Security

- **Deadbolts:** Install grade-1 deadbolts on all entry doors. Standard builder deadbolts (grade-3) are easily defeated.
- **Door frames:** Reinforce door frames with steel strike plates and 3" screws into studs — most kick-ins defeat the frame, not the lock.
- **Outbuildings:** Boat houses, storage sheds, and garages should have padlocks on hasps AND a barrel bolt on the inside when occupied.
- **Dock:** Remove or lock down portable items. A deterrent is better than a magnet.

## Lighting

- Install motion-activated LED flood lights on all corners of the structure.
- Leave interior lights on a timer randomized schedule — consistent on/off schedules broadcast vacancy.

## Alarm Systems

SRSC can coordinate alarm system installation and monitoring as an add-on service. We document contact with monitoring companies in your service record.

## During SRSC Visits

Every scheduled visit includes:
- Full exterior perimeter walk with photo documentation
- Verification of all entry points (door locks, window latches, garage doors)
- Condition report filed in your client portal
- Immediate Signal Flare alert if any security breach is found

> **If something looks wrong between visits:** Use the Signal Flare button in your client portal to request an emergency check visit. We will respond within 24 hours.`,
    tags:        ["security", "vacancy", "break-in", "alarm", "property care"],
    asset_type:  "how-to",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },

  // ── Weather & Storms (kbcat_weather) ──────────────────────────────────────
  {
    id:          "kbart_weather_01",
    category_id: "kbcat_weather",
    title:       "Storm Preparedness — Lake Eufaula Property Guide",
    slug:        "storm-preparedness-lake-eufaula",
    body_md: `## Oklahoma Severe Weather & Your Lake Property

Eastern Oklahoma lies in the heart of Tornado Alley. Severe thunderstorms, tornadoes, and hail are all genuine threats to lake properties from March through October. Preparing your property in advance significantly reduces damage and recovery costs.

## Pre-Season Checklist (March)

- **Trees:** Have an arborist remove dead or overhanging limbs within fall distance of the structure. Dead elms and cottonwoods adjacent to the water drop unpredictably in storms.
- **Roof:** Inspect shingles and gutters after winter. Loose shingles become projectiles in high wind.
- **Generators:** Test your standby generator. Change oil and run under load for 30 minutes. Stock 5–10 gallons of stabilized fuel.
- **Dock:** Check all anchor cables and inspect flotation. A dock that breaks free in a flood can take out neighbor's docks and become a liability.
- **Shutters/Panels:** Confirm storm shutters are accessible and in good condition.

## During a Severe Thunderstorm Warning

- Get off the water immediately — lightning kills more people on lakes than any other weather event.
- Secure loose items on the dock (chairs, life vests, equipment).
- Move boats to the most protected slip orientation (bow into likely wind direction).

## Post-Storm Protocol

SRSC performs post-storm inspections within 72 hours of any severe weather event affecting the Eufaula area. We document damage to your property and file a report in your client portal. If significant damage is found, a Signal Flare alert is sent immediately.

## When to File an Insurance Claim

Document everything before cleanup:
- Photograph all damage from multiple angles
- Do not discard damaged materials before the adjuster visits
- Contact SRSC — we can provide visit records and condition photos from prior visits as evidence of pre-storm condition`,
    tags:        ["storm", "tornado", "preparedness", "severe weather", "Oklahoma"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
  {
    id:          "kbart_weather_02",
    category_id: "kbcat_weather",
    title:       "Flood Response — Protecting Your Property During High Water",
    slug:        "flood-response-high-water-lake-eufaula",
    body_md: `## When the Lake Rises: High Water Response

Lake Eufaula can rise 3–5 feet in 48 hours during major rain events on the Canadian River watershed. Knowing what to do before, during, and after a flood event protects your property and belongings.

## Before High Water (Watch / Warning Stage)

When pool elevation is forecast to exceed 587 ft MSL (2 ft above full pool):

1. **Move vehicles** uphill — parking on the road above the flood line.
2. **Elevate valuables** inside the structure to the highest floor or countertops.
3. **Secure the dock** — add extra lines and check anchor tension. Remove any loose items.
4. **Document pre-flood condition** with photos for insurance purposes.
5. **Contact SRSC** — we can provide a pre-event check visit on short notice.

## During Flood Stage

- Do not enter flood water on foot or by vehicle. Moving water at 6 inches depth can knock an adult down; 12 inches floats a vehicle.
- Monitor the Army Corps of Engineers flood operations gauge — they post hourly readings during flood events.
- If staying on site: keep a battery backup and NOAA weather radio operational.

## Post-Flood Cleanup

- **Wait for receding water** to fully drain before entering lower-floor areas — silt and contamination remain after water recedes.
- **Check electrical systems** before restoring power — have an electrician inspect anything that was submerged.
- **Silt removal** from dock, boat house, and hardscaping. SRSC can coordinate cleanup crews as part of your stewardship plan.
- **Mold prevention** — dry out all wet materials within 48 hours. Deploy dehumidifiers in enclosed spaces.

## SRSC Flood Response Service

SRSC provides post-flood property inspections with condition reports and damage documentation. Contact us through your client portal Signal Flare for expedited response.`,
    tags:        ["flood", "high water", "storm response", "cleanup", "insurance"],
    asset_type:  "guide",
    status:      "published",
    author_id:   "srsc",
    author_name: "SRSC Team",
    published_at: NOW,
  },
];

// ── Upsert function ────────────────────────────────────────────────────────────

async function runSeed() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  let inserted = 0;
  let updated  = 0;

  try {
    const client = await pool.connect();
    try {
      for (const art of ARTICLES) {
        const result = await client.query(
          `INSERT INTO kb_articles
             (id, category_id, title, slug, body_md, tags, asset_type,
              status, author_id, author_name, published_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
           ON CONFLICT (id) DO UPDATE SET
             title        = EXCLUDED.title,
             slug         = EXCLUDED.slug,
             body_md      = EXCLUDED.body_md,
             tags         = EXCLUDED.tags,
             asset_type   = EXCLUDED.asset_type,
             status       = EXCLUDED.status,
             author_name  = EXCLUDED.author_name,
             published_at = COALESCE(kb_articles.published_at, EXCLUDED.published_at),
             updated_at   = now()
           RETURNING (xmax = 0) AS was_inserted`,
          [
            art.id,
            art.category_id,
            art.title,
            art.slug,
            art.body_md,
            art.tags,          // pg driver sends string[] as array literal
            art.asset_type,
            art.status,
            art.author_id,
            art.author_name,
            art.published_at,
          ],
        );
        if (result.rows[0]?.was_inserted) inserted++;
        else updated++;
      }

      const countRow = await client.query("SELECT COUNT(*) FROM kb_articles WHERE status = 'published'");
      const total    = parseInt(countRow.rows[0].count as string, 10);

      console.log(`\nKB seed complete.`);
      console.log(`  Inserted: ${inserted}`);
      console.log(`  Updated:  ${updated}`);
      console.log(`  Total published articles: ${total}`);

      if (total < 18) {
        console.error(`ERROR: expected >= 18 published articles, got ${total}`);
        process.exit(1);
      }

      // Verify all category_ids are valid
      const badRows = await client.query(
        `SELECT id, category_id FROM kb_articles
         WHERE category_id NOT IN (SELECT id FROM kb_categories)`,
      );
      if (badRows.rowCount && badRows.rowCount > 0) {
        console.error(`ERROR: ${badRows.rowCount} articles have invalid category_id:`, badRows.rows);
        process.exit(1);
      }

      console.log("  Category ID validation: PASSED");
      console.log("\nDone.\n");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

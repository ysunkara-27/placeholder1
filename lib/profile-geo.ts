export interface GeoTreeNode {
  slug: string;
  label: string;
  aliases?: string[];
  children?: GeoTreeNode[];
}

const GEO_TREE: GeoTreeNode[] = [
  {
    slug: "geo.north_america",
    label: "North America",
    aliases: ["north america"],
    children: [
      {
        slug: "geo.north_america.usa",
        label: "United States",
        aliases: ["united states", "usa", "us", "u.s."],
        children: [
          {
            slug: "geo.north_america.usa.northeast",
            label: "Northeast",
            aliases: ["northeast"],
            children: [
              {
                slug: "geo.north_america.usa.northeast.new_york",
                label: "New York",
                aliases: ["new york", "ny"],
                children: [
                  {
                    slug: "geo.north_america.usa.northeast.new_york.new_york_city",
                    label: "New York City",
                    aliases: ["new york city", "nyc", "manhattan"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.northeast.massachusetts",
                label: "Massachusetts",
                aliases: ["massachusetts", "ma"],
                children: [
                  {
                    slug: "geo.north_america.usa.northeast.massachusetts.boston",
                    label: "Boston",
                    aliases: ["boston"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.northeast.pennsylvania",
                label: "Pennsylvania",
                aliases: ["pennsylvania", "pa"],
                children: [
                  {
                    slug: "geo.north_america.usa.northeast.pennsylvania.pittsburgh",
                    label: "Pittsburgh",
                    aliases: ["pittsburgh"],
                  },
                  {
                    slug: "geo.north_america.usa.northeast.pennsylvania.philadelphia",
                    label: "Philadelphia",
                    aliases: ["philadelphia", "philly"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.northeast.new_jersey",
                label: "New Jersey",
                aliases: ["new jersey", "nj"],
              },
              {
                slug: "geo.north_america.usa.northeast.connecticut",
                label: "Connecticut",
                aliases: ["connecticut", "ct"],
              },
            ],
          },
          {
            slug: "geo.north_america.usa.south",
            label: "South",
            aliases: ["south", "southern united states"],
            children: [
              {
                slug: "geo.north_america.usa.south.texas",
                label: "Texas",
                aliases: ["texas", "tx"],
                children: [
                  {
                    slug: "geo.north_america.usa.south.texas.austin",
                    label: "Austin",
                    aliases: ["austin"],
                  },
                  {
                    slug: "geo.north_america.usa.south.texas.dallas",
                    label: "Dallas",
                    aliases: ["dallas"],
                  },
                  {
                    slug: "geo.north_america.usa.south.texas.houston",
                    label: "Houston",
                    aliases: ["houston"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.south.georgia",
                label: "Georgia",
                aliases: ["georgia", "ga"],
                children: [
                  {
                    slug: "geo.north_america.usa.south.georgia.atlanta",
                    label: "Atlanta",
                    aliases: ["atlanta"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.south.florida",
                label: "Florida",
                aliases: ["florida", "fl"],
                children: [
                  {
                    slug: "geo.north_america.usa.south.florida.miami",
                    label: "Miami",
                    aliases: ["miami"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.south.north_carolina",
                label: "North Carolina",
                aliases: ["north carolina", "nc"],
                children: [
                  {
                    slug: "geo.north_america.usa.south.north_carolina.raleigh",
                    label: "Raleigh",
                    aliases: ["raleigh", "raleigh-durham"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.south.virginia",
                label: "Virginia",
                aliases: ["virginia", "va"],
                children: [
                  {
                    slug: "geo.north_america.usa.south.virginia.washington_dc",
                    label: "Washington, DC",
                    aliases: ["washington dc", "dc", "washington d.c."],
                  },
                ],
              },
            ],
          },
          {
            slug: "geo.north_america.usa.midwest",
            label: "Midwest",
            aliases: ["midwest"],
            children: [
              {
                slug: "geo.north_america.usa.midwest.illinois",
                label: "Illinois",
                aliases: ["illinois", "il"],
                children: [
                  {
                    slug: "geo.north_america.usa.midwest.illinois.chicago",
                    label: "Chicago",
                    aliases: ["chicago"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.midwest.michigan",
                label: "Michigan",
                aliases: ["michigan", "mi"],
                children: [
                  {
                    slug: "geo.north_america.usa.midwest.michigan.detroit",
                    label: "Detroit",
                    aliases: ["detroit"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.midwest.ohio",
                label: "Ohio",
                aliases: ["ohio", "oh"],
                children: [
                  {
                    slug: "geo.north_america.usa.midwest.ohio.columbus",
                    label: "Columbus",
                    aliases: ["columbus"],
                  },
                ],
              },
            ],
          },
          {
            slug: "geo.north_america.usa.west",
            label: "West",
            aliases: ["west", "western united states"],
            children: [
              {
                slug: "geo.north_america.usa.west.california",
                label: "California",
                aliases: ["california", "ca"],
                children: [
                  {
                    slug: "geo.north_america.usa.west.california.san_francisco_bay_area",
                    label: "San Francisco Bay Area",
                    aliases: ["san francisco", "bay area", "san francisco bay area", "sf"],
                  },
                  {
                    slug: "geo.north_america.usa.west.california.los_angeles",
                    label: "Los Angeles",
                    aliases: ["los angeles", "la"],
                  },
                  {
                    slug: "geo.north_america.usa.west.california.san_diego",
                    label: "San Diego",
                    aliases: ["san diego"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.west.washington",
                label: "Washington",
                aliases: ["washington", "wa"],
                children: [
                  {
                    slug: "geo.north_america.usa.west.washington.seattle",
                    label: "Seattle",
                    aliases: ["seattle"],
                  },
                ],
              },
              {
                slug: "geo.north_america.usa.west.colorado",
                label: "Colorado",
                aliases: ["colorado", "co"],
                children: [
                  {
                    slug: "geo.north_america.usa.west.colorado.denver",
                    label: "Denver",
                    aliases: ["denver"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "geo.north_america.canada",
        label: "Canada",
        aliases: ["canada"],
        children: [
          {
            slug: "geo.north_america.canada.ontario",
            label: "Ontario",
            aliases: ["ontario", "on"],
            children: [
              {
                slug: "geo.north_america.canada.ontario.toronto",
                label: "Toronto",
                aliases: ["toronto"],
              },
            ],
          },
          {
            slug: "geo.north_america.canada.british_columbia",
            label: "British Columbia",
            aliases: ["british columbia", "bc"],
            children: [
              {
                slug: "geo.north_america.canada.british_columbia.vancouver",
                label: "Vancouver",
                aliases: ["vancouver"],
              },
            ],
          },
          {
            slug: "geo.north_america.canada.quebec",
            label: "Quebec",
            aliases: ["quebec", "qc"],
            children: [
              {
                slug: "geo.north_america.canada.quebec.montreal",
                label: "Montreal",
                aliases: ["montreal"],
              },
            ],
          },
          {
            slug: "geo.north_america.canada.alberta",
            label: "Alberta",
            aliases: ["alberta", "ab"],
            children: [
              {
                slug: "geo.north_america.canada.alberta.calgary",
                label: "Calgary",
                aliases: ["calgary"],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "geo.europe",
    label: "Europe",
    aliases: ["europe"],
    children: [
      {
        slug: "geo.europe.united_kingdom",
        label: "United Kingdom",
        aliases: ["united kingdom", "uk", "great britain"],
        children: [
          {
            slug: "geo.europe.united_kingdom.london",
            label: "London",
            aliases: ["london"],
          },
        ],
      },
      {
        slug: "geo.europe.germany",
        label: "Germany",
        aliases: ["germany"],
        children: [
          {
            slug: "geo.europe.germany.berlin",
            label: "Berlin",
            aliases: ["berlin"],
          },
          {
            slug: "geo.europe.germany.munich",
            label: "Munich",
            aliases: ["munich"],
          },
        ],
      },
      {
        slug: "geo.europe.netherlands",
        label: "Netherlands",
        aliases: ["netherlands", "holland"],
        children: [
          {
            slug: "geo.europe.netherlands.amsterdam",
            label: "Amsterdam",
            aliases: ["amsterdam"],
          },
        ],
      },
      {
        slug: "geo.europe.france",
        label: "France",
        aliases: ["france"],
        children: [
          {
            slug: "geo.europe.france.paris",
            label: "Paris",
            aliases: ["paris"],
          },
        ],
      },
      {
        slug: "geo.europe.ireland",
        label: "Ireland",
        aliases: ["ireland"],
        children: [
          {
            slug: "geo.europe.ireland.dublin",
            label: "Dublin",
            aliases: ["dublin"],
          },
        ],
      },
      {
        slug: "geo.europe.switzerland",
        label: "Switzerland",
        aliases: ["switzerland"],
        children: [
          {
            slug: "geo.europe.switzerland.zurich",
            label: "Zurich",
            aliases: ["zurich"],
          },
        ],
      },
      {
        slug: "geo.europe.sweden",
        label: "Sweden",
        aliases: ["sweden"],
        children: [
          {
            slug: "geo.europe.sweden.stockholm",
            label: "Stockholm",
            aliases: ["stockholm"],
          },
        ],
      },
      {
        slug: "geo.europe.spain",
        label: "Spain",
        aliases: ["spain"],
        children: [
          {
            slug: "geo.europe.spain.barcelona",
            label: "Barcelona",
            aliases: ["barcelona"],
          },
        ],
      },
    ],
  },
  {
    slug: "geo.asia",
    label: "Asia Pacific",
    aliases: ["asia", "asia pacific", "apac"],
    children: [
      {
        slug: "geo.asia.singapore",
        label: "Singapore",
        aliases: ["singapore"],
      },
      {
        slug: "geo.asia.japan",
        label: "Japan",
        aliases: ["japan"],
        children: [
          {
            slug: "geo.asia.japan.tokyo",
            label: "Tokyo",
            aliases: ["tokyo"],
          },
        ],
      },
      {
        slug: "geo.asia.south_korea",
        label: "South Korea",
        aliases: ["south korea", "korea"],
        children: [
          {
            slug: "geo.asia.south_korea.seoul",
            label: "Seoul",
            aliases: ["seoul"],
          },
        ],
      },
      {
        slug: "geo.asia.hong_kong",
        label: "Hong Kong",
        aliases: ["hong kong"],
      },
      {
        slug: "geo.asia.australia",
        label: "Australia",
        aliases: ["australia"],
        children: [
          {
            slug: "geo.asia.australia.sydney",
            label: "Sydney",
            aliases: ["sydney"],
          },
        ],
      },
      {
        slug: "geo.asia.india",
        label: "India",
        aliases: ["india"],
        children: [
          {
            slug: "geo.asia.india.bangalore",
            label: "Bangalore",
            aliases: ["bangalore", "bengaluru"],
          },
        ],
      },
      {
        slug: "geo.asia.china",
        label: "China",
        aliases: ["china"],
        children: [
          {
            slug: "geo.asia.china.shanghai",
            label: "Shanghai",
            aliases: ["shanghai"],
          },
        ],
      },
    ],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function collectNodes(nodes: GeoTreeNode[], acc: GeoTreeNode[] = []): GeoTreeNode[] {
  for (const node of nodes) {
    acc.push(node);
    if (node.children?.length) {
      collectNodes(node.children, acc);
    }
  }
  return acc;
}

const ALL_NODES = collectNodes(GEO_TREE);
const NODE_BY_SLUG = new Map(ALL_NODES.map((node) => [node.slug, node]));

const PARENT_BY_SLUG = new Map<string, string>();
for (const node of ALL_NODES) {
  for (const child of node.children ?? []) {
    PARENT_BY_SLUG.set(child.slug, node.slug);
  }
}

const ALIAS_TO_SLUG = new Map<string, string>();
for (const node of ALL_NODES) {
  ALIAS_TO_SLUG.set(normalize(node.label), node.slug);
  for (const alias of node.aliases ?? []) {
    ALIAS_TO_SLUG.set(normalize(alias), node.slug);
  }
}

export function getGeoRootNodes() {
  return GEO_TREE;
}

export function getGeoNode(slug: string) {
  return NODE_BY_SLUG.get(slug) ?? null;
}

export function getGeoNodeChildren(slug?: string | null) {
  if (!slug) return GEO_TREE;
  return NODE_BY_SLUG.get(slug)?.children ?? [];
}

export function getGeoNodePath(slug: string) {
  const path: GeoTreeNode[] = [];
  let current = NODE_BY_SLUG.get(slug) ?? null;
  while (current) {
    path.unshift(current);
    const parentSlug = PARENT_BY_SLUG.get(current.slug);
    current = parentSlug ? NODE_BY_SLUG.get(parentSlug) ?? null : null;
  }
  return path;
}

export function getGeoPathLabel(slug: string) {
  const path = getGeoNodePath(slug);
  if (path.length === 0) return slug;
  return path.map((node) => node.label).join(" > ");
}

export function getGeoLeafLabel(slug: string) {
  return NODE_BY_SLUG.get(slug)?.label ?? slug;
}

export function getGeoSearchTerms(value: string) {
  const slug = normalizeStoredLocationSelection(value);
  if (!slug) {
    return value.trim() ? [value.trim()] : [];
  }

  const path = getGeoNodePath(slug);
  const terms = [
    ...path.map((node) => node.label),
    ...path.flatMap((node) => node.aliases ?? []),
  ];

  return Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean)));
}

export function normalizeStoredLocationSelection(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (NODE_BY_SLUG.has(trimmed)) {
    return trimmed;
  }

  return ALIAS_TO_SLUG.get(normalize(trimmed)) ?? null;
}

export function isGeoAncestorSelection(ancestorSlug: string, descendantSlug: string) {
  if (ancestorSlug === descendantSlug) return true;
  return descendantSlug.startsWith(`${ancestorSlug}.`);
}

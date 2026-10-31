export type CardType = 'bar' | 'line' | 'pie' | 'table' | 'json' | 'metric' | 'text';
export type CardPriority = 'big' | 'medium' | 'small';

export interface LandCoordinate {
  id: string;
  lat: number;
  lng: number;
  title: string;
  val: string;
  priority: CardPriority;
  type: CardType;
  region: string;
}

export const LAND_COORDINATES: LandCoordinate[] = [
  // North America
  { id: 'na-sf', lat: 37.7749, lng: -122.4194, title: 'SYSTEM_LOG', val: '192.168.1.1', priority: 'big', type: 'metric', region: 'NA' },
  { id: 'na-ny', lat: 40.7128, lng: -74.0060, title: 'REVENUE_Q3', val: '$4.2M', priority: 'big', type: 'bar', region: 'NA' },
  { id: 'na-tor', lat: 43.6532, lng: -79.3832, title: 'TRAFFIC_CA', val: '+18% MoM', priority: 'medium', type: 'line', region: 'NA' },
  { id: 'na-mex', lat: 19.4326, lng: -99.1332, title: 'LATENCY_MX', val: '24ms', priority: 'small', type: 'metric', region: 'NA' },
  { id: 'na-sea', lat: 47.6062, lng: -122.3321, title: 'NODE_WA', val: 'Active', priority: 'medium', type: 'text', region: 'NA' },
  // Arctic / far north
  { id: 'na-anc', lat: 61.2181, lng: -149.9003, title: 'NODE_AK', val: 'Standby', priority: 'small', type: 'metric', region: 'NA' },
  { id: 'na-yzf', lat: 62.4540, lng: -114.3718, title: 'LATENCY_YT', val: '55ms', priority: 'small', type: 'metric', region: 'NA' },
  { id: 'na-nuk', lat: 64.1836, lng: -51.7214, title: 'NODE_GL', val: 'Online', priority: 'small', type: 'text', region: 'NA' },
  // Europe
  { id: 'eu-ld', lat: 51.5074, lng: -0.1278, title: 'TRAFFIC_EU', val: '+24% YoY', priority: 'big', type: 'bar', region: 'EU' },
  { id: 'eu-stk', lat: 59.3293, lng: 18.0686, title: 'METRIC_SE', val: '99.7%', priority: 'medium', type: 'line', region: 'EU' },
  { id: 'eu-mos', lat: 55.7558, lng: 37.6173, title: 'QUERY_RU', val: '640K req', priority: 'big', type: 'table', region: 'EU' },
  // Asia
  { id: 'as-tk', lat: 35.6762, lng: 139.6503, title: 'NODE_JP', val: 'Active', priority: 'big', type: 'metric', region: 'AS' },
  { id: 'as-bl', lat: 39.9042, lng: 116.4074, title: 'TRAFFIC_CN', val: '+31% YoY', priority: 'big', type: 'bar', region: 'AS' },
  { id: 'as-in', lat: 17.3850, lng: 78.4867, title: 'LATENCY_IN', val: '12ms', priority: 'medium', type: 'metric', region: 'AS' },
  { id: 'as-sg', lat: 1.3521, lng: 103.8198, title: 'INSIGHT_SG', val: '+14% Q3', priority: 'medium', type: 'pie', region: 'AS' },
  { id: 'as-seo', lat: 37.5665, lng: 126.9780, title: 'QUERY_KR', val: '850K req', priority: 'small', type: 'table', region: 'AS' },
  // Oceania
  { id: 'oc-sy', lat: -33.8688, lng: 151.2093, title: 'METRIC_AU', val: '99.9%', priority: 'big', type: 'line', region: 'OC' },
  // Africa
  { id: 'af-ct', lat: -33.9249, lng: 18.4241, title: 'TRAFFIC_ZA', val: '+11% MoM', priority: 'medium', type: 'bar', region: 'AF' },
  { id: 'af-cai', lat: 30.0444, lng: 31.2357, title: 'QUERY_EG', val: '320K req', priority: 'medium', type: 'json', region: 'AF' },
];

export const SNAP_RADIUS_PX = 120;

export interface LatLng {
  lat: number;
  lng: number;
}

// Land-based points used only as arc origins — separate from the card hover points
export const ARC_ORIGIN_POINTS: LatLng[] = [
  { lat: 34.0522, lng: -118.2437 }, { lat: 41.8781, lng: -87.6298 },
  { lat: 29.7604, lng: -95.3698 },  { lat: 49.2827, lng: -123.1207 },
  { lat: 25.7617, lng: -80.1918 },  { lat: 4.7110, lng: -74.0721 },
  { lat: -12.0464, lng: -77.0428 }, { lat: -33.4489, lng: -70.6693 },
  { lat: -22.9068, lng: -43.1729 }, { lat: 40.4168, lng: -3.7038 },
  { lat: 41.9028, lng: 12.4964 },   { lat: 52.2297, lng: 21.0122 },
  { lat: 48.2082, lng: 16.3738 },   { lat: 37.9838, lng: 23.7275 },
  { lat: 55.7558, lng: 37.6173 },   { lat: 59.9139, lng: 10.7522 },
  { lat: 53.3498, lng: -6.2603 },   { lat: -1.2921, lng: 36.8219 },
  { lat: 33.5731, lng: -7.5898 },   { lat: -26.2041, lng: 28.0473 },
  { lat: 9.0300, lng: 38.7400 },    { lat: 5.6037, lng: -0.1870 },
  { lat: 19.0760, lng: 72.8777 },   { lat: 28.6139, lng: 77.2090 },
  { lat: -6.2088, lng: 106.8456 },  { lat: 14.5995, lng: 120.9842 },
  { lat: 21.0285, lng: 105.8542 },  { lat: 24.8607, lng: 67.0011 },
  { lat: 35.6892, lng: 51.3890 },   { lat: 24.7136, lng: 46.6753 },
  { lat: 47.8864, lng: 106.9057 },  { lat: 55.0084, lng: 82.9357 },
  { lat: -31.9505, lng: 115.8605 }, { lat: -36.8485, lng: 174.7633 },
  { lat: -9.4438, lng: 147.1803 },  { lat: 61.2181, lng: -149.9003 }, // Anchorage, AK
  { lat: 64.8378, lng: -147.7164 }, // Fairbanks, AK
  { lat: 60.7212, lng: -135.0568 }, // Whitehorse, Yukon
  { lat: 62.4540, lng: -114.3718 }, // Yellowknife, Canada
  { lat: 63.7467, lng: -68.5170 },  // Iqaluit, Canada
  { lat: 64.1836, lng: -51.7214 },  // Nuuk, Greenland
  { lat: 64.1466, lng: -21.9426 },  // Reykjavik, Iceland
  { lat: 69.6492, lng: 18.9553 },   // Tromsø, Norway
  { lat: 68.9585, lng: 33.0827 },   // Murmansk, Russia
];

export interface CardTemplate {
  title: string;
  val: string;
  type: CardType;
  priority: CardPriority;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  { title: 'REVENUE_Q3', val: '$4.2M', type: 'bar', priority: 'big' },
  { title: 'TRAFFIC_EU', val: '+24% YoY', type: 'bar', priority: 'medium' },
  { title: 'TRAFFIC_CN', val: '+31% YoY', type: 'bar', priority: 'big' },
  { title: 'TRAFFIC_ZA', val: '+11% MoM', type: 'bar', priority: 'small' },
  { title: 'METRIC_SE', val: '99.7%', type: 'line', priority: 'medium' },
  { title: 'METRIC_AU', val: '99.9%', type: 'line', priority: 'big' },
  { title: 'TRAFFIC_CA', val: '+18% MoM', type: 'line', priority: 'medium' },
  { title: 'INSIGHT_PE', val: 'Growth +9%', type: 'line', priority: 'small' },
  { title: 'INSIGHT_SG', val: '+14% Q3', type: 'pie', priority: 'medium' },
  { title: 'METRIC_AR', val: '99.2%', type: 'pie', priority: 'small' },
  { title: 'ALLOC_MIX', val: '3 regions', type: 'pie', priority: 'medium' },
  { title: 'QUERY_FR', val: '1.2M req', type: 'table', priority: 'big' },
  { title: 'QUERY_KR', val: '850K req', type: 'table', priority: 'small' },
  { title: 'QUERY_RU', val: '640K req', type: 'table', priority: 'big' },
  { title: 'QUERY_EG', val: '320K req', type: 'json', priority: 'medium' },
  { title: 'QUERY_BR', val: '200 OK', type: 'json', priority: 'big' },
  { title: 'STATUS_PING', val: '204 OK', type: 'json', priority: 'small' },
  { title: 'NODE_DE', val: 'Online', type: 'metric', priority: 'medium' },
  { title: 'NODE_JP', val: 'Active', type: 'metric', priority: 'big' },
  { title: 'NODE_AK', val: 'Standby', type: 'metric', priority: 'small' },
  { title: 'LATENCY_NL', val: '8ms', type: 'metric', priority: 'small' },
  { title: 'LATENCY_IN', val: '12ms', type: 'metric', priority: 'medium' },
  { title: 'NODE_GL', val: 'Online', type: 'text', priority: 'small' },
  { title: 'EVENT_LOG', val: 'sync complete', type: 'text', priority: 'medium' },
];
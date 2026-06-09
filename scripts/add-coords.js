#!/usr/bin/env node
// Adds lat/lng to retreats.json using a known-coordinates lookup table.
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, '..', 'data', 'retreats.json');

// id → [lat, lng]
const COORDS = {
  // Andalucía
  'shanti-som-wellbeing-retreat':      [36.619, -4.730],
  'malaga-hills-wellness':             [36.845, -3.997],
  'harmony-home-wellness':             [36.873, -4.115],
  'el-carmen-yoga-house':              [36.748, -5.161],
  'b-bou-hotel-la-vinuela-spa':        [36.891, -4.158],
  'dragonfly-retreat-malaga':          [36.660, -4.760],
  'el-lodge-ski-spa-sierra-nevada':    [37.054, -3.367],
  'finca-alvaita-sierra-nevada':       [37.050, -3.370],
  'luxury-dome-retreat-granada':       [37.210, -3.520],
  'cortijo-de-la-seda':               [37.177, -3.599],
  'cortijo-tayula':                    [36.889, -3.424],
  'casas-rurales-benarum':             [36.928, -3.217],
  'mdd4-health-experience-sevilla':    [37.389, -5.985],
  'surfer-tarifa':                     [36.014, -5.604],
  'la-residencia-puerto-tarifa':       [36.014, -5.604],
  'finca-barral-sevilla':              [37.389, -5.985],
  'sierra-el-retiro-sevilla':          [37.350, -5.900],
  'finca-la-calderera-jaen':           [37.780, -3.790],
  'cortijo-la-joya-cabo-de-gata':      [36.802, -2.166],
  // Islas Baleares
  'es-raco-darta-mallorca':            [39.699, 3.346],
  'cal-reiet-holistic-retreat':        [39.355, 3.130],
  'finca-serena-mallorca':             [39.568, 3.019],
  'finca-rural-es-turo':               [39.318, 3.012],
  'zoetry-mallorca-wellness':          [39.525, 2.699],
  'ibiza-yoga-villa-nova-1':           [39.077, 1.473],
  'ibiza-yoga-villa-roca-5':           [39.077, 1.473],
  'ibiza-yoga-meditation-hut':         [39.006, 1.525],
  'shavasana-yoga-retreats':           [38.907, 1.421],
  'audax-spa-wellness-centre':         [39.933, 3.958],
  'hostal-entre-pinos':                [38.728, 1.487],
  'menorca-experimental':              [39.883, 4.268],
  'fontenille-menorca':                [39.983, 4.083],
  // Islas Canarias
  'surf-yoga-fuerteventura':           [28.670, -13.921],
  'surf-yoga-fuerteventura-la-oliva':  [28.623, -13.938],
  'studio-agua-surf-yoga-fuerteventura': [28.100, -14.217],
  'appartement-aire-surf-yoga-fuerteventura': [28.100, -14.217],
  'puresurfcamps-surflodge-fuerteventura': [28.623, -13.938],
  'nirvana-yoga-lanzarote':            [28.963, -13.550],
  'botanico-oriental-spa-tenerife':    [28.415, -16.547],
  'oceano-health-spa-tenerife':        [28.579, -16.324],
  'tenerife-nature-retreat':           [28.179, -16.624],
  'wellness-house-tenerife':           [28.464, -16.252],
  'buen-retiro-guimar':                [28.310, -16.413],
  'gloria-palace-royal-gran-canaria':  [27.784, -15.709],
  'lopesan-costa-meloneras-spa':       [27.731, -15.590],
  'nature-retreat-la-gomera':          [28.117, -17.100],
  'gomera-lounge':                     [28.117, -17.100],
  'casa-calma-yoga-gran-canaria':      [28.123, -15.437],
  'yoga-loft-canteras-gran-canaria':   [28.123, -15.437],
  'casa-leon-royal-retreat-gran-canaria': [27.930, -15.570],
  'hotel-hacienda-de-abajo-la-palma':  [28.684, -17.764],
  'finca-la-tajea-tenerife':           [28.300, -16.500],
  'finca-paraiso-tenerife':            [28.300, -16.500],
  'finca-casa-verde-shalom-tenerife':  [28.300, -16.500],
  // Cataluña
  'mas-vivent-girona':                 [42.325, 3.107],
  'mas-can-puig-fuirosos':             [41.690, 2.483],
  'hotel-camiral-girona':              [41.843, 2.805],
  's-agaro-spa-wellness':              [41.786, 2.991],
  'hotel-villa-retiro-tarragona':      [40.843, 0.488],
  'ora-priorat-torroja':               [41.246, 0.785],
  'el-palauet-del-priorat':            [41.279, 0.938],
  'luna-club-hotel-yoga-malgrat':      [41.648, 2.742],
  'ecoturisme-can-buch-emporda':       [42.100, 2.800],
  'nastasi-hotel-spa-lleida':          [41.618, 0.620],
  'mas-de-l-aranyo-lleida':            [41.600, 0.750],
  'thalassa-sport-spa-roses':          [42.265, 3.183],
  // Comunidad Valenciana
  'masqi-energy-house':                [38.718, -0.659],
  'asia-gardens-alicante':             [38.568, -0.262],
  'daniya-denia-spa':                  [38.840, 0.107],
  'dormio-resort-costa-blanca':        [38.428, -0.391],
  'casa-llibertat-llibertat':          [38.780, -0.001],
  'palasiet-wellness-castellon':       [40.062, -0.069],
  'abbi-suites-bocairent':             [38.780, -0.601],
  // Galicia
  'retiro-costina-wellness-galicia':   [43.028, -8.821],
  'augusta-eco-wellness-galicia':      [42.399, -8.808],
  'hotel-bienestar-moana-galicia':     [42.281, -8.740],
  'ourense-termal':                    [42.336, -7.864],
  'oca-imi-amp-spa':                   [42.336, -7.864],
  'eurostarsgranhotellatoja':          [42.493, -8.842],
  // País Vasco
  'hotel-arima-spa-san-sebastian':     [43.288, -1.984],
  'balnearioareatza':                  [43.083, -2.616],
  'hotel-villa-antilla-orio':          [43.276, -2.124],
  // Navarra
  'hotel-spa-atxaspi-navarra':         [43.261, -1.703],
  'balneario-elgorriaga':              [43.183, -1.736],
  'arantza-hotela':                    [43.251, -1.676],
  // Aragón
  'sancho-abarca-huesca':              [42.184, -1.352],
  'torre-del-marques-teruel':          [40.804, -0.063],
  'spa-ciudad-de-teruel':              [40.346, -1.107],
  'balneario-termas-pallares':         [41.305, -2.131],
  // Asturias
  'puebloastur-eco-resort':            [43.300, -6.000],
  'artiem-asturias':                   [43.533, -5.661],
  'north-surf-house-gijon':            [43.535, -5.661],
  // Cantabria
  'balneario-la-hermida':              [43.214, -4.620],
  'latas-surf-house-somo':             [43.471, -3.626],
  'spa-rural-mies-de-rubayo':          [43.414, -3.796],
  'castilla-termal-solares':           [43.385, -3.697],
  // Región de Murcia
  'thalasia-costa-de-murcia':          [37.862, -0.794],
  'balneario-archena':                 [38.118, -1.298],
  'grand-hyatt-la-manga':              [37.638, -0.729],
  'espacio-finca-alegria-murcia':      [37.900, -0.990],
  // Extremadura
  'hospes-palacio-arenales-caceres':   [39.476, -6.372],
  'hotel-spa-adealba-merida':          [38.917, -6.344],
  'los-montejos-spa':                  [40.204, -6.856],
  // La Rioja
  'balneario-arnedillo':               [42.213, -2.249],
  'marques-de-riscal':                 [42.558, -2.583],
  'hospederia-de-los-parajes':         [42.558, -2.583],
  'finca-de-los-arandinos':            [42.390, -2.470],
  // Castilla y León
  'kinedomus-bienestar-burgos':        [41.670, -3.689],
  'vado-del-duraton-segovia':          [41.303, -3.755],
  'castilla-termal-burgo-de-osma':     [41.587, -3.073],
  'casa-rural-spa-mirador-gredos':     [40.538, -5.863],
  'casa-rural-crisol-spa':             [40.209, -5.088],
  'el-retiro-albergue-spa-segovia':    [40.943, -4.109],
  'jabata-spa-avila':                  [40.657, -4.700],
  'el-retiro-de-san-pedro-avila':      [40.538, -5.863],
  // Castilla-La Mancha
  'alcuneza-siguenza':                 [41.062, -2.633],
  'dacha-toledo-casa-rural-spa':       [39.600, -4.683],
  'castilla-termal-brihuega':          [40.757, -2.874],
  'moneda-46-spa-cuenca':              [40.065, -2.135],
  // Comunidad de Madrid
  'hacienda-los-robles-madrid':        [40.717, -4.011],
  'hotel-arcipreste-de-hita':          [40.717, -4.011],
  'luces-del-poniente':                [40.741, -4.056],
  'los-cinco-enebros':                 [40.513, -4.156],
  'ciclolodge-el-nevero':              [40.975, -3.792],
  'posada-rural-con-granja-la-tejera-de-lozoya': [40.977, -3.757],
  'rural-el-valle':                    [40.896, -3.876],
  'chinchonspa':                       [40.137, -3.441],
  'casa-rrural-la-graja':              [40.137, -3.441],
  'posada-del-camino-real-torrelaguna': [40.827, -3.562],
  'parador-de-alcala-de-henares':      [40.482, -3.362],
};

const retreats = JSON.parse(fs.readFileSync(P, 'utf8'));
let added = 0, missing = [];

retreats.forEach(r => {
  const c = COORDS[r.id];
  if (c) { r.lat = c[0]; r.lng = c[1]; added++; }
  else missing.push(r.id);
});

fs.writeFileSync(P, JSON.stringify(retreats, null, 2));
console.log(`Added coords to ${added} retreats.`);
if (missing.length) console.log('Missing IDs:\n', missing.join('\n'));

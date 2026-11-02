# Bogan Bay asset credits

## Streetlife / V5

- Three.js research: the [game guide](https://threejs.org/manual/en/game.html) distinguishes rendering from physics/game rules. Physics remains in Rapier. Animation weights and cadence use [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html) and separate character mixers follow [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html).
- Original two-bone arm IK, centre punch/uppercut/hook trajectories, entry and swimming poses. These new actions are procedural, not downloaded motion capture. Imported Idle/Walk/Run clips remain as credited below.
- Rebuilt angular face, jaw, rectangular sunglasses, articulated finger weighting, broader workwear and slowed gait. The visible human is still original stylised procedural artwork, not a scanned/photoreal person.
- Original ocean shader with shared CPU wave-height/normal API, informed by the official [ocean example](https://threejs.org/examples/webgl_shaders_ocean.html). No jetskis are implemented yet.
- New engine layer uses original pre-rendered PCM combustion impulses with irregular firing, pressure decay and filtered noise. Tire scrub/squeal and impacts are original synthesis. No audio was ripped from GTA or other games, and these are not real vehicle recordings.
- Dynamic NPC cars use Rapier suspension controllers. Buses retain their existing kinematic route bodies. Traffic rules and fictional signal timing are gameplay systems, not road-safety training.

- Character base rig and embedded Idle, Walk and Run animation clips: Adobe Mixamo Xbot, distributed in the official Three.js additive-blending example: https://threejs.org/examples/webgl_animation_skinning_additive_blending.html . Asset: https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/Xbot.glb . Adobe's royalty-free game-use terms: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html . Original hi-vis workwear colours, beard/hair, facial details, sunglasses and tool belt were added for this game. The integrated character is not provided as a separate downloadable asset pack.
- Mood references: rough Australian tradie/coastal humour and a warm 1990s crime-game dusk. The original character is not Mike Nolan, and the game is not affiliated with The Big Lez Show or Rockstar.
- Three.js, its GLTF loader, geometry utilities and skeleton cloning utility: MIT, https://github.com/mrdoob/three.js/blob/r170/LICENSE .
- Rapier JavaScript compatibility build 0.17.3: Apache-2.0, https://github.com/dimforge/rapier.js/blob/master/LICENSE . Vehicle controller documentation: https://rapier.rs/docs/user_guides/javascript/vehicle_controller/ .
- Car bodywork, wheels, buildings, roads, terrain, vegetation and surface textures: original procedural game assets.
- Legacy coast-art image retained in the source bundle: generated for Bogan Bay; no longer used by the After Hours title/loading/help screens.

This is a fictional Australian coastal driving playground, not affiliated with Rockstar Games, Grand Theft Auto, The Big Lez Show, Holden or Toyota.

## Victoria revision

- Visible character: original organic human/workwear skinned mesh in `tradie-human.js`. All original visible Xbot mesh objects are removed. The imported skeleton and idle/walk/run clips remain; these are not motion-capture clips created by this project.
- Gum trees: original branching trunks, generated mottled bark texture and narrow individual hanging leaves. Visual references: [River red gum](https://soilhealth.ccmaknowledgebase.vic.gov.au/vro_archive/statewide/pages/water_sss_river_red_gum.html) and [Boroondara indigenous trees](https://www.boroondara.vic.gov.au/services/environment-and-sustainability/wildlife-biodiversity-and-gardening/indigenous-trees).
- Transit: original buses with orange/white geometric livery, destination boards and left-side doors, plus green shelters. Styling references: [Transdev Melbourne](https://en.wikipedia.org/wiki/Transdev_Melbourne), [Panorama Coaches](https://en.wikipedia.org/wiki/Panorama_Coaches) and [Surf Coast bus shelters](https://www.surfcoast.vic.gov.au/Property/Roads/Road-safety/Bus-Shelters). Route 782 and VIC COAST are fictional in this game. No official PTV logo/model is used.
- Speed signs: 30/40 in town, 100/110 on highways, with 120 confined to a fictional private test section. [Victorian speed-limit guidance](https://transport.vic.gov.au/road-and-active-transport/road-rules-and-safety/speed-limits).
- Sound: original Web Audio synthesis of V8 exhaust, diesel clatter, intake, road/tyres/gravel, bus diesel/air brakes, coastal wind/surf and Australian-inspired bird whistles/cackles. Bird sounds are stylised synthesis, not field recordings or exact species reproductions.

V6: ocean.js, rides.js and door rig are original code for this project.

V9: Traffic and parked cars use the Kenney Car Kit (CC0, https://www.kenney.nl/assets/car-kit), licence in models/KENNEY-CAR-KIT-LICENSE.txt. The character is the Mixamo Xbot rig, repainted procedurally. Scooter, jet ski, houses, footpaths, kerbs, drains, tactile pads and fight moves are original procedural code for this project.

## V10
- Character: Quaternius Universal Base Characters (Superhero Male body, hair, beard and eyebrows), CC0, https://quaternius.itch.io/universal-base-characters . Singlet, stubbies and thongs are painted on by a shader in bogan-character.js. Licence: models/bogan/LICENSE-UniversalBaseCharacters.txt.
- Animations (idle, walk, jog, sprint, jab, cross, hook, hit reaction, death, swim, jump, knock-down, driving): Quaternius Universal Animation Library 1 and 2, CC0, https://quaternius.itch.io/universal-animation-library and https://quaternius.itch.io/universal-animation-library-2 . They need no login or account. Licence: models/bogan/LICENSE-UniversalAnimationLibrary.txt. Extracted to models/bogan/anims.json.
- Cars (hatch, SUV, van, ute, sedan), interiors, houses, raised footpaths with profiled kerb-and-channel, nature strips, scooters and jet skis are original procedural code for this project. The Kenney Car Kit and Mixamo Xbot from earlier versions are no longer used.

## V11
- Home interior furniture (couch, armchairs, stools, coffee and dining tables, bed, nightstands, bookshelf, kitchen cabinets/fridge/oven/sink, bathroom suite, TV, fireplace, curtains, shelves, houseplants): Quaternius Ultimate House Interior Pack, CC0, https://quaternius.com/packs/ultimatehomeinterior.html (pack page https://quaternius.itch.io/ultimate-house-interior-pack). Converted to JSON parts (tools/obj2json.py) in models/interior/.
- Sea life (dolphin, three reef fish, manta ray, shark, whale): Quaternius Animated Fish Pack, CC0, https://quaternius.com/packs/animatedfish.html (pack page https://quaternius.itch.io/animated-fish-pack). Converted from FBX (tools/fbx2json.py) to models/fish/. Tail wag, schooling, coral, porpoising and dolphin pod logic are original code.
- Trees: Bloodwood tree and Acacia by "Poly by Google" via poly.pizza, CC-BY 3.0, https://poly.pizza/m/4o3bOOxZY-j (bloodwood) and https://poly.pizza/m/7EVeXhDGD-D (acacia). Textures embedded in models/props/*.json.
- The bong on the coffee table: "Zong Water Pipe" by Algernop Krieger via poly.pizza, CC-BY 3.0, https://poly.pizza/m/8PbxXgNl9nz.
- Baggy shirt/shorts, mullet, sunnies, guns, phone UI, sitting/bong/beer systems, sea-life and nature modules are original code for this project.
- The locals are named after Big Lez Show characters as affectionate parody; this remains a fictional fan-flavoured sandbox, not affiliated with or endorsed by The Big Lez Show.

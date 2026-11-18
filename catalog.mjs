const landmark = (id, zh, en, description, descriptionEn) => ({
  name: zh, nameEn: en, description, descriptionEn,
  pack: 'landmarks', scene: `scenes/${id}.json`,
  poster: `examples/landmarks/previews/${id}.png`,
});

export const catalog = {
  'ember-foundry': {
    name: '熔潮铸炉', nameEn: 'Ember Foundry',
    description: '铜管、熔流与玄武岩台地。', descriptionEn: 'Copper ducts and molten runoff on a basalt shelf.',
    poster: 'examples/ember-foundry/previews/scene-pixel.png',
  },
  'moonpool-conservatory': {
    name: '月汐温室', nameEn: 'Moonpool Conservatory',
    description: '旧玻璃和发光植物倒映在浅水上。', descriptionEn: 'Broken glazing and luminous plants reflected in shallow water.',
    poster: 'examples/moonpool-conservatory/previews/scene-pixel.png',
  },
  'windward-citadel': {
    name: '风尽之城', nameEn: 'Windward Citadel',
    description: '层叠城垣、悬崖和金色树冠。', descriptionEn: 'A cliffside citadel above a golden tree.',
    poster: 'examples/windward-citadel/previews/final-pixel.png',
    playable: true,
    lighting: {
      skyTint: [1.03, 1.08, 1.07],
      lights: [
        { position: [-.93, .10, 5.03], color: [1, .58, .20], intensity: 2 },
        { position: [-3.80, 6, -.8], color: [1, .66, .30], intensity: 2.2 },
      ],
    },
  },
  'frostline-beacon': {
    name: '暮雪信标', nameEn: 'Frostline Beacon',
    description: '雪岭信号站，按 B 开关信标。', descriptionEn: 'A snowy relay station. Press B to toggle the beacon.',
    poster: 'examples/frostline-beacon/previews/scene-pixel.png',
  },
  'liberty-island': landmark('liberty-island','自由岛','Liberty Island',
    '自由女神像、花岗岩基座与星形伍德堡。','The Statue of Liberty, its granite pedestal and star-shaped Fort Wood.'),
  'pearl-harbor': landmark('pearl-harbor','珍珠港','Pearl Harbor',
    '亚利桑那号纪念馆横跨水面。','The USS Arizona Memorial above the harbor.'),
  'tulum': landmark('tulum','图卢姆海崖','Tulum',
    '海崖上的卡斯蒂略神庙与加勒比海。','El Castillo on the limestone cliff above the Caribbean.'),
  'black-forest': landmark('black-forest','黑森林瀑布','Black Forest Falls',
    '特里贝格的阶梯瀑布与林间木桥。','A terraced cascade and woodland footbridge at Triberg.'),
};

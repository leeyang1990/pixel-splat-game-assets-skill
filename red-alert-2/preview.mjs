const missions = [
  {
    key: 'lone-guardian', number: 1, mission: 'Lone Guardian', video: 'OITgFTEUTFI',
    zh: ['纽约港', '从自由女神像所在的港湾看向纽约街区。'],
    en: ['New York Harbor', 'The Statue of Liberty waterfront and the streets of New York.'],
  },
  {
    key: 'deep-sea', number: 7, mission: 'Deep Sea', video: 'Rhv3rNEdT14',
    zh: ['珍珠港', '岛屿、开阔水面与珍珠港的海军设施。'],
    en: ['Pearl Harbor', 'Islands, open water, and the harbor’s naval facilities.'],
  },
  {
    key: 'sun-temple', number: 9, mission: 'Sun Temple', video: 'oZx_sbLsN9A',
    zh: ['图卢姆', '墨西哥图卢姆的热带海岸与遗迹。'],
    en: ['Tulum', 'Tropical coastline and ruins in Tulum, Mexico.'],
  },
  {
    key: 'mirage', number: 10, mission: 'Mirage', video: 'gC3nP2FsMSc',
    zh: ['德国黑森林', '穿过黑森林，来到林间的爱因斯坦实验室。'],
    en: ['Black Forest', 'Einstein’s laboratory in Germany’s Black Forest.'],
  },
];

const strings = {
  zh: {
    document: '红色警戒 2 · 原版关卡预览', title: '红色警戒 2', subtitle: '原版盟军战役实录',
    back: '← 高斯场景集', language: 'English', pageNav: '页面导航', choose: '选择关卡',
    play: '播放关卡实录', recording: '在 YouTube 打开 ↗', credit: '实录由 ParallaxDG 制作',
  },
  en: {
    document: 'Red Alert 2 · Mission Previews', title: 'Red Alert 2', subtitle: 'Original Allied campaign footage',
    back: '← Splat gallery', language: '简体中文', pageNav: 'Page navigation', choose: 'Choose a mission',
    play: 'Play mission footage', recording: 'Watch on YouTube ↗', credit: 'Footage by ParallaxDG',
  },
};

const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
const copy = strings[language];
const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
let active;

document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
document.title = copy.document;
document.querySelector('.page-nav').setAttribute('aria-label', copy.pageNav);
ui.missions.setAttribute('aria-label', copy.choose);
for (const key of ['title', 'subtitle', 'back', 'language', 'recording', 'credit']) ui[key].textContent = copy[key];
ui.language.lang = language === 'en' ? 'zh-CN' : 'en';
ui['play-video'].textContent = copy.play;

const links = new Map();
for (const mission of missions) {
  const link = document.createElement('a');
  link.href = '#' + mission.key;
  const label = document.createElement('span');
  label.textContent = mission[language][0];
  const subtitle = document.createElement('small');
  const number = language === 'en' ? `Mission ${mission.number}` : `第 ${mission.number} 关`;
  subtitle.textContent = `${number} · ${mission.mission}`;
  link.append(label, subtitle);
  links.set(mission.key, link);
  ui.missions.append(link);
}

function selectMission() {
  const mission = missions.find(entry => entry.key === location.hash.slice(1)) ?? missions[0];
  if (active === mission) return;
  active = mission;
  const [title, description] = mission[language];
  const localeLink = new URL(location.href);
  if (language === 'en') localeLink.searchParams.delete('lang');
  else localeLink.searchParams.set('lang', 'en');
  localeLink.hash = mission.key;
  ui.language.href = localeLink.href;

  for (const [key, link] of links) {
    if (key === mission.key) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  ui['scene-title'].textContent = title;
  ui.description.textContent = description;
  ui.recording.href = 'https://www.youtube.com/watch?v=' + mission.video;
  ui.poster.hidden = false;
  ui.poster.src = `https://i.ytimg.com/vi/${mission.video}/hqdefault.jpg`;
  ui.screen.replaceChildren(ui.poster, ui['play-video']);
}

ui.poster.addEventListener('error', () => { ui.poster.hidden = true; });
ui['play-video'].onclick = () => {
  const player = document.createElement('iframe');
  const url = new URL('https://www.youtube-nocookie.com/embed/' + active.video);
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('playsinline', '1');
  player.title = active.mission;
  player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  player.allowFullscreen = true;
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  player.src = url.href;
  ui.screen.replaceChildren(player);
  player.focus();
};

window.addEventListener('hashchange', selectMission);
selectMission();

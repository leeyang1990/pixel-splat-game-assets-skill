# Landmarks · 实景地标

Four stylized, compressed-scale studies of physical places. The site references guided the silhouette and setting. Each `.splat` is provided with editable data, generator source, local bounds and anchors where applicable. Scene files define reusable placements in the shared asset pack.

- Liberty Island, the Statue of Liberty and the star-shaped Fort Wood. [National Park Service](https://www.nps.gov/articles/000/stli-liberty-island-650003.htm)
- Pearl Harbor, the USS Arizona Memorial and its low central roofline. [National Park Service](https://www.nps.gov/perl/uss-arizona-accessibility-briefing.htm)
- Tulum, El Castillo on the Caribbean cliff. [Instituto Nacional de Antropología e Historia](https://lugares.inah.gob.mx/es/node/4361)
- The Black Forest, the terraced Gutach falls at Triberg. [Stadt Triberg](https://www.triberg.de/english/tourismus-1/natural-experience-1/germanys-highest-waterfalls-1)

Run from this directory with Blender 4.5 LTS and Python 3.

```sh
blender --background --python-exit-code 1 --python src/build.py
python3 src/compose.py
```

The Gaussian surface sampler is bundled under its [MIT license](src/LICENSE.txt).

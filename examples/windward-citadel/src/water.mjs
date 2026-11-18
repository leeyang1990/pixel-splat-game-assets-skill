// World-space, +Y horizontal water. Bounds are independent of tile width/depth.
export const WATER_MAX_DISPLACEMENT=.009+.004+.0015;
export function waterDisplacement(x,z,t){return .009*Math.sin(t*1.1+x*3.2+z*2.6)+.004*Math.cos(t*.8+z*4)+.0015*Math.sin(z*45-t*1.3+Math.sin(x*7));}
export function waterGradient(x,z,t){const w=t*1.1+x*3.2+z*2.6,f=z*45-t*1.3+Math.sin(x*7);return[.0288*Math.cos(w)+.0105*Math.cos(f)*Math.cos(x*7),.0234*Math.cos(w)-.016*Math.sin(t*.8+z*4)+.0675*Math.cos(f)];}
export const WATER_GLSL=`
float waterHeight(vec2 P,float t){return .009*sin(t*1.1+P.x*3.2+P.y*2.6)+.004*cos(t*.8+P.y*4.)+.0015*sin(P.y*45.-t*1.3+sin(P.x*7.));}
vec2 waterGradient(vec2 P,float t){float w=t*1.1+P.x*3.2+P.y*2.6,f=P.y*45.-t*1.3+sin(P.x*7.);return vec2(.0288*cos(w)+.0105*cos(f)*cos(P.x*7.),.0234*cos(w)-.016*sin(t*.8+P.y*4.)+.0675*cos(f));}
`;

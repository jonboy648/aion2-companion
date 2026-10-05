import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, TextureLoader, WebGLRenderer } from "three";

const fragmentShader = `
precision highp float;
uniform sampler2D artwork;
uniform float time;
uniform float aspect;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float mist(vec2 p) { return .55*noise(p)+.3*noise(p*2.03)+.15*noise(p*4.01); }
float fall(vec2 p, vec2 a, vec2 b, float width) {
  vec2 ab=b-a; float t=clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0);
  return (1.0-smoothstep(width*.4,width,length(p-a-t*ab)))*smoothstep(0.0,.12,t)*(1.0-smoothstep(.88,1.0,t));
}
vec3 sampleArt(vec2 p) { return texture2D(artwork,vec2(p.x,1.0-p.y)).rgb; }
void main() {
  // Masks use coordinates in the original artwork, so the cliffs remain still
  // when the canvas is cropped for narrow screens.
  vec2 p=vec2(vUv.x,1.0-vUv.y);
  float imageAspect=1672.0/941.0;
  if(aspect>imageAspect) p.y=p.y*(imageAspect/aspect)+(1.0-imageAspect/aspect)*.70;
  else p.x=p.x*(aspect/imageAspect)+(1.0-aspect/imageAspect)*.5;
  vec3 original=sampleArt(p);
  float waterfalls=0.0;
  waterfalls=max(waterfalls,fall(p,vec2(.096,.282),vec2(.083,.68),.011));
  waterfalls=max(waterfalls,fall(p,vec2(.169,.34),vec2(.164,.60),.013));
  waterfalls=max(waterfalls,fall(p,vec2(.363,.354),vec2(.359,.707),.012));
  waterfalls=max(waterfalls,fall(p,vec2(.414,.405),vec2(.405,.737),.014));
  waterfalls=max(waterfalls,fall(p,vec2(.520,.635),vec2(.511,.816),.026));
  waterfalls=max(waterfalls,fall(p,vec2(.559,.636),vec2(.543,.832),.018));
  waterfalls=max(waterfalls,fall(p,vec2(.602,.656),vec2(.586,.829),.011));
  waterfalls=max(waterfalls,fall(p,vec2(.726,.286),vec2(.716,.53),.009));
  waterfalls=max(waterfalls,fall(p,vec2(.764,.455),vec2(.754,.768),.015));
  waterfalls=max(waterfalls,fall(p,vec2(.926,.662),vec2(.936,.866),.013));
  float light=dot(original,vec3(.299,.587,.114));
  waterfalls*=smoothstep(.22,.58,light);
  float flow=noise(vec2(p.x*470.0,p.y*100.0-time*2.6));
  vec2 wet=p+vec2(sin(p.y*150.0-time*4.0)*.001, sin(p.y*200.0-time*5.5)*.003)*waterfalls;
  vec3 color=mix(original,sampleArt(wet),waterfalls*.85);
  color+=vec3(.68,.88,.94)*(flow-.38)*waterfalls*.23;

  // Foreground pool: travelling horizontal ripples within the water only.
  float pool=smoothstep(.84,.89,p.y)*(1.0-smoothstep(.985,1.0,p.y));
  pool*=smoothstep(.28,.39,p.x)*(1.0-smoothstep(.75,.81,p.x));
  float ripple=sin(p.y*250.0-time*2.6+sin(p.x*37.0+time*.55));
  vec2 reflected=p+vec2(sin(p.y*180.0+time)*.0015,ripple*.0018)*pool;
  color=mix(color,sampleArt(reflected),pool*.8);
  color+=vec3(.55,.79,.75)*pow(max(0.0,ripple),16.0)*pool*.075;

  // Fine spray drifts through existing pale mist at the waterfall feet.
  float fogArea=exp(-pow((p.x-.54)/.25,2.0)-pow((p.y-.80)/.07,2.0));
  fogArea+=.45*exp(-pow((p.x-.37)/.09,2.0)-pow((p.y-.65)/.10,2.0));
  float vapor=mist(p*vec2(13.0,24.0)+vec2(-time*.08,time*.025));
  color=mix(color,vec3(.70,.84,.83),clamp((vapor-.32)*fogArea*.2,0.0,.12));
  gl_FragColor=vec4(color,1.0);
}`;

export async function createLivingGorge(host: HTMLElement) {
  const canvas = host.ownerDocument.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
  if (!context) throw new Error("WebGL is unavailable");
  const texture = await new TextureLoader().loadAsync("/brand/scenes/emerald-gorge.png");
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false, powerPreference: "low-power" }); }
  catch (error) { texture.dispose(); throw error; }
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    uniforms: { artwork: { value: texture }, time: { value: 0 }, aspect: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}",
    fragmentShader,
    depthTest: false, depthWrite: false,
  });
  scene.add(new Mesh(geometry, material));
  renderer.domElement.className = "living-gorge-canvas";
  host.append(renderer.domElement);
  let active = false;
  let disposed = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  const contextLost = (event: Event) => {
    event.preventDefault(); active=false; cancelAnimationFrame(frame);
    renderer.domElement.style.display="none";
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1_800_000 / (width * height))));
    renderer.setSize(width, height);
    material.uniforms.aspect.value = width / height;
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  function animate(now: number) {
    if (!active || disposed) return;
    frame = requestAnimationFrame(animate);
    if (last && now - last < 1000 / 30) return;
    if (last) elapsed += Math.min((now-last)/1000,.1);
    last=now;
    material.uniforms.time.value=elapsed;
    renderer.render(scene,camera);
  }
  return {
    setActive(value: boolean) {
      if (active === value || disposed) return;
      active=value; last=0;
      cancelAnimationFrame(frame);
      if(active) frame=requestAnimationFrame(animate);
    },
    dispose() {
      if(disposed) return;
      disposed=true; active=false;
      cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

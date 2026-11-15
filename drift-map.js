import {
  RasterMap,
  mapVertex,
  shader,
} from "./map-renderer.js?v=terrain-game6";
import {
  EQUAL_EARTH_COEFFICIENTS,
  EQUAL_EARTH_BOUNDS,
} from "./map-projection.js";
import { supportedRotationAt } from "./geo.js?v=terrain-game6";
import {
  plateSamples,
  plateScissor,
  atlasUV,
} from "./raster-drift.js?v=terrain-game6";
const { A1, A2, A3, A4, M } = EQUAL_EARTH_COEFFICIENTS;

// Only the departure atlas is sampled during motion. The arrival atlas is loaded
// after the geological clock reaches its destination, then settled at a fixed age.
const fragment = `#version 300 es
precision highp float;
in vec2 vUV;out vec4 outColor;
uniform sampler2D uSource,uOwner,uNative,uEurope,uLayer;
uniform vec2 uSize,uTranslate;uniform vec4 uEuropeBounds,uInverse,uFrom;
uniform float uScale,uProgress,uSettle,uIndex,uDetail,uModern;
uniform int uPass;
const float PI=3.141592653589793;const float M=${M};
vec3 rotatePoint(vec3 p,vec4 q){vec3 t=2.*cross(q.yzw,p);return p+q.x*t+cross(q.yzw,t);}
vec2 uvFor(vec3 p){return vec2(atan(p.y,p.x)/(2.*PI)+.5,.5-asin(clamp(p.z,-1.,1.))/PI);}
vec4 nativeTerrain(vec2 uv){
 vec4 c=texture(uNative,uv);vec2 deg=vec2((uv.x-.5)*360.,(.5-uv.y)*180.);
 vec2 eu=vec2((deg.x-uEuropeBounds.x)/(uEuropeBounds.z-uEuropeBounds.x),(uEuropeBounds.w-deg.y)/(uEuropeBounds.w-uEuropeBounds.y));
 float edge=smoothstep(0.,.02,min(min(eu.x,1.-eu.x),min(eu.y,1.-eu.y)));
 return mix(c,texture(uEurope,clamp(eu,0.,1.)),uModern*uDetail*edge);
}
void main(){
 vec2 p=(vec2(vUV.x,1.-vUV.y)*uSize-uTranslate)/uScale;p.y=-p.y;
 if(abs(p.y)>${EQUAL_EARTH_BOUNDS[3]})discard;
 float t=p.y;
 for(int i=0;i<7;i++){float t2=t*t,t6=t2*t2*t2;t-=(t*(${A1}+${A2}*t2+t6*(${A3}+${A4}*t2))-p.y)/(${A1}+3.*${A2}*t2+t6*(7.*${A3}+9.*${A4}*t2));}
 float t2=t*t,t6=t2*t2*t2;
 float lon=p.x*M*(${A1}+3.*${A2}*t2+t6*(7.*${A3}+9.*${A4}*t2))/cos(t);
 if(abs(lon)>PI)discard;
 float lat=asin(clamp(sin(t)/M,-1.,1.));vec2 uv=vec2(lon/(2.*PI)+.5,.5-lat/PI);
 if(uPass==0){
   vec4 land=texture(uLayer,vUV);
   // Unsupported departure geography fades away briefly; it is never given a
   // guessed plate. A quiet ocean makes actual continental motion legible.
   vec3 ocean=vec3(.039,.115,.158);
   vec3 background=mix(texture(uSource,uv).rgb,ocean,smoothstep(0.,.055,uProgress));
   vec3 moving=land.rgb+background*(1.-land.a);
   outColor=vec4(mix(moving,nativeTerrain(uv).rgb,uSettle),1.);return;
 }
 vec3 world=vec3(cos(lat)*cos(lon),cos(lat)*sin(lon),sin(lat));
 vec2 sourceUV=uvFor(rotatePoint(rotatePoint(world,uInverse),uFrom));
 if(abs(round(texture(uOwner,sourceUV).r*255.)-uIndex)>.25)discard;
 outColor=vec4(texture(uSource,sourceUV).rgb,1.);
}`;

export class DriftMap extends RasterMap {
  constructor(canvas, data, manifest, owners) {
    super(canvas);
    this.data = data;
    this.manifest = manifest;
    this.owners = owners;
    this.samples = plateSamples(data.features);
    const gl = this.gl,
      p = (this.driftProgram = gl.createProgram());
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, mapVertex));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(p));
    this.driftUniforms = Object.fromEntries(
      [
        "uLayer",
        "uSource",
        "uOwner",
        "uNative",
        "uEurope",
        "uSize",
        "uTranslate",
        "uEuropeBounds",
        "uInverse",
        "uFrom",
        "uScale",
        "uProgress",
        "uSettle",
        "uIndex",
        "uDetail",
        "uModern",
        "uPass",
      ].map((n) => [n, gl.getUniformLocation(p, n)]),
    );
  }
  assets(age) {
    const low =
      innerWidth < 650 || this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) < 3600;
    const url = (asset) => `${asset.url}?v=${asset.sha256.slice(0, 12)}`;
    return [
      url(this.manifest.snapshots[age][low ? "overview" : "full"]),
      url(this.owners.ages[age][low ? "overview" : "full"]),
      ...(age === 0
        ? [url(this.manifest.europe[low ? "overview" : "texture"])]
        : []),
    ];
  }
  async loadStage(age) {
    const assets = this.assets(age);
    const [map, owner, eu] = await Promise.all(
      [assets[0], assets[1], assets[2] ?? assets[0]].map((u) =>
        this.texture(u),
      ),
    );
    return {
      from: age,
      to: age,
      map,
      owner,
      eu,
      plates: this.owners.ages[age].indices
        .toSorted((a, b) => a - b)
        .map((index) => {
          const pid = this.owners.indexToPid[index];
          return {
            index,
            pid,
            from: supportedRotationAt(this.data, pid, age),
            samples: this.samples.get(pid) ?? [],
          };
        }),
    };
  }
  async prepare(age) {
    const ticket = ++this.ticket;
    this.requests++;
    try {
      const stage = await this.loadStage(age);
      if (ticket !== this.ticket) return false;
      this.stage = stage;
      this.arrival = null;
      this.settle = 0;
      this.europeBounds = this.manifest.europe.bounds;
      this.native(stage);
      return true;
    } finally {
      if (--this.requests === 0) this.trim(new Set());
    }
  }
  beginDrift(to) {
    this.stage.to = to;
    this.arrival = null;
    this.settle = 0;
  }
  async loadArrival(age) {
    if (age !== this.stage.to)
      throw Error(
        "Arrival terrain cannot load before the drift reaches its age",
      );
    const ticket = ++this.ticket;
    this.requests++;
    try {
      const stage = await this.loadStage(this.stage.to);
      if (ticket !== this.ticket) return false;
      this.arrival = stage;
      return true;
    } finally {
      if (--this.requests === 0) this.trim(new Set());
    }
  }
  commitArrival() {
    this.stage = this.arrival;
    this.arrival = null;
    this.settle = 0;
    this.native(this.stage);
    this.trim(new Set());
  }
  trim(keep) {
    for (const stage of [this.stage, this.arrival])
      if (stage) for (const key of ["map", "owner", "eu"]) keep.add(stage[key]);
    if (this.base) keep.add(this.base);
    if (this.europe) keep.add(this.europe);
    super.trim(keep);
  }
  resize(width, height, ratio) {
    super.resize(width, height, ratio);
    const gl = this.gl;
    if (this.target) {
      gl.deleteFramebuffer(this.target.framebuffer);
      gl.deleteTexture(this.target.texture);
    }
    this.targetWidth = Math.round(width);
    this.targetHeight = Math.round(height);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      this.targetWidth,
      this.targetHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw Error("Could not allocate drift layer");
    this.target = { texture, framebuffer };
    this.framebufferBytes = this.targetWidth * this.targetHeight * 4;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  native(stage) {
    this.base = stage.map;
    this.europe = stage.from === 0 ? stage.eu : this.base;
    this.age = stage.from;
  }
  ownerAt(point, age) {
    const mask = age === this.stage?.from ? this.stage.owner : null;
    if (!mask?.pixels) return 0;
    const [u, v] = atlasUV(point);
    return mask.pixels[
      Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height))) *
        mask.width +
        Math.floor(u * mask.width)
    ];
  }
  drawAge(age, view) {
    const s = this.stage;
    if (!s || this.gl.isContextLost()) return;
    if (s.from === s.to || age >= s.from) {
      this.native(s);
      super.draw(view);
      return;
    }
    const gl = this.gl,
      u = this.driftUniforms,
      arrival = this.arrival ?? s;
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(this.driftProgram);
    gl.uniform2f(u.uSize, this.width, this.height);
    gl.uniform2f(u.uTranslate, ...view.translate);
    gl.uniform1f(u.uScale, view.scale);
    gl.uniform4f(u.uEuropeBounds, ...this.europeBounds);
    gl.uniform1f(u.uProgress, (s.from - age) / (s.from - s.to));
    gl.uniform1f(u.uSettle, age <= s.to && this.arrival ? this.settle : 0);
    gl.uniform1f(u.uDetail, Math.max(0, Math.min(1, (view.k - 2) / 2)));
    gl.uniform1f(u.uModern, arrival.from === 0 ? 1 : 0);
    [s.map, s.owner, arrival.map, arrival.eu].forEach((texture, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, texture.texture);
      gl.uniform1i([u.uSource, u.uOwner, u.uNative, u.uEurope][i], i);
    });
    // Unbind the render target before writing to it.
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, s.map.texture);
    gl.uniform1i(u.uLayer, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.framebuffer);
    gl.viewport(0, 0, this.targetWidth, this.targetHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(u.uPass, 1);
    gl.enable(gl.SCISSOR_TEST);
    for (const p of s.plates) {
      const q = supportedRotationAt(this.data, p.pid, age);
      const box = plateScissor(p.samples, q, view, this.width, this.height);
      if (!box) continue;
      gl.scissor(
        box[0],
        Math.floor(this.height - box[1] - box[3]),
        box[2],
        box[3],
      );
      gl.uniform4f(u.uInverse, q[0], -q[1], -q[2], -q[3]);
      gl.uniform4f(u.uFrom, ...p.from);
      gl.uniform1f(u.uIndex, p.index);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.target.texture);
    gl.uniform1i(u.uPass, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

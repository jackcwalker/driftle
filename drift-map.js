import {
  RasterMap,
  mapVertex,
  shader,
} from "./map-renderer.js?v=terrain-game4";
import {
  EQUAL_EARTH_COEFFICIENTS,
  EQUAL_EARTH_BOUNDS,
} from "./map-projection.js";
import { supportedRotationAt } from "./geo.js?v=terrain-game4";
import {
  plateSamples,
  plateScissor,
  atlasUV,
} from "./raster-drift.js?v=terrain-game4";
const { A1, A2, A3, A4, M } = EQUAL_EARTH_COEFFICIENTS;

const fragment = `#version 300 es
precision highp float;
in vec2 vUV;out vec4 outColor;
uniform sampler2D uA,uB,uOwnerA,uOwnerB,uEurope,uLayerA,uLayerB;
uniform vec2 uSize,uTranslate;uniform vec4 uEuropeBounds,uInverse,uFrom,uTo;
uniform float uScale,uT,uIndex,uDetail,uModernA,uModernB;
uniform int uPass;
const float PI=3.141592653589793;const float M=${M};
vec3 rotatePoint(vec3 p,vec4 q){vec3 t=2.*cross(q.yzw,p);return p+q.x*t+cross(q.yzw,t);}
vec2 uvFor(vec3 p){return vec2(atan(p.y,p.x)/(2.*PI)+.5,.5-asin(clamp(p.z,-1.,1.))/PI);}
vec4 terrain(sampler2D atlas,vec2 uv,float modern){
 vec4 c=texture(atlas,uv);vec2 deg=vec2((uv.x-.5)*360.,( .5-uv.y)*180.);
 vec2 eu=vec2((deg.x-uEuropeBounds.x)/(uEuropeBounds.z-uEuropeBounds.x),(uEuropeBounds.w-deg.y)/(uEuropeBounds.w-uEuropeBounds.y));
 float edge=smoothstep(0.,.02,min(min(eu.x,1.-eu.x),min(eu.y,1.-eu.y)));
 return mix(c,texture(uEurope,clamp(eu,0.,1.)),modern*uDetail*edge);
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
   vec4 a=terrain(uA,uv,uModernA),b=terrain(uB,uv,uModernB);
   // Native atlases remain beneath the transported land. This cartographic
   // crossfade fills gaps between rigid patches without invented terrain.
   vec4 land=mix(texture(uLayerA,vUV),texture(uLayerB,vUV),uT);
   outColor=vec4(land.rgb+mix(a.rgb,b.rgb,uT)*(1.-land.a),1.);return;
 }
 vec3 world=vec3(cos(lat)*cos(lon),cos(lat)*sin(lon),sin(lat));
 vec3 local=rotatePoint(world,uInverse);
 vec2 aUV=uvFor(rotatePoint(local,uFrom)),bUV=uvFor(rotatePoint(local,uTo));
 if(uPass==1){
   if(abs(round(texture(uOwnerA,aUV).r*255.)-uIndex)>.25)discard;
   outColor=vec4(terrain(uA,aUV,uModernA).rgb,1.);
 }else{
   if(abs(round(texture(uOwnerB,bUV).r*255.)-uIndex)>.25)discard;
   outColor=vec4(terrain(uB,bUV,uModernB).rgb,1.);
 }

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
        "uLayerA",
        "uLayerB",
        "uA",
        "uB",
        "uOwnerA",
        "uOwnerB",
        "uEurope",
        "uSize",
        "uTranslate",
        "uEuropeBounds",
        "uInverse",
        "uFrom",
        "uTo",
        "uScale",
        "uT",
        "uIndex",
        "uDetail",
        "uModernA",
        "uModernB",
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
  prefetch(age) {
    // Compressed blobs only: later endpoint downloads do not consume GPU memory.
    return Promise.all(this.assets(age).map((url) => this.blob(url))).catch(
      () => {},
    );
  }
  async prepare(from, to) {
    const ticket = ++this.ticket;
    this.requests++;
    try {
      const a = this.assets(from),
        b = this.assets(to);
      const [mapA, ownerA, mapB, ownerB, eu] = await Promise.all(
        [a[0], a[1], b[0], b[1], a[2] ?? b[2] ?? b[0]].map((u) =>
          this.texture(u),
        ),
      );
      if (ticket !== this.ticket) return false;
      const indices = [
        ...new Set([
          ...this.owners.ages[from].indices,
          ...this.owners.ages[to].indices,
        ]),
      ];
      this.stage = {
        from,
        to,
        mapA,
        ownerA,
        mapB,
        ownerB,
        eu,
        plates: indices
          .sort((a, b) => a - b)
          .map((index) => {
            const pid = this.owners.indexToPid[index];
            return {
              index,
              pid,
              hasA: this.owners.ages[from].indices.includes(index),
              hasB: this.owners.ages[to].indices.includes(index),
              from: supportedRotationAt(this.data, pid, from),
              to: supportedRotationAt(this.data, pid, to),
              samples: this.samples.get(pid) ?? [],
            };
          }),
      };
      this.europeBounds = this.manifest.europe.bounds;
      this.native(from);
      return true;
    } finally {
      if (--this.requests === 0) this.trim(new Set());
    }
  }
  trim(keep) {
    if (this.stage)
      for (const key of ["mapA", "ownerA", "mapB", "ownerB", "eu"])
        keep.add(this.stage[key]);
    if (this.base) keep.add(this.base);
    if (this.europe) keep.add(this.europe);
    super.trim(keep);
  }
  resize(width, height, ratio) {
    super.resize(width, height, ratio);
    const gl = this.gl;
    if (this.targets)
      for (const target of this.targets) {
        gl.deleteFramebuffer(target.framebuffer);
        gl.deleteTexture(target.texture);
      }
    this.targetWidth = Math.round(width);
    this.targetHeight = Math.round(height);
    this.targets = [0, 1].map(() => {
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
        throw Error("Could not allocate drift layers");
      return { texture, framebuffer };
    });
    this.framebufferBytes = this.targetWidth * this.targetHeight * 8;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  native(age) {
    const s = this.stage;
    this.base = age === s.from ? s.mapA : s.mapB;
    this.europe = age === 0 ? s.eu : this.base;
    this.age = age;
  }
  ownerAt(point, age) {
    const s = this.stage;
    const mask = age === s?.from ? s.ownerA : age === s?.to ? s.ownerB : null;
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
    if (age >= s.from || age <= s.to || s.from === s.to) {
      this.native(age >= s.from ? s.from : s.to);
      super.draw(view);
      return;
    }
    const gl = this.gl,
      u = this.driftUniforms;
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.driftProgram);
    gl.uniform2f(u.uSize, this.width, this.height);
    gl.uniform2f(u.uTranslate, ...view.translate);
    gl.uniform1f(u.uScale, view.scale);
    gl.uniform4f(u.uEuropeBounds, ...this.europeBounds);
    gl.uniform1f(u.uT, (s.from - age) / (s.from - s.to));
    gl.uniform1f(u.uDetail, Math.max(0, Math.min(1, (view.k - 2) / 2)));
    gl.uniform1f(u.uModernA, s.from === 0 ? 1 : 0);
    gl.uniform1f(u.uModernB, s.to === 0 ? 1 : 0);
    [s.mapA, s.mapB, s.ownerA, s.ownerB, s.eu].forEach((texture, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, texture.texture);
      gl.uniform1i([u.uA, u.uB, u.uOwnerA, u.uOwnerB, u.uEurope][i], i);
    });
    // A render target cannot remain bound to a sampler while being written.
    for (let i = 5; i < 7; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, s.mapA.texture);
    }
    const draws = s.plates
      .map((p) => {
        const q = supportedRotationAt(this.data, p.pid, age);
        return {
          p,
          q,
          box: plateScissor(p.samples, q, view, this.width, this.height),
        };
      })
      .filter((d) => d.box);
    // Compose the two endpoint layers separately. Blending every plate with
    // fractional opacity creates artificial dark seams where plates overlap.
    for (let layer = 0; layer < 2; layer++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[layer].framebuffer);
      gl.viewport(0, 0, this.targetWidth, this.targetHeight);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(u.uPass, layer + 1);
      gl.enable(gl.SCISSOR_TEST);
      for (const { p, q, box } of draws) {
        if (!(layer === 0 ? p.hasA : p.hasB)) continue;
        gl.scissor(
          box[0],
          Math.floor(this.height - box[1] - box[3]),
          box[2],
          box[3],
        );
        gl.uniform4f(u.uInverse, q[0], -q[1], -q[2], -q[3]);
        gl.uniform4f(u.uFrom, ...p.from);
        gl.uniform4f(u.uTo, ...p.to);
        gl.uniform1f(u.uIndex, p.index);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.targets.forEach((target, i) => {
      gl.activeTexture(gl.TEXTURE0 + 5 + i);
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.uniform1i(i === 0 ? u.uLayerA : u.uLayerB, 5 + i);
    });
    gl.uniform1i(u.uPass, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

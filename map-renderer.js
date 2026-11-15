import {
  EQUAL_EARTH_COEFFICIENTS,
  EQUAL_EARTH_BOUNDS,
} from "./map-projection.js";
const { A1, A2, A3, A4, M } = EQUAL_EARTH_COEFFICIENTS;
// Static georeferenced raster drawing. Geographic detail is independent of mesh size.
const vertex = `#version 300 es
in vec2 aPosition;out vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0,1);}`;
const fragment = `#version 300 es
precision highp float;
in vec2 vUV;out vec4 outColor;
uniform sampler2D uMap;uniform sampler2D uEurope;uniform vec2 uSize;uniform vec2 uTranslate;uniform float uScale;uniform float uDetail;uniform vec4 uEuropeBounds;
const float M=${M};const float PI=3.141592653589793;
void main(){
 vec2 p=(vec2(vUV.x,1.-vUV.y)*uSize-uTranslate)/uScale;p.y=-p.y;
 if(abs(p.y)>${EQUAL_EARTH_BOUNDS[3]}){discard;}
 float t=p.y;
 for(int i=0;i<7;i++){float t2=t*t,t6=t2*t2*t2;t-=(t*(${A1}+${A2}*t2+t6*(${A3}+${A4}*t2))-p.y)/(${A1}+3.*${A2}*t2+t6*(7.*${A3}+9.*${A4}*t2));}
 float t2=t*t,t6=t2*t2*t2;
 float lon=p.x*M*(${A1}+3.*${A2}*t2+t6*(7.*${A3}+9.*${A4}*t2))/cos(t);
 if(abs(lon)>PI){discard;}
 float lat=asin(clamp(sin(t)/M,-1.,1.));vec2 uv=vec2(lon/(2.*PI)+.5,.5-lat/PI);
 vec4 base=texture(uMap,uv);vec2 deg=vec2(lon,lat)*180./PI;
 vec2 eu=vec2((deg.x-uEuropeBounds.x)/(uEuropeBounds.z-uEuropeBounds.x),(uEuropeBounds.w-deg.y)/(uEuropeBounds.w-uEuropeBounds.y));
 float edge=smoothstep(0.,.02,min(min(eu.x,1.-eu.x),min(eu.y,1.-eu.y)));
 outColor=mix(base,texture(uEurope,clamp(eu,0.,1.)),uDetail*edge);
}`;
function shader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw Error(gl.getShaderInfoLog(s));
  return s;
}
export class RasterMap {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = (this.gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    }));
    if (!gl) throw Error("WebGL2 is unavailable in this browser");
    const p = (this.program = gl.createProgram());
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.uniforms = Object.fromEntries(
      [
        "uMap",
        "uEurope",
        "uSize",
        "uTranslate",
        "uScale",
        "uDetail",
        "uEuropeBounds",
      ].map((n) => [n, gl.getUniformLocation(p, n)]),
    );
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const a = gl.getAttribLocation(p, "aPosition");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.cache = new Map();
    this.residentBytes = 0;
    this.ticket = 0;
    this.loading = new Map();
    this.requests = 0;
  }
  async texture(url) {
    if (this.cache.has(url)) {
      const value = this.cache.get(url);
      this.cache.delete(url);
      this.cache.set(url, value);
      return value;
    }
    if (this.loading.has(url)) return this.loading.get(url);
    const job = this.uploadTexture(url);
    this.loading.set(url, job);
    try {
      return await job;
    } finally {
      this.loading.delete(url);
    }
  }
  async uploadTexture(url) {
    const r = await fetch(url);
    if (!r.ok) throw Error(`${url}: ${r.status}`);
    const image = await createImageBitmap(await r.blob());
    const gl = this.gl,
      t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      url.includes("europe") ? gl.CLAMP_TO_EDGE : gl.REPEAT,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    const v = { texture: t, bytes: (image.width * image.height * 4 * 4) / 3 };
    image.close();
    this.cache.set(url, v);
    this.residentBytes += v.bytes;
    return v;
  }
  async snapshot(manifest, age, detail = true) {
    this.requests++;
    try {
      const ticket = ++this.ticket,
        s = manifest.snapshots[String(age)],
        lowRes =
          innerWidth < 650 ||
          this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) < 3600,
        url = (lowRes ? s.overview : s.full).url;
      const base = await this.texture(url);
      const eu =
        age === 0 && detail
          ? await this.texture(
              (lowRes ? manifest.europe.overview : manifest.europe.texture).url,
            )
          : base;
      if (ticket !== this.ticket) return false;
      this.base = base;
      this.europe = eu;
      this.age = age;
      this.europeBounds = manifest.europe.bounds;
      return true;
    } finally {
      // Do not evict a base texture while another request is loading its detail.
      if (--this.requests === 0) this.trim(new Set([this.base, this.europe]));
    }
  }
  trim(keep) {
    for (const [url, t] of this.cache) {
      if (this.cache.size <= 2) break;
      if (!keep.has(t)) {
        this.gl.deleteTexture(t.texture);
        this.residentBytes -= t.bytes;
        this.cache.delete(url);
      }
    }
  }
  resize(width, height, ratio) {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw({ scale, translate, k = 1 }) {
    if (!this.base) return;
    const gl = this.gl,
      u = this.uniforms;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform4f(u.uEuropeBounds, ...this.europeBounds);
    gl.uniform2f(u.uSize, this.width, this.height);
    gl.uniform2f(u.uTranslate, ...translate);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(
      u.uDetail,
      this.age === 0 ? Math.max(0, Math.min(1, (k - 2) / 2)) : 0,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.base.texture);
    gl.uniform1i(u.uMap, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.europe.texture);
    gl.uniform1i(u.uEurope, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

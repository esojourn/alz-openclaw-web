/**
 * Floating Lines Background Effect
 * 使用 Three.js 实现 WebGL 波浪线条背景效果
 */

(async function() {
  'use strict';

  // 检查 WebGL 支持
  function checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  // 检测移动设备
  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  // 如果不支持 WebGL，使用降级方案
  if (!checkWebGLSupport()) {
    console.warn('WebGL not supported, using fallback background');
    document.body.classList.add('webgl-fallback');
    return;
  }

  try {
    // 动态加载 Three.js 库
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');

    // 配置参数
    const config = {
      lineCount: isMobile() ? 3 : 5,
      lineDistance: 0.08,  // 增加线条间距
      bendRadius: 5.0,
      bendStrength: -0.5,
      animationSpeed: 1.0,
      mouseDamping: 0.05,
      colors: {
        primary: '#10b981',    // 翠绿
        secondary: '#3b82f6',  // 蓝色
        accent: '#fbbf24'      // 金色
      },
      waves: {
        top: { x: 10.0, y: 0.5, rotate: -0.4, opacity: 0.15 },      // 增加透明度
        middle: { x: 5.0, y: 0.0, rotate: 0.2, opacity: 0.6 },      // 降低绿色线条透明度，避免干扰文字
        bottom: { x: 2.0, y: -0.7, rotate: -1.0, opacity: 0.25 }    // 增加透明度
      }
    };

    // GLSL 着色器
    const vertexShader = `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec2 iMouse;
      uniform float uLineCount;
      uniform float uLineDistance;
      uniform float uBendRadius;
      uniform float uBendStrength;
      uniform float uAnimationSpeed;
      uniform vec3 uColorPrimary;
      uniform vec3 uColorSecondary;
      uniform vec3 uColorAccent;
      uniform vec3 uTopWavePos;
      uniform vec3 uMiddleWavePos;
      uniform vec3 uBottomWavePos;
      uniform float uTopOpacity;
      uniform float uMiddleOpacity;
      uniform float uBottomOpacity;

      varying vec2 vUv;

      // 旋转函数
      vec2 rotate(vec2 v, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
      }

      // 波浪函数
      float wave(vec2 uv, float offset, float time, float amp) {
        float x_offset = offset;
        float x_movement = time * uAnimationSpeed * 0.1;
        return sin(uv.x + x_offset + x_movement) * amp;
      }

      // 鼠标影响函数
      float mouseBend(vec2 uv, vec2 mouse) {
        vec2 d = uv - mouse;
        float dist = length(d);
        return exp(-dist * dist * uBendRadius) * uBendStrength;
      }

      // 绘制单层波浪
      float drawWaveLayer(vec2 uv, vec3 wavePos, float time) {
        // 应用旋转
        vec2 rotatedUv = rotate(uv - vec2(0.5, 0.5), wavePos.z) + vec2(0.5, 0.5);

        // 应用位置偏移
        rotatedUv.x += wavePos.x * 0.1;
        rotatedUv.y += wavePos.y;

        // 应用鼠标弯曲
        float bend = mouseBend(rotatedUv, iMouse / iResolution);
        rotatedUv.y += bend;

        float result = 0.0;

        // 绘制多条线
        for (float i = 0.0; i < 10.0; i++) {
          if (i >= uLineCount) break;

          float offset = i * 2.0;
          float amp = sin(offset + time * 0.2) * 0.3 + 0.5;
          float y = wave(rotatedUv, offset, time, amp);

          // 线条位置
          float lineY = rotatedUv.y - y - (i * uLineDistance);

          // 线条宽度和强度 - 增加光晕效果
          float coreWidth = 0.001;  // 核心线条宽度
          float glowWidth = 0.015;  // 光晕宽度

          // 核心线条（锐利）
          float core = smoothstep(coreWidth * 2.0, 0.0, abs(lineY));

          // 光晕效果（柔和）
          float glow = exp(-abs(lineY) * 50.0) * 0.5;

          // 外层光晕（更柔和）
          float outerGlow = exp(-abs(lineY) * 20.0) * 0.3;

          // 组合效果
          float intensity = core + glow + outerGlow;

          result += intensity;
        }

        return clamp(result, 0.0, 1.0);
      }

      void main() {
        vec2 uv = vUv;

        // 绘制三层波浪
        float topWave = drawWaveLayer(uv, uTopWavePos, iTime) * uTopOpacity;
        float middleWave = drawWaveLayer(uv, uMiddleWavePos, iTime) * uMiddleOpacity;
        float bottomWave = drawWaveLayer(uv, uBottomWavePos, iTime) * uBottomOpacity;

        // 为每层波浪分配颜色
        vec3 topColor = uColorSecondary * topWave;
        vec3 middleColor = uColorPrimary * middleWave;
        vec3 bottomColor = uColorAccent * bottomWave;

        // 使用 screen 混合模式叠加颜色
        vec3 color = vec3(0.0);
        color = 1.0 - (1.0 - color) * (1.0 - topColor);
        color = 1.0 - (1.0 - color) * (1.0 - middleColor);
        color = 1.0 - (1.0 - color) * (1.0 - bottomColor);

        // 增强光晕效果
        float totalIntensity = topWave + middleWave + bottomWave;
        color *= (1.0 + totalIntensity * 0.3);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Floating Lines Background 类
    class FloatingLinesBackground {
      constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.mesh = null;
        this.mouse = new THREE.Vector2(0.5, 0.5);
        this.targetMouse = new THREE.Vector2(0.5, 0.5);
        this.time = 0;
        this.isRunning = false;
      }

      async init() {
        // 创建场景
        this.scene = new THREE.Scene();

        // 创建正交相机
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // 创建渲染器
        const canvas = document.createElement('canvas');
        this.container.appendChild(canvas);

        this.renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 创建材质
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            iMouse: { value: new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5) },
            uLineCount: { value: config.lineCount },
            uLineDistance: { value: config.lineDistance },
            uBendRadius: { value: config.bendRadius },
            uBendStrength: { value: config.bendStrength },
            uAnimationSpeed: { value: config.animationSpeed },
            uColorPrimary: { value: new THREE.Color(config.colors.primary) },
            uColorSecondary: { value: new THREE.Color(config.colors.secondary) },
            uColorAccent: { value: new THREE.Color(config.colors.accent) },
            uTopWavePos: { value: new THREE.Vector3(config.waves.top.x, config.waves.top.y, config.waves.top.rotate) },
            uMiddleWavePos: { value: new THREE.Vector3(config.waves.middle.x, config.waves.middle.y, config.waves.middle.rotate) },
            uBottomWavePos: { value: new THREE.Vector3(config.waves.bottom.x, config.waves.bottom.y, config.waves.bottom.rotate) },
            uTopOpacity: { value: config.waves.top.opacity },
            uMiddleOpacity: { value: config.waves.middle.opacity },
            uBottomOpacity: { value: config.waves.bottom.opacity }
          },
          transparent: true
        });

        // 创建平面几何体
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // 监听鼠标移动
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('touchmove', (e) => this.onTouchMove(e));

        // 监听窗口大小变化
        window.addEventListener('resize', () => this.resize());

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            this.stop();
          } else {
            this.start();
          }
        });

        // 开始渲染
        this.start();

        // 标记为已加载
        this.container.classList.add('loaded');
        document.body.classList.add('webgl-supported');
      }

      onMouseMove(e) {
        this.targetMouse.x = e.clientX;
        this.targetMouse.y = e.clientY;
      }

      onTouchMove(e) {
        if (e.touches.length > 0) {
          this.targetMouse.x = e.touches[0].clientX;
          this.targetMouse.y = e.touches[0].clientY;
        }
      }

      resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        this.mesh.material.uniforms.iResolution.value.set(width, height);
      }

      render() {
        if (!this.isRunning) return;

        this.time += 0.016; // ~60fps

        // 平滑鼠标跟随
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * config.mouseDamping;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * config.mouseDamping;

        // 更新 uniforms
        this.mesh.material.uniforms.iTime.value = this.time;
        this.mesh.material.uniforms.iMouse.value.set(this.mouse.x, this.mouse.y);

        // 渲染场景
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => this.render());
      }

      start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.render();
      }

      stop() {
        this.isRunning = false;
      }

      destroy() {
        this.stop();
        window.removeEventListener('mousemove', (e) => this.onMouseMove(e));
        window.removeEventListener('touchmove', (e) => this.onTouchMove(e));
        window.removeEventListener('resize', () => this.resize());

        if (this.mesh) {
          this.mesh.geometry.dispose();
          this.mesh.material.dispose();
        }
        if (this.renderer) {
          this.renderer.dispose();
        }
      }
    }

    // 初始化 Floating Lines 背景
    const container = document.getElementById('galaxy-container');
    if (container) {
      const floatingLines = new FloatingLinesBackground(container);
      await floatingLines.init();

      // 暴露到全局以便调试
      window.floatingLinesBackground = floatingLines;
    }

  } catch (error) {
    console.error('Floating Lines background initialization failed:', error);
    document.body.classList.add('webgl-fallback');
  }
})();

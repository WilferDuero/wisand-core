#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const BRAND_DIR = path.join(__dirname, "..", "assets", "brand");
const FILES = {
  iconSvg: path.join(BRAND_DIR, "wisand_icon.svg"),
  logoMainSvg: path.join(BRAND_DIR, "wisand_logo_main.svg"),
  logoLightSvg: path.join(BRAND_DIR, "wisand_logo_light.svg"),
  iconPng: path.join(BRAND_DIR, "wisand_icon.png"),
  logoMainPng: path.join(BRAND_DIR, "wisand_logo_main.png"),
  splashPng: path.join(BRAND_DIR, "wisand_splash.png"),
};

const SPLASH_WIDTH = 1242;
const SPLASH_HEIGHT = 2436;
const SPLASH_LOGO_WIDTH = 760;
const ANDROID_RES_DIR = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "res"
);
const ANDROID_SPLASH_SIZES = [
  { dir: "drawable-mdpi", size: 288 },
  { dir: "drawable-hdpi", size: 432 },
  { dir: "drawable-xhdpi", size: 576 },
  { dir: "drawable-xxhdpi", size: 864 },
  { dir: "drawable-xxxhdpi", size: 1152 },
];
const ANDROID_LAUNCHER_SIZES = [
  { dir: "mipmap-mdpi", launcher: 48, foreground: 108 },
  { dir: "mipmap-hdpi", launcher: 72, foreground: 162 },
  { dir: "mipmap-xhdpi", launcher: 96, foreground: 216 },
  { dir: "mipmap-xxhdpi", launcher: 144, foreground: 324 },
  { dir: "mipmap-xxxhdpi", launcher: 192, foreground: 432 },
];

const assertExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontro el archivo requerido: ${filePath}`);
  }
};

async function generateIcon() {
  await sharp(FILES.iconSvg, { density: 300, limitInputPixels: false })
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(FILES.iconPng);
}

async function generateMainLogo() {
  await sharp(FILES.logoMainSvg, { density: 300, limitInputPixels: false })
    .resize({ width: 1200 })
    .png()
    .toFile(FILES.logoMainPng);
}

async function generateSplash() {
  const logoBuffer = await sharp(FILES.logoMainSvg, { density: 300, limitInputPixels: false })
    .resize({ width: SPLASH_LOGO_WIDTH })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: SPLASH_WIDTH,
      height: SPLASH_HEIGHT,
      channels: 4,
      background: "#FFFFFF",
    },
  })
    .composite([
      {
        input: logoBuffer,
        gravity: "center",
      },
    ])
    .png()
    .toFile(FILES.splashPng);
}

async function generateAndroidNativeSplashResources() {
  if (!fs.existsSync(ANDROID_RES_DIR)) return;

  for (const entry of ANDROID_SPLASH_SIZES) {
    const targetDir = path.join(ANDROID_RES_DIR, entry.dir);
    if (!fs.existsSync(targetDir)) continue;
    const target = path.join(targetDir, "splashscreen_logo.png");
    const logoWidth = Math.round(entry.size * 0.72);
    const logoBuffer = await sharp(FILES.logoMainSvg, { density: 300, limitInputPixels: false })
      .resize({ width: logoWidth })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: entry.size,
        height: entry.size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite([{ input: logoBuffer, gravity: "center" }])
      .png()
      .toFile(target);
  }
}

async function generateAndroidNativeLauncherResources() {
  if (!fs.existsSync(ANDROID_RES_DIR)) return;

  for (const entry of ANDROID_LAUNCHER_SIZES) {
    const targetDir = path.join(ANDROID_RES_DIR, entry.dir);
    if (!fs.existsSync(targetDir)) continue;

    const launcherIcon = await sharp(FILES.iconSvg, { density: 300, limitInputPixels: false })
      .resize(entry.launcher, entry.launcher, {
        fit: "contain",
        background: "#FFFFFF",
      })
      .flatten({ background: "#FFFFFF" })
      .webp({ quality: 100 })
      .toBuffer();

    const launcherForeground = await sharp(FILES.iconSvg, { density: 300, limitInputPixels: false })
      .resize(entry.foreground, entry.foreground, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 100 })
      .toBuffer();

    await fs.promises.writeFile(path.join(targetDir, "ic_launcher.webp"), launcherIcon);
    await fs.promises.writeFile(path.join(targetDir, "ic_launcher_round.webp"), launcherIcon);
    await fs.promises.writeFile(
      path.join(targetDir, "ic_launcher_foreground.webp"),
      launcherForeground
    );
  }
}

async function main() {
  assertExists(FILES.iconSvg);
  assertExists(FILES.logoMainSvg);
  assertExists(FILES.logoLightSvg);

  await generateIcon();
  await generateMainLogo();
  await generateSplash();
  await generateAndroidNativeSplashResources();
  await generateAndroidNativeLauncherResources();

  console.log("[brand:assets] OK");
  console.log(`[brand:assets] ${path.relative(process.cwd(), FILES.iconPng)}`);
  console.log(`[brand:assets] ${path.relative(process.cwd(), FILES.logoMainPng)}`);
  console.log(`[brand:assets] ${path.relative(process.cwd(), FILES.splashPng)}`);
}

main().catch((error) => {
  console.error("[brand:assets] FAILED", error?.message || error);
  process.exit(1);
});

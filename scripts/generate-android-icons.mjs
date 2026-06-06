import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join } from 'node:path'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const { Project } = require('@capacitor/assets/dist/project')
const { AndroidAssetGenerator } = require('@capacitor/assets/dist/platforms/android')
const AndroidAssetTemplates = require('@capacitor/assets/dist/platforms/android/assets')

const projectRoot = process.cwd()
const sourceIconPath = join(projectRoot, 'src-tauri', 'icons', 'icon.png')
const tempAssetsDir = mkdtempSync(join(projectRoot, '.tmp-study-app-android-assets-'))

async function writeNormalizedIcon(destinationPath) {
  const metadata = await sharp(sourceIconPath).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (width >= 1024 && height >= 1024) {
    copyFileSync(sourceIconPath, destinationPath)
    return
  }

  await sharp(sourceIconPath)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(destinationPath)
}

try {
  await writeNormalizedIcon(join(tempAssetsDir, 'icon-only.png'))
  await writeNormalizedIcon(join(tempAssetsDir, 'icon-foreground.png'))

  writeFileSync(
    join(tempAssetsDir, 'icon-background.svg'),
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">',
      '  <rect width="1024" height="1024" fill="#FFFFFF" />',
      '</svg>',
      '',
    ].join('\n'),
    'utf8',
  )

  const project = new Project(
    projectRoot,
    {
      android: { path: 'android' },
      ios: { path: 'ios/App' },
    },
    basename(tempAssetsDir),
  )

  await project.load()

  if (!(await project.assetDirExists())) {
    throw new Error(`Temporary asset directory not found: ${tempAssetsDir}`)
  }

  const assets = await project.loadInputAssets()
  const generator = new AndroidAssetGenerator({ android: true })
  const iconTemplates = Object.values(AndroidAssetTemplates).filter((template) => template.kind === 'icon')

  if (!assets.icon || !assets.iconForeground || !assets.iconBackground) {
    throw new Error('Unable to load generated Android icon source assets')
  }

  for (const template of iconTemplates) {
    await generator.generateLegacyLauncherIcon(project, assets.icon, template)
    await generator.generateRoundLauncherIcon(project, assets.icon, template)
  }

  await generator.generateAdaptiveIconForeground(assets.iconForeground, project)
  await generator.generateAdaptiveIconBackground(assets.iconBackground, project)
} finally {
  rmSync(tempAssetsDir, { recursive: true, force: true })
}

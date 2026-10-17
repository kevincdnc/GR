import { type Browser, chromium } from 'playwright-core'

let browser: Promise<Browser> | null = null

/** Un seul Chromium partagé ; chaque export ouvre son propre contexte isolé. */
export function getBrowser(): Promise<Browser> {
  browser ??= chromium
    .launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // WebGL logiciel (SwiftShader) : MapLibre fonctionne sur un serveur sans GPU
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'],
    })
    .catch((e) => {
      browser = null
      throw e
    })
  return browser
}

export async function closeBrowser() {
  const b = await browser
  browser = null
  await b?.close()
}

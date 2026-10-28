/**
 * dsh-shot-ocr — host half.
 *
 * Owns two ways to turn the screen into text:
 *  - a resident global-hotkey listener (`scripts/hotkey-listener.ps1`) that
 *    captures and recognises text even while another application has focus,
 *    then hands the result to the chat draft through the inbox below;
 *  - an on-demand POST route the Web UI uses for its composer button and its
 *    in-app shortcut.
 *
 * Both paths call `scripts/capture-ocr.ps1`, which freezes the desktop, lets
 * the user drag a region (default), and recognises it with the built-in
 * Windows OCR engine; nothing is uploaded anywhere before the user sends the
 * message.
 *
 * User-facing settings (enabled, hotkey, capture mode…) live in
 * `~/.dsh/shot-ocr/settings.json`, written by the Settings card in the
 * Plugins page and applied immediately by restarting the listener.
 */
import { spawn, execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CAPTURE_SCRIPT = path.join(HERE, 'scripts', 'capture-ocr.ps1')
const LISTENER_SCRIPT = path.join(HERE, 'scripts', 'hotkey-listener.ps1')
const WORK_DIR = path.join(tmpdir(), 'dsh-shot-ocr')
const INBOX_DIR = path.join(WORK_DIR, 'inbox')
const SETTINGS_DIR = path.join(homedir(), '.dsh', 'shot-ocr')
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json')

const MODES = ['region', 'fullscreen', 'window', 'cursor']

const DEFAULTS = {
  /** Master switch for the whole feature. */
  enabled: true,
  /** Register the system-wide hotkey through the resident listener. */
  globalHotkey: true,
  /** System-wide key that captures while any application is in front. */
  hotkey: 'Ctrl+Alt+S',
  /** region | fullscreen | window | cursor */
  mode: 'region',
  /** text = recognise and insert words; image = insert the screenshot itself. */
  output: 'text',
  /** Upscale factor before OCR (1-4). Larger glyphs recognise much better. */
  scale: 2,
  /** BCP-47 OCR language tag; empty follows the Windows user profile. */
  language: '',
  /** Minimise the Harness window for the in-app shortcut so it is not in its own shot. */
  hideApp: true,
  /** Send the recognised text immediately instead of leaving it in the draft. */
  autoSend: false,
  /** Text placed before / after the recognised text. */
  prefix: '',
  suffix: '',
  /** Recognised text is truncated to this many characters. */
  maxChars: 20000,
}

/** Keys the Settings card may write. */
const EDITABLE = ['enabled', 'globalHotkey', 'hotkey', 'mode', 'output', 'scale', 'language', 'hideApp', 'autoSend', 'prefix', 'suffix']

function normalize (config) {
  const raw = config && typeof config === 'object' ? config : {}
  const settings = { ...DEFAULTS, ...raw }
  settings.enabled = settings.enabled !== false
  settings.globalHotkey = settings.globalHotkey !== false
  settings.scale = Math.min(4, Math.max(1, Math.round(Number(settings.scale) || 2)))
  settings.maxChars = Math.min(200000, Math.max(200, Math.round(Number(settings.maxChars) || 20000)))
  settings.mode = MODES.includes(settings.mode) ? settings.mode : 'region'
  settings.output = settings.output === 'image' ? 'image' : 'text'
  settings.hotkey = typeof settings.hotkey === 'string' && settings.hotkey.trim() !== '' ? settings.hotkey.trim() : DEFAULTS.hotkey
  settings.language = typeof settings.language === 'string' ? settings.language.trim() : ''
  settings.prefix = typeof settings.prefix === 'string' ? settings.prefix : ''
  settings.suffix = typeof settings.suffix === 'string' ? settings.suffix : ''
  settings.hideApp = settings.hideApp !== false
  settings.autoSend = settings.autoSend === true
  return settings
}

/** The profile patch seeds first-run defaults; the saved card values win afterwards. */
function loadSaved () {
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    const saved = {}
    for (const key of EDITABLE) {
      if (parsed && Object.hasOwn(parsed, key)) saved[key] = parsed[key]
    }
    return saved
  } catch {
    return {}
  }
}

function reply (value) {
  return Response.json({ ok: true, value }, { headers: { 'cache-control': 'no-store' } })
}

function failure (code, message) {
  return Response.json({ ok: false, error: { code, message } }, { headers: { 'cache-control': 'no-store' } })
}

function cleanText (text, settings) {
  if (typeof text !== 'string') return ''
  const trimmed = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return trimmed.length > settings.maxChars ? trimmed.slice(0, settings.maxChars) : trimmed
}

function createState () {
  return {
    pending: null,
    seq: 0,
    busy: null,
    listener: null,
    listenerError: null,
    disposed: false,
  }
}

function setPending (state, entry) {
  state.seq += 1
  state.pending = { seq: state.seq, at: Date.now(), ...entry }
}

function runCapture (settings, options = {}) {
  return new Promise((resolve) => {
    const wantsImage = settings.output === 'image'
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const png = path.join(WORK_DIR, `shot-${stamp}.png`)
    const json = path.join(WORK_DIR, `shot-${stamp}.json`)
    const args = [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', CAPTURE_SCRIPT,
      '-OutFile', png,
      '-ResultFile', json,
      '-Mode', settings.mode,
      '-Scale', String(wantsImage ? 1 : settings.scale),
    ]
    if (settings.language) args.push('-Lang', settings.language)
    if (wantsImage) args.push('-SkipOcr')
    if (options.hideApp) args.push('-HideApp')

    const started = Date.now()
    // The region picker waits for a human: allow far longer than a fixed shot.
    const timeout = settings.mode === 'region' ? 180000 : 60000
    try {
      execFile('powershell.exe', args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, async (error, _stdout, stderr) => {
        let result = null
        try { result = JSON.parse(await readFile(json, 'utf8')) } catch { /* missing or unreadable */ }
        await rm(json, { force: true }).catch(() => {})

        if (result && result.ok === true && result.imagePath) {
          try {
            const bytes = await readFile(result.imagePath)
            await rm(result.imagePath, { force: true }).catch(() => {})
            resolve({
              ok: true,
              value: {
                image: { mime: 'image/png', base64: bytes.toString('base64') },
                width: result.width,
                height: result.height,
                mode: result.mode,
                elapsedMs: Date.now() - started,
              },
            })
          } catch (error) {
            resolve({ ok: false, error: { code: 'image-read-failed', message: String(error?.message || error) } })
          }
          return
        }
        await rm(png, { force: true }).catch(() => {})

        if (result && result.ok === true) {
          resolve({
            ok: true,
            value: {
              text: cleanText(result.text, settings),
              lang: result.lang,
              lines: result.lines,
              width: result.width,
              height: result.height,
              mode: result.mode,
              scale: result.scale,
              elapsedMs: Date.now() - started,
            },
          })
          return
        }
        if (result?.error?.code === 'cancelled') {
          resolve({ ok: false, error: { code: 'cancelled', message: '已取消截图' } })
          return
        }
        const message = result?.error?.message || (stderr ? String(stderr).trim().split('\n').slice(-2).join(' ') : '') || error?.message || 'capture failed'
        resolve({ ok: false, error: { code: result?.error?.code || 'capture-failed', message } })
      })
    } catch (error) {
      resolve({ ok: false, error: { code: 'spawn-failed', message: String(error?.message || error) } })
    }
  })
}

async function scanInbox (state, getSettings) {
  let names
  try { names = await readdir(INBOX_DIR) } catch { return }
  const results = names.filter((name) => /^result-.*\.json$/.test(name)).sort()
  for (const name of results) {
    const file = path.join(INBOX_DIR, name)
    const settings = getSettings()
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'))
      if (parsed?.ok === true && parsed.imagePath) {
        try {
          const bytes = await readFile(parsed.imagePath)
          await rm(parsed.imagePath, { force: true }).catch(() => {})
          setPending(state, {
            kind: 'image',
            image: { mime: 'image/png', base64: bytes.toString('base64') },
            width: parsed.width,
            height: parsed.height,
            elapsedMs: parsed.elapsedMs,
          })
        } catch (error) {
          setPending(state, { kind: 'error', code: 'image-read-failed', message: String(error?.message || error) })
        }
      } else if (parsed?.ok === true) {
        const text = cleanText(parsed.text, settings)
        setPending(state, { kind: 'ok', text, lang: parsed.lang, lines: parsed.lines, elapsedMs: parsed.elapsedMs })
      } else {
        setPending(state, { kind: 'error', code: parsed?.error?.code, message: parsed?.error?.message || 'capture failed' })
      }
    } catch {
      continue // a half-written file is retried on the next scan
    }
    await rm(file, { force: true }).catch(() => {})
  }
}

function bridgeListener (ctx, settings, state) {
  const args = [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', LISTENER_SCRIPT,
    '-OutDir', WORK_DIR,
    '-CaptureScript', CAPTURE_SCRIPT,
    '-Hotkey', settings.hotkey,
    '-Mode', settings.mode,
    '-Scale', String(settings.output === 'image' ? 1 : settings.scale),
  ]
  if (settings.language) args.push('-Lang', settings.language)
  if (settings.output === 'image') args.push('-SkipOcr')
  let attempts = 0
  let stopped = false
  let restartTimer = null
  let child = null

  const launch = () => {
    if (stopped) return
    try {
      child = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      state.listenerError = `无法启动截图快捷键监听进程：${error?.message || error}`
      return
    }
    state.listener = child
    attempts += 1
    child.stdout?.on('data', (chunk) => {
      const line = String(chunk).trim()
      if (line) ctx.logger?.debug?.(`dsh-shot-ocr: ${line}`)
    })
    child.stderr?.on('data', (chunk) => {
      const line = String(chunk).trim()
      if (line) ctx.logger?.warn?.(`dsh-shot-ocr listener: ${line}`)
    })
    child.on('exit', (code) => {
      state.listener = null
      if (stopped) return
      // Exit 4 = RegisterHotKey refused (the combination is taken). Do not spin.
      if (code === 4) {
        state.listenerError = `全局快捷键 ${settings.hotkey} 注册失败，可能已被其他程序占用。`
        return
      }
      if (attempts <= 5) {
        restartTimer = setTimeout(launch, 3000)
        if (restartTimer.unref) restartTimer.unref()
      } else {
        state.listenerError = '截图快捷键监听进程反复退出。'
      }
    })
    // A fresh launch resolves whatever error the card showed before.
    if (state.listenerError && state.listenerError.startsWith('全局快捷键')) state.listenerError = null
  }

  launch()
  return () => {
    stopped = true
    if (restartTimer) clearTimeout(restartTimer)
    try { child?.kill() } catch { /* already gone */ }
    state.listener = null
  }
}

async function prepareWorkDir (ctx) {
  await mkdir(INBOX_DIR, { recursive: true })
  try {
    for (const name of await readdir(INBOX_DIR)) {
      if (/^result-.*\.json$/.test(name)) await rm(path.join(INBOX_DIR, name), { force: true })
    }
  } catch { /* first run */ }
  try { await rm(path.join(WORK_DIR, 'listener.json'), { force: true }) } catch { /* absent */ }
  await writeFile(path.join(WORK_DIR, '.owner'), String(process.pid), 'utf8').catch(() => {})
  ctx.logger?.debug?.(`dsh-shot-ocr: work dir ${WORK_DIR}`)
}

async function persistSettings (settings) {
  const saved = {}
  for (const key of EDITABLE) saved[key] = settings[key]
  await mkdir(SETTINGS_DIR, { recursive: true })
  await writeFile(SETTINGS_FILE, JSON.stringify(saved, null, 2) + '\n', 'utf8')
}

function effectiveSettings (seed) {
  return normalize({ ...seed, ...loadSaved() })
}

export const name = 'dsh-shot-ocr'
export const inject = ['connection']

export function apply (ctx, config) {
  const state = createState()
  const supported = process.platform === 'win32'
  let settings = effectiveSettings(normalize(config))

  let stopListener = () => {}
  const restartListener = () => {
    stopListener()
    stopListener = () => {}
    if (!supported || !settings.globalHotkey || !settings.enabled) return
    stopListener = bridgeListener(ctx, settings, state)
  }
  const current = () => settings

  if (supported) {
    ctx.effect(() => {
      let stopped = false
      void (async () => {
        await prepareWorkDir(ctx)
        if (stopped) return
        restartListener()
      })()
      const scan = setInterval(() => { void scanInbox(state, current) }, 600)
      if (scan.unref) scan.unref()
      return () => {
        stopped = true
        state.disposed = true
        clearInterval(scan)
        stopListener()
      }
    }, 'dsh-shot-ocr: capture runtime')
  } else {
    ctx.logger?.warn?.('dsh-shot-ocr: desktop capture is only implemented on Windows')
  }

  ctx.inject(['connection'], (scoped) => {
    const connection = scoped.get('connection')
    if (typeof connection?.fetch?.register !== 'function') return

    const route = (routePath, handler, description) => {
      scoped.effect(() => connection.fetch.register({
        path: routePath,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handler,
      }), description)
    }

    const publicSettings = () => ({
      enabled: settings.enabled,
      autoSend: settings.autoSend,
      prefix: settings.prefix,
      suffix: settings.suffix,
      mode: settings.mode,
      output: settings.output,
      hotkey: settings.hotkey,
      globalHotkey: settings.globalHotkey,
      hideApp: settings.hideApp,
      scale: settings.scale,
      language: settings.language,
      supported,
      listenerError: state.listenerError,
    })

    route('/api/dsh-shot/settings', () => reply(publicSettings()), 'dsh-shot-ocr: settings route')

    route('/api/dsh-shot/save', async (request) => {
      let body = null
      try { body = await request.json() } catch { /* empty body */ }
      if (!body || typeof body !== 'object') return failure('bad-request', '设置内容为空')
      const patch = {}
      for (const key of EDITABLE) {
        if (Object.hasOwn(body, key)) patch[key] = body[key]
      }
      if (typeof patch.hotkey === 'string') {
        patch.hotkey = patch.hotkey.trim()
        if (!/^[A-Za-z0-9+\-\s]+$/.test(patch.hotkey)) return failure('bad-hotkey', '快捷键格式不正确')
      }
      const next = normalize({ ...settings, ...patch })
      next.maxChars = settings.maxChars
      settings = next
      try {
        await persistSettings(settings)
      } catch (error) {
        return failure('save-failed', `保存失败：${error?.message || error}`)
      }
      state.listenerError = null
      restartListener()
      return reply(publicSettings())
    }, 'dsh-shot-ocr: save route')

    route('/api/dsh-shot/capture', async () => {
      if (!supported) return failure('unsupported-platform', '截图识别目前只支持 Windows。')
      if (!settings.enabled) return failure('disabled', '截图识字功能已关闭。')
      if (state.busy) return reply({ text: '', busy: true })
      const run = runCapture(settings, { hideApp: settings.hideApp })
      state.busy = run
      try {
        // `run` already carries the {ok, value|error} envelope the client reads.
        return Response.json(await run, { headers: { 'cache-control': 'no-store' } })
      } finally {
        if (state.busy === run) state.busy = null
      }
    }, 'dsh-shot-ocr: capture route')

    route('/api/dsh-shot/pending', () => reply({
      pending: state.pending,
      listenerError: state.listenerError,
      hotkey: settings.hotkey,
      enabled: settings.enabled,
      supported,
    }), 'dsh-shot-ocr: pending route')

    route('/api/dsh-shot/hello', async (request) => {
      let body = null
      try { body = await request.json() } catch { /* no body */ }
      state.client = { at: Date.now(), ...(body && typeof body === 'object' ? body : {}) }
      await writeFile(path.join(WORK_DIR, 'client.json'), JSON.stringify(state.client), 'utf8').catch(() => {})
      return reply({ ok: true })
    }, 'dsh-shot-ocr: client beacon route')

    route('/api/dsh-shot/ack', async (request) => {
      let seq = 0
      try { seq = Number((await request.json())?.seq) || 0 } catch { /* empty body */ }
      if (seq > 0 && state.pending && state.pending.seq <= seq) state.pending = null
      return reply({ cleared: state.pending === null })
    }, 'dsh-shot-ocr: ack route')
  })
}

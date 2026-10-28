window.__ModuleLoader__.load({
  id: 'dsh-shot-ocr',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-shot-ocr'
    const API = 'api/dsh-shot'
    const BUNDLE_KEY = 'dsh-shot-ocr'

    const MODE_OPTIONS = [
      { value: 'region', zh: '拖动选择区域', en: 'Drag a region' },
      { value: 'window', zh: '当前窗口', en: 'Foreground window' },
      { value: 'cursor', zh: '鼠标所在屏幕', en: 'Monitor under pointer' },
      { value: 'fullscreen', zh: '整个桌面', en: 'Whole desktop' },
    ]

    const zh = {
      'meta.title': '截图识别文字提问',
      'meta.description': '按快捷键截取桌面并识别文字，直接填入对话输入框提问。',
      'action.label': '截图识别文字',
      'action.short': '截图识字',
      'status.busy': '正在识别…',
      'status.empty': '没有识别到文字',
      'status.done': '已填入 {n} 个字',
      'status.conflict': '输入框正在更新，请重试',
      'status.noSession': '请先打开一个对话',
      'status.failed': '识别失败：{message}',
      'status.disabled': '截图识字已关闭',
      'status.imageDone': '已插入截图',
      'status.noImageSupport': '当前输入框不支持插入图片',
      'settings.output': '识别方式',
      'settings.outputHint': '「直接插入截图」跳过文字识别，把选区图片放进输入框。',
      'settings.outputText': '识别文字',
      'settings.outputImage': '直接插入截图',
      'shortcut.label': '截图识别文字',
      'shortcut.noSession': '请先打开一个对话',
      'settings.title': '截图识别文字',
      'settings.subtitle': '按快捷键截图、本机识别文字并填入输入框。',
      'settings.enabled': '启用截图识字',
      'settings.enabledHint': '关闭后快捷键和按钮都不再触发截图。',
      'settings.hotkey': '全局截图快捷键',
      'settings.hotkeyHint': '在任何程序前面都能使用；留空或关闭下方开关则不注册。',
      'settings.hotkeyRecord': '录入',
      'settings.hotkeyRecording': '请按下新的组合键…（Esc 取消）',
      'settings.hotkeyNeedsModifier': '请至少按住 Ctrl / Alt / Shift / Win 中的一个',
      'settings.globalHotkey': '注册全局快捷键',
      'settings.mode': '截图范围',
      'settings.modeHint': '默认拖动选择区域；识别小字时区域越小越准。',
      'settings.autoSend': '识别后直接发送',
      'settings.autoSendHint': '关闭时只填入输入框，等你自己补充问题后发送。',
      'settings.hideApp': '截图时最小化窗口',
      'settings.hideAppHint': '应用内快捷键截图前先把自己藏起来，避免截到自己。',
      'settings.scale': '识别放大倍数',
      'settings.scaleHint': '2 倍适合大多数屏幕；字很小时可调到 3。',
      'settings.language': '识别语言',
      'settings.languageHint': '留空跟随系统，例如 zh-Hans-CN。',
      'settings.saved': '已保存',
      'settings.saving': '保存中…',
      'settings.failed': '保存失败：{message}',
      'settings.hotkeyError': '快捷键注册失败：{message}',
      'settings.loading': '加载中…',
    }
    const en = {
      'meta.title': 'Screenshot to text',
      'meta.description': 'Capture the desktop with a hotkey, recognise its text, and drop it into the message box.',
      'action.label': 'Capture screen text',
      'action.short': 'Screen text',
      'status.busy': 'Recognising…',
      'status.empty': 'No text recognised',
      'status.done': 'Inserted {n} characters',
      'status.conflict': 'The draft changed, please retry',
      'status.noSession': 'Open a conversation first',
      'status.failed': 'Recognition failed: {message}',
      'status.disabled': 'Screenshot to text is off',
      'status.imageDone': 'Screenshot inserted',
      'status.noImageSupport': 'This composer cannot take an image',
      'settings.output': 'Output',
      'settings.outputHint': '"Insert screenshot" skips OCR and drops the image into the draft.',
      'settings.outputText': 'Recognise text',
      'settings.outputImage': 'Insert screenshot',
      'shortcut.label': 'Capture screen text',
      'shortcut.noSession': 'Open a conversation first',
      'settings.title': 'Screenshot to text',
      'settings.subtitle': 'Hotkey screenshot, on-device OCR, straight into the message box.',
      'settings.enabled': 'Enable screenshot to text',
      'settings.enabledHint': 'When off, neither the hotkey nor the button captures.',
      'settings.hotkey': 'Global capture hotkey',
      'settings.hotkeyHint': 'Works while any app is in front.',
      'settings.hotkeyRecord': 'Record',
      'settings.hotkeyRecording': 'Press the new combination… (Esc cancels)',
      'settings.hotkeyNeedsModifier': 'Hold at least one of Ctrl / Alt / Shift / Win',
      'settings.globalHotkey': 'Register the global hotkey',
      'settings.mode': 'Capture area',
      'settings.modeHint': 'A dragged region recognises small text best.',
      'settings.autoSend': 'Send right after recognising',
      'settings.autoSendHint': 'Off leaves the text in the draft for you to ask.',
      'settings.hideApp': 'Minimise the window while capturing',
      'settings.hideAppHint': 'Keeps the app out of its own screenshot.',
      'settings.scale': 'OCR upscale',
      'settings.scaleHint': '2x suits most screens; use 3 for tiny text.',
      'settings.language': 'OCR language',
      'settings.languageHint': 'Empty follows the system, e.g. zh-Hans-CN.',
      'settings.saved': 'Saved',
      'settings.saving': 'Saving…',
      'settings.failed': 'Save failed: {message}',
      'settings.hotkeyError': 'Hotkey registration failed: {message}',
      'settings.loading': 'Loading…',
    }

    // ---- tiny stores -------------------------------------------------------
    function createStore (initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set (next) {
          value = typeof next === 'function' ? next(value) : next
          for (const listener of listeners) listener()
        },
        subscribe (listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    const status = createStore({ phase: 'idle', message: '' })
    const settings = createStore({
      enabled: true,
      autoSend: false,
      prefix: '',
      suffix: '',
      hotkey: 'Ctrl+Alt+S',
      globalHotkey: true,
      hideApp: true,
      mode: 'region',
      output: 'text',
      scale: 2,
      language: '',
      supported: true,
      listenerError: null,
    })

    /** The composer's insertion face, published by the mounted dock entry. */
    let insertion = null
    let currentSessionId = ''
    let conversationService = null
    let rootCtx = null

    /** Resolve the Conversation service; it is not reachable through ctx.inject here. */
    function getConversation () {
      if (conversationService) return conversationService
      try {
        conversationService = rootCtx && typeof rootCtx.get === 'function' ? rootCtx.get('conversation') : null
      } catch {
        conversationService = null
      }
      return conversationService
    }
    let lastSeq = 0
    let pollTimer = null
    let clearTimer = null

    function flash (phase, message, ttl = 4000) {
      status.set({ phase, message })
      if (clearTimer) clearTimeout(clearTimer)
      if (ttl > 0) {
        clearTimer = setTimeout(() => {
          if (status.get().phase === phase) status.set({ phase: 'idle', message: '' })
        }, ttl)
      }
    }

    async function post (pathname, body) {
      const response = await fetch(API + pathname, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const payload = await response.json()
      if (!payload || payload.ok !== true) {
        const error = new Error(payload?.error?.message || 'request failed')
        error.code = payload?.error?.code
        throw error
      }
      return payload.value
    }

    /** Announces that this browser half loaded; the Host records it for support. */
    function hello (phase, extra) {
      void post('/hello', { phase, ...(extra || {}) }).catch(() => {})
    }

    async function refreshSettings () {
      try {
        const value = await post('/settings')
        if (value) settings.set({ ...settings.get(), ...value })
      } catch {
        /* keep the last known settings */
      }
    }

    /** Turn a recognised-text result into a draft insertion. */
    function insertText (text) {
      if (!insertion) return 'no-session'
      const current = settings.get()
      const composed = `${current.prefix || ''}${text}${current.suffix || ''}`
      let ok = insertion.insertText(composed, insertion.captureInsertion())
      if (!ok) ok = insertion.insertText(composed, insertion.captureInsertion())
      if (!ok) return 'conflict'
      if (current.autoSend) {
        try { insertion.submit() } catch { /* leave the text in place */ }
      }
      return null
    }

    /**
     * Attach a captured PNG to the draft as an image.
     * Mirrors what the composer's own paste/drop path does: allocate draft
     * attachments through the conversation service, then hand their ids to
     * the input shell, which renders and sends them.
     */
    function insertImage (image, sessionId) {
      if (!insertion) return 'no-session'
      const service = getConversation()
      if (!service || typeof service.createDrafts !== 'function') return 'no-image-support'
      if (!sessionId) return 'no-session'
      try {
        const binary = atob(image.base64 || '')
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
        const file = new File([bytes], `screenshot-${Date.now()}.png`, { type: image.mime || 'image/png' })
        const drafts = service.createDrafts(sessionId, [file])
        const ok = insertion.addAttachments(drafts.map((draft) => draft.id))
        if (!ok) {
          if (typeof service.releaseDraftAttachments === 'function') service.releaseDraftAttachments(drafts)
          return 'conflict'
        }
        if (settings.get().autoSend) {
          try { insertion.submit() } catch { /* leave the image in place */ }
        }
        return null
      } catch (error) {
        return String(error?.message || error)
      }
    }

    function messageFor (reason, t) {
      if (reason === 'no-session') return t('status.noSession')
      if (reason === 'conflict') return t('status.conflict')
      if (reason === 'no-image-support') return t('status.noImageSupport')
      return t('status.failed', { message: reason })
    }

    async function runInAppCapture (t) {
      if (status.get().phase === 'busy') return
      if (!insertion) {
        flash('error', t('status.noSession'))
        return
      }
      flash('busy', t('status.busy'), 0)
      try {
        const value = await post('/capture')
        if (value?.busy) {
          flash('idle', '')
          return
        }
        if (value?.image) {
          const problem = insertImage(value.image, currentSessionId)
          if (problem) flash('error', messageFor(problem, t))
          else flash('done', t('status.imageDone'))
          return
        }
        if (!value?.text) {
          flash('error', t('status.empty'))
          return
        }
        const problem = insertText(value.text)
        if (problem) flash('error', messageFor(problem, t))
        else flash('done', t('status.done', { n: value.text.length }))
      } catch (error) {
        if (error?.code === 'cancelled') {
          flash('idle', '')
          return
        }
        if (error?.code === 'disabled') {
          flash('error', t('status.disabled'))
          return
        }
        flash('error', t('status.failed', { message: String(error?.message || error) }))
      }
    }

    // `poll` runs outside the slot component, so it needs its own dictionary.
    let tGlobal = (key) => key
    function bindGlobalT (ctx) {
      tGlobal = ctx.locale.bind(NS)
    }

    /** Deliver captures made by the global hotkey while another app was in front. */
    let reportedListenerError = ''
    async function poll () {
      if (!insertion || pollTimer) return
      pollTimer = setTimeout(() => { pollTimer = null }, 1200)
      try {
        const value = await post('/pending')
        if (value) {
          if (typeof value.enabled === 'boolean' && value.enabled !== settings.get().enabled) {
            settings.set({ ...settings.get(), enabled: value.enabled, listenerError: value.listenerError ?? null })
          }
          if (value.listenerError && value.listenerError !== reportedListenerError) {
            reportedListenerError = value.listenerError
            flash('error', value.listenerError, 8000)
          }
        }
        const pending = value?.pending
        if (!pending || typeof pending.seq !== 'number' || pending.seq <= lastSeq) return
        if (!insertion) return
        lastSeq = pending.seq
        if (pending.kind === 'error') {
          if (pending.code !== 'cancelled') flash('error', tGlobal('status.failed', { message: pending.message }))
        } else if (pending.kind === 'image' && pending.image) {
          const problem = insertImage(pending.image, currentSessionId)
          if (problem) flash('error', messageFor(problem, tGlobal))
          else flash('done', tGlobal('status.imageDone'))
        } else if (pending.text) {
          const problem = insertText(pending.text)
          if (problem) flash('error', messageFor(problem, tGlobal))
          else flash('done', tGlobal('status.done', { n: pending.text.length }))
        } else {
          flash('error', tGlobal('status.empty'))
        }
        await post('/ack', { seq: pending.seq })
      } catch {
        /* host not ready yet; the next tick retries */
      }
    }

    // ---- shared look -------------------------------------------------------
    const muted = { fontSize: '11px', lineHeight: 1.5, opacity: 0.62 }
    const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', minHeight: '30px' }
    const stackStyle = { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }
    const controlStyle = {
      font: 'inherit', fontSize: '12px', color: 'inherit',
      background: 'var(--dsw-alias-bg-elevated, rgba(127,127,127,.10))',
      border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.28))',
      borderRadius: '7px', padding: '4px 8px', outline: 'none',
    }

    function Switch ({ checked, onChange, label, disabled }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': label,
        disabled,
        onClick: () => onChange(!checked),
        style: {
          position: 'relative', width: '38px', height: '22px', flex: '0 0 auto',
          borderRadius: '11px', border: 'none', cursor: disabled ? 'default' : 'pointer',
          background: checked ? 'var(--dsw-alias-accent, #2b7de9)' : 'rgba(128,128,128,.35)',
          transition: 'background .15s ease', opacity: disabled ? 0.5 : 1,
        },
      }, h('span', {
        style: {
          position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
          transition: 'left .15s ease', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
        },
      }))
    }

    function Field ({ title, hint, children }) {
      return h('div', { style: rowStyle },
        h('div', { style: stackStyle },
          h('span', null, title),
          hint ? h('span', { style: muted }, hint) : null,
        ),
        children,
      )
    }

    /** Keyboard capture: builds a "Ctrl+Alt+S" string from the next chord. */
    function HotkeyRecorder ({ value, onChange, t }) {
      const [recording, setRecording] = React.useState(false)
      const [problem, setProblem] = React.useState('')

      React.useEffect(() => {
        if (!recording) return undefined
        const onKey = (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') {
            setRecording(false)
            setProblem('')
            return
          }
          if (event.repeat) return
          const parts = []
          if (event.ctrlKey) parts.push('Ctrl')
          if (event.altKey) parts.push('Alt')
          if (event.shiftKey) parts.push('Shift')
          if (event.metaKey) parts.push('Win')
          const code = event.code || ''
          let key = ''
          if (/^Key[A-Z]$/.test(code)) key = code.slice(3)
          else if (/^Digit[0-9]$/.test(code)) key = code.slice(5)
          else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code
          if (!key) return
          if (parts.length === 0) {
            setProblem(t('settings.hotkeyNeedsModifier'))
            return
          }
          parts.push(key)
          setProblem('')
          setRecording(false)
          onChange(parts.join('+'))
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [recording, onChange, t])

      return h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('code', {
          style: {
            ...controlStyle,
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
            minWidth: '104px', textAlign: 'center', display: 'inline-block',
          },
        }, recording ? t('settings.hotkeyRecording') : (value || '—')),
        h('button', {
          type: 'button',
          onClick: () => { setProblem(''); setRecording((was) => !was) },
          style: { ...controlStyle, cursor: 'pointer' },
        }, recording ? 'Esc' : t('settings.hotkeyRecord')),
        problem ? h('span', { style: { ...muted, color: 'var(--dsw-alias-state-warning, #d08b1a)' } }, problem) : null,
      )
    }

    function SettingsCard (props) {
      const t = typeof props.t === 'function' ? props.t : tGlobal
      const current = React.useSyncExternalStore(settings.subscribe, settings.get, settings.get)
      const [busy, setBusy] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [error, setError] = React.useState('')
      const noticeTimer = React.useRef(0)

      React.useEffect(() => {
        void refreshSettings()
      }, [])

      const save = React.useCallback(async (patch) => {
        setBusy('saving')
        setError('')
        try {
          const value = await post('/save', patch)
          if (value) settings.set({ ...settings.get(), ...value })
          setNotice(t('settings.saved'))
          window.clearTimeout(noticeTimer.current)
          noticeTimer.current = window.setTimeout(() => setNotice(''), 2200)
          // Re-read shortly after: a hotkey the OS refuses surfaces on the listener.
          window.setTimeout(() => { void refreshSettings() }, 1500)
        } catch (failure) {
          setError(t('settings.failed', { message: String(failure?.message || failure) }))
        } finally {
          setBusy('')
        }
      }, [t])

      const modeOption = MODE_OPTIONS.find((option) => option.value === current.mode) || MODE_OPTIONS[0]
      // The locale service has no "current locale" getter; compare a known string.
      const isZh = t('settings.title') === zh['settings.title']

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('strong', { style: { fontSize: '14px' } }, t('settings.title')),
          h('span', { style: muted }, t('settings.subtitle')),
        ),

        h(Field, { title: t('settings.enabled'), hint: t('settings.enabledHint') },
          h(Switch, {
            checked: current.enabled,
            label: t('settings.enabled'),
            onChange: (next) => void save({ enabled: next }),
          }),
        ),

        h('div', { style: { ...rowStyle, alignItems: 'flex-start' } },
          h('div', { style: stackStyle },
            h('span', null, t('settings.hotkey')),
            h('span', { style: muted }, t('settings.hotkeyHint')),
          ),
          h(HotkeyRecorder, { value: current.hotkey, onChange: (next) => void save({ hotkey: next }), t }),
        ),

        h(Field, { title: t('settings.globalHotkey') },
          h(Switch, {
            checked: current.globalHotkey,
            label: t('settings.globalHotkey'),
            disabled: !current.enabled,
            onChange: (next) => void save({ globalHotkey: next }),
          }),
        ),

        h(Field, { title: t('settings.mode'), hint: t('settings.modeHint') },
          h('select', {
            value: current.mode,
            onChange: (event) => void save({ mode: event.target.value }),
            style: { ...controlStyle, minWidth: '132px', cursor: 'pointer' },
          }, MODE_OPTIONS.map((option) => h('option', {
            key: option.value,
            value: option.value,
          }, isZh ? option.zh : option.en))),
        ),

        h(Field, { title: t('settings.output'), hint: t('settings.outputHint') },
          h('select', {
            value: current.output,
            onChange: (event) => void save({ output: event.target.value }),
            style: { ...controlStyle, minWidth: '132px', cursor: 'pointer' },
          },
            h('option', { value: 'text' }, t('settings.outputText')),
            h('option', { value: 'image' }, t('settings.outputImage'))),
        ),

        h(Field, { title: t('settings.autoSend'), hint: t('settings.autoSendHint') },
          h(Switch, {
            checked: current.autoSend,
            label: t('settings.autoSend'),
            onChange: (next) => void save({ autoSend: next }),
          }),
        ),

        h(Field, { title: t('settings.hideApp'), hint: t('settings.hideAppHint') },
          h(Switch, {
            checked: current.hideApp,
            label: t('settings.hideApp'),
            onChange: (next) => void save({ hideApp: next }),
          }),
        ),

        current.output === 'text'
          ? h(Field, { title: t('settings.scale'), hint: t('settings.scaleHint') },
            h('input', {
              type: 'number', min: 1, max: 4, step: 1,
              value: current.scale,
              onChange: (event) => {
                const next = Math.min(4, Math.max(1, Math.round(Number(event.target.value) || 2)))
                void save({ scale: next })
              },
              style: { ...controlStyle, width: '64px' },
            }),
          )
          : null,

        current.output === 'text'
          ? h(Field, { title: t('settings.language'), hint: t('settings.languageHint') },
            h('input', {
              type: 'text',
              value: current.language || '',
              placeholder: 'zh-Hans-CN',
              onChange: (event) => void save({ language: event.target.value }),
              style: { ...controlStyle, width: '132px' },
            }),
          )
          : null,

        current.listenerError
          ? h('div', { style: { ...muted, color: 'var(--dsw-alias-state-warning, #d08b1a)' } },
            t('settings.hotkeyError', { message: current.listenerError }))
          : null,
        error ? h('div', { style: { ...muted, color: 'var(--dsw-alias-state-danger, #d33)' } }, error) : null,
        notice || busy === 'saving'
          ? h('div', { style: muted }, busy === 'saving' ? t('settings.saving') : notice)
          : null,
      )
    }

    // ---- composer dock button ---------------------------------------------
    function icon () {
      return h('svg', {
        viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M4 8V6a2 2 0 0 1 2-2h2' }),
        h('path', { d: 'M16 4h2a2 2 0 0 1 2 2v2' }),
        h('path', { d: 'M20 16v2a2 2 0 0 1-2 2h-2' }),
        h('path', { d: 'M8 20H6a2 2 0 0 1-2-2v-2' }),
        h('path', { d: 'M7 12h10' }),
        h('path', { d: 'M9 9h6' }),
        h('path', { d: 'M9 15h4' }),
      )
    }

    function ShotButton (props) {
      const t = typeof props.t === 'function' ? props.t : tGlobal
      const inputActions = props.inputActions
      const locked = props.locked === true
      const state = React.useSyncExternalStore(status.subscribe, status.get, status.get)
      const config = React.useSyncExternalStore(settings.subscribe, settings.get, settings.get)

      React.useEffect(() => {
        if (!inputActions) return undefined
        insertion = inputActions
        currentSessionId = props.sessionId || ''
        void refreshSettings()
        hello('slot', { props: Object.keys(props).join(',') })
        void poll()
        const timer = setInterval(() => { if (!document.hidden) void poll() }, 1500)
        const wake = () => { void poll() }
        window.addEventListener('focus', wake)
        document.addEventListener('visibilitychange', wake)
        return () => {
          clearInterval(timer)
          window.removeEventListener('focus', wake)
          document.removeEventListener('visibilitychange', wake)
          if (insertion === inputActions) insertion = null
          currentSessionId = ''
        }
      }, [inputActions])

      if (config.enabled === false) return null

      const busy = state.phase === 'busy'
      const hotkey = config.hotkey || ''
      const label = busy ? t('status.busy') : t('action.label')
      const title = state.phase === 'error' || state.phase === 'done'
        ? state.message
        : `${label}${hotkey ? ` (${hotkey})` : ''}`

      return h('div', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 },
      },
        h('button', {
          type: 'button',
          title,
          'aria-label': t('action.label'),
          disabled: busy || locked,
          onClick: () => { void runInAppCapture(t) },
          style: {
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            height: '26px', padding: '0 8px', borderRadius: '7px',
            border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.32))',
            background: 'transparent', color: 'inherit', font: 'inherit',
            fontSize: '12px', lineHeight: 1, cursor: busy || locked ? 'default' : 'pointer',
            opacity: busy || locked ? 0.55 : 0.85, whiteSpace: 'nowrap',
          },
        },
          busy
            ? h('span', { style: { display: 'inline-block', animation: 'dsh-shot-spin 0.9s linear infinite' } }, h('svg', {
              viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4,
              'aria-hidden': true,
            }, h('path', { d: 'M12 3a9 9 0 1 0 9 9', strokeLinecap: 'round' })))
            : icon(),
          h('span', null, busy ? t('status.busy') : t('action.short')),
        ),
        state.phase === 'error' ? h('span', {
          role: 'status',
          style: { fontSize: '11px', opacity: 0.75, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, state.message) : null,
        h('style', null, '@keyframes dsh-shot-spin{to{transform:rotate(360deg)}}'),
      )
    }

    // ---- plugin ------------------------------------------------------------
    const inject = ['slots', 'locale']

    function apply (ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-shot-ocr: dictionaries')
      bindGlobalT(ctx)
      const t = ctx.locale.bind(NS)
      hello('apply')
      rootCtx = ctx
      void getConversation()

      // Image mode needs the Conversation service to allocate draft attachments.
      // The shortcut service is optional: without it the composer button still works.
      ctx.inject(['shortcuts'], (scoped) => {
        scoped.effect(() => {
          try {
            return scoped.shortcuts.register({
              id: 'dsh-shot-ocr.capture',
              label: () => t('shortcut.label'),
              aliases: ['screenshot text', 'ocr screenshot', 'capture screen text', '截图', '识字'],
              defaults: {
                'desktop:windows': { code: 'KeyS', modifiers: ['primary', 'shift'] },
                'desktop:macos': { code: 'KeyS', modifiers: ['primary', 'shift'] },
                'desktop:linux': { code: 'KeyS', modifiers: ['primary', 'shift'] },
                'web:windows': { code: 'KeyS', modifiers: ['primary', 'shift'] },
                'web:macos': { code: 'KeyS', modifiers: ['primary', 'shift'] },
                'web:linux': { code: 'KeyS', modifiers: ['primary', 'shift'] },
              },
              regions: ['page', 'editable'],
              modals: [],
              resolve: () => {
                if (settings.get().enabled === false) return { status: 'blocked', reason: t('status.disabled') }
                if (!insertion) return { status: 'blocked', reason: t('shortcut.noSession') }
                if (status.get().phase === 'busy') return { status: 'blocked', reason: t('status.busy') }
                return { status: 'handled', run: () => { void runInAppCapture(t) } }
              },
            })
          } catch (error) {
            // A taken key combination must not disable the rest of the plugin.
            console.warn('dsh-shot-ocr: shortcut registration failed', error)
            return () => {}
          }
        }, 'dsh-shot-ocr: capture shortcut')
      })

      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'dsh-shot-ocr',
        order: 20,
        locale: NS,
      }, ShotButton))

      // The card under Plugins → dsh-shot-ocr → Configuration.
      ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: BUNDLE_KEY,
        locale: NS,
      }, SettingsCard))
    }

    return { inject, apply }
  },
})

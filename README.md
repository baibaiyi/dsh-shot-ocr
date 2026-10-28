# 截图识别文字提问（dsh-shot-ocr）

Capture a region of the desktop with a global hotkey, then either recognise its text with the built-in Windows OCR engine or attach the screenshot to the DeepSeek Harness chat draft.

- Windows 10/11, Windows PowerShell 5.1 (WinRT OCR)
- Global hotkey (default `Ctrl+Alt+S`), in-app shortcut, or the composer button
- Drag-to-select region, full screen, foreground window, or the monitor under the pointer
- Two outputs: recognised text, or the screenshot itself as a draft attachment
- Settings card under **Plugins → dsh-shot-ocr**: on/off switch, hotkey recorder, capture area, output mode, auto-send, OCR scale and language
- OCR runs locally; nothing leaves the machine until you send the message

---

按一个快捷键截取桌面（默认**拖动框选区域**），用 Windows 自带 OCR 识别文字，把结果直接填进 DeepSeek Harness 的输入框——不用先存图片、不用手动打字。

识别全部在本机完成，图片不会上传到任何地方；只有你按下发送后，文字才会作为消息进入对话。

## 功能

| 入口 | 默认键 | 作用 |
| --- | --- | --- |
| **全局快捷键** | `Ctrl + Alt + S` | 在**任何程序**前面时按下都能截图（Harness 在后台也可以）：屏幕冻结 → 拖动选区 → 识别 → Harness 自动切到前台，文字进输入框 |
| **应用内快捷键** | `Ctrl + Shift + S` | Harness 窗口在前台时使用；可先最小化 Harness 再截图。可在 **设置 → 快捷键** 改键 |
| **输入框按钮** | — | 输入框下方（上下文占用环旁边）的「截图识字」 |
| **插件设置卡片** | — | **插件 → 截图识别文字提问 → 配置**：功能开关、全局快捷键录入、截图范围、自动发送等 |

识别结果默认只填入输入框，方便你补一句问题再发送；打开「识别后直接发送」后会直接发送。

## 两种输出方式

设置卡片里的「识别方式」可以切换：

| 方式 | 行为 |
| --- | --- |
| **识别文字**（默认） | 选区 → Windows OCR → 文字填进输入框（可加前后缀） |
| **直接插入截图** | 选区 → 跳过 OCR → 原图作为附件插入输入框（和粘贴截图一样，可直接发送） |

「直接插入截图」适合让模型自己看图（图表、设计稿、报错截图），不需要把图里的字转成文本；也更快，因为没有 OCR 步骤。

## 截图范围

默认 **拖动选择区域**：按下快捷键后屏幕会被冻结，拖动鼠标框出要识别的部分，松开即开始识别；`Esc` 或右键取消。

也可以在设置卡片里改成：

| 取值 | 含义 |
| --- | --- |
| `region` | 拖动选择区域（默认，小字识别最准） |
| `window` | 当前前台窗口 |
| `cursor` | 鼠标所在的那块屏幕 |
| `fullscreen` | 整个桌面（多显示器时是全部屏幕） |

## 设置

打开 **插件** 页面 → **截图识别文字提问** → 配置，卡片里可以改：

- **启用截图识字**：总开关，关掉后快捷键和按钮都不再截图
- **全局截图快捷键**：点「录入」，按下新的组合键（必须含 Ctrl / Alt / Shift / Win 之一）
- **注册全局快捷键**：只想用按钮/应用内快捷键时关掉
- **截图范围**、**识别方式**（识别文字 / 直接插入截图）、**识别后直接发送**、**截图时最小化窗口**、**识别放大倍数**、**识别语言**

切到「直接插入截图」时，放大倍数和识别语言会隐藏（图片模式不做 OCR）。

保存即时生效：Host 会按新配置重启快捷键监听，无需重启 Harness。

卡片里的设置在 `%USERPROFILE%\.dsh\shot-ocr\settings.json`；首次运行前由 `cordis.patch.yml` 的 `config` 提供默认值，保存过一次后以卡片为准。

## 工作原理

```
全局快捷键（常驻 PowerShell 监听进程）
        │  按下 Ctrl+Alt+S
        ▼
capture-ocr.ps1：冻结桌面 → 拖动选区 → （文字模式）放大 2× → Windows.Media.Ocr 识别
        │  文字结果或图片路径写入 %TEMP%\dsh-shot-ocr\inbox
        ▼
Host 插件：监视 inbox → /api/dsh-shot/pending（图片转 base64）
        ▼
页面：轮询到新结果 → 文字 insertText / 图片 createDrafts + addAttachments 填入输入框
```

应用内快捷键和输入框按钮走 `/api/dsh-shot/capture`，同步返回识别文字；取消选区不会报错。

## 安装 / 卸载

```powershell
# 安装（本目录已安装为 link）
dsh plugin --profile desktop add link:D:/deepseek/日用/dsh-shot-ocr
# 卸载
dsh plugin --profile desktop remove dsh-shot-ocr
```

还需要把 `dsh-shot-ocr` 加入 profile `package.json` 的 `dsh.profile.bundles`，或在 **插件** 页面启用。

修改插件自身源码后，HMR 只重载配置、不监听插件源码：需要在插件页把本插件关掉再打开，或重启 Harness。

## 环境要求

- Windows 10 / 11（截图与 OCR 依赖 `Windows.Media.Ocr`）
- Windows 自带 PowerShell 5.1（不能用 PowerShell 7：它不支持 WinRT）
- 系统装有带 OCR 的语言包。中文系统默认 `zh-Hans-CN`；可在
  **设置 → 时间和语言 → 语言和区域** 给语言添加「光学字符识别」可选功能

## 常见问题

**按下快捷键没反应**
看 `%TEMP%\dsh-shot-ocr\listener.json`：`registered: false` 表示组合键被别的程序占用，在设置卡片里换一个即可（卡片会显示注册失败的提示）。

**选区覆盖了 Harness 自己**
全局快捷键请在目标窗口处于前台时按；应用内快捷键可打开「截图时最小化窗口」。

**提示「没有识别到文字」**
选区里确实没有可识别文字，或语言包不匹配；可把「识别放大倍数」调到 3。

**选区一闪就没了 / 无法拖动**
确认 `globalHotkey` 打开且 Windows PowerShell 5.1 可用；远程桌面或锁屏会话里 Win32 选区窗口无法显示。

## 目录结构

```
dsh-shot-ocr/
├─ index.js                     Host 插件：路由、设置存取、inbox 监视、常驻监听进程
├─ client.js                    浏览器插件：输入框按钮、快捷键、设置卡片、轮询插入
├─ cordis.patch.yml             bundle 补丁（插入插件行与首启默认值）
├─ locale/{zh,en}.json          插件页显示的名称与说明
├─ icon.svg                     插件图标
└─ scripts/
   ├─ capture-ocr.ps1           冻结桌面 + 选区 + Windows OCR，输出 UTF-8 JSON
   └─ hotkey-listener.ps1       全局快捷键监听，识别后通知 Host
```

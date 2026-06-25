import { useEffect, useRef, useState } from 'react'
import { getMe, login, register } from './api/authApi'
import { getColors } from './api/colorsApi'
import { runDiagnosis } from './api/diagnosisApi'
import { generateResaleCopy } from './api/resaleApi'
import {
  clearDemoWardrobe,
  createWardrobeItem,
  deleteWardrobeItem,
  getWardrobe,
  resetDemoWardrobe,
  wearWardrobeItem,
} from './api/wardrobeApi'

function normalizeWardrobeList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.items)) return result.data.items
  return []
}

function normalizeColors(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.items)) return result.data.items
  return []
}

function getItemValue(item, camelKey, snakeKey, defaultValue = '') {
  return item?.[camelKey] ?? item?.[snakeKey] ?? defaultValue
}

function formatPriceFromCents(priceCents) {
  const value = Number(priceCents || 0) / 100
  return `￥${value.toFixed(1)}`
}

const COLOR_NAME_MAP = {
  cream: '奶油白',
  red: '正红色',
  burgundy: '酒红色',
  dark_green: '深绿色',
  purple: '紫色',
  blue: '蓝色',
  olive: '橄榄绿',
  teal: '蓝绿色',
  navy: '藏青色',
  brown: '棕色',
  taupe: '灰棕色',
  gray: '灰色',
}

function getColorChineseName(key) {
  return COLOR_NAME_MAP[key] || key || '未知颜色'
}

function getErrorCode(error) {
  return (
    error?.data?.code ||
    error?.data?.error?.code ||
    error?.data?.data?.code ||
    ''
  )
}

function normalizeDiagnosisResult(result) {
  const data = result?.data || result?.result || result || {}
  const summary = data?.summary || {}
  const items = Array.isArray(data?.items) ? data.items : []

  const rawTags =
    data?.tags ||
    summary?.tags ||
    summary?.labels ||
    []

  const safeTags = Array.isArray(rawTags)
    ? rawTags
    : rawTags
      ? [String(rawTags)]
      : []

  return {
    summary,
    items,
    isEmpty: Boolean(data?.isEmpty || summary?.totalItems === 0),

    level:
      data?.level ||
      summary?.level ||
      summary?.status ||
      '状态良好',

    tags: safeTags,

    suggestion:
      data?.suggestion ||
      summary?.suggestion ||
      summary?.advice ||
      '系统暂未发现明显闲置风险，这件单品目前可以继续保持当前穿着频率。',

    nextAction:
      data?.nextAction ||
      data?.next_action ||
      summary?.nextAction ||
      summary?.next_action ||
      '你可以继续观察这件单品的 CPW 变化，或生成转卖文案作为备选方案。',
  }
}

function normalizeResaleCopy(result) {
  const data = result?.data || result?.result || result || null

  return (
    data?.resale ||
    data?.resaleCopy ||
    data?.resale_copy ||
    data?.copy ||
    data
  )
}

function getResaleTitle(copy) {
  const rawTitle =
    copy?.title ||
    copy?.copyTitle ||
    copy?.copy_title ||
    copy?.resaleTitle ||
    copy?.resale_title ||
    ''

  if (!rawTitle) {
    return '低频穿着单品转卖｜轻微使用｜衣柜断舍离'
  }

  const title = String(rawTitle).replace(/\s*\|\s*/g, '｜')

  if (title.includes('衣柜断舍离')) {
    return title
  }

  return `${title}｜衣柜断舍离`
}

function getResaleDescription(copy) {
  const rawDescription =
    copy?.description ||
    copy?.copyDescription ||
    copy?.copy_description ||
    copy?.content ||
    copy?.text ||
    copy?.body ||
    ''

  const baseDescription =
    rawDescription ||
    '这是一件低频穿着单品，目前整体状态良好。适合希望以更低成本入手基础款单品的买家，也适合作为衣柜断舍离的转卖发布内容。'

  if (String(baseDescription).includes('【衣橱记录】')) {
    return baseDescription
  }

  return `${baseDescription}

【衣橱记录】
- 已记录原价、穿着次数和当前 CPW。
- 当前属于低频穿着单品，适合转给更需要的人继续使用。
- 建议价格已结合原价、使用频率和成色综合估算。

【适合人群】
适合想低成本入手基础款、日常通勤或秋冬叠穿的买家。诚心要可聊。`
}

function getResaleSuggestedPrice(copy) {
  return (
    copy?.suggestedPriceText ||
    copy?.suggested_price_text ||
    copy?.priceText ||
    copy?.price_text ||
    copy?.suggestedPrice ||
    copy?.suggested_price ||
    '建议根据原价、穿着次数和成色综合定价'
  )
}

function getResaleValue(copy, camelKey, snakeKey, defaultValue = '') {
  return copy?.[camelKey] ?? copy?.[snakeKey] ?? defaultValue
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const DEFAULT_ITEM_IMAGE_URL = '/assets/items/green-knit.png'
const AUTH_TOKEN_STORAGE_KEY = 'wardrobe_auth_token'
const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_DATA_URL_BYTES = 800 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EMPTY_WARDROBE_CLEAR_MESSAGE =
  '当前衣橱已经为空，可点击重置演示数据恢复标准演示衣物。'

function getDataUrlByteSize(dataUrl) {
  return Math.ceil((dataUrl.length * 3) / 4)
}

function validateImageFile(file) {
  if (!file) {
    return '请先选择图片'
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return '仅支持 JPG、PNG 或 WebP 图片'
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return '图片不能超过 5MB，请换一张更小的图片'
  }

  return ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = dataUrl
  })
}

async function resizeImageToDataUrl(file, options = {}) {
  const maxSide = options.maxSide || 800
  const qualities = options.qualities || [0.7, 0.6, 0.5]
  const sourceDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceDataUrl)

  const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('CANVAS_NOT_SUPPORTED')
  }

  canvas.width = width
  canvas.height = height
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  let bestDataUrl = ''

  for (const quality of qualities) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)

    if (!bestDataUrl || dataUrl.length < bestDataUrl.length) {
      bestDataUrl = dataUrl
    }

    if (getDataUrlByteSize(dataUrl) <= MAX_IMAGE_DATA_URL_BYTES) {
      return dataUrl
    }
  }

  if (getDataUrlByteSize(bestDataUrl) > MAX_IMAGE_DATA_URL_BYTES) {
    throw new Error('IMAGE_TOO_LARGE_AFTER_RESIZE')
  }

  return bestDataUrl
}

function buildResaleCopyText(copy) {
  const title = getResaleTitle(copy)
  const description = getResaleDescription(copy)
  const suggestedPriceText = getResaleSuggestedPrice(copy)

  return `${title}

${description}

建议转卖价：${suggestedPriceText}`
}

async function copyTextToClipboard(text, fallbackTextareaRef) {
  if (!text) {
    return 'failed'
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch (error) {
      console.warn('navigator.clipboard.writeText failed, trying textarea fallback', error)
    }
  }

  let temporaryTextarea = null

  try {
    temporaryTextarea = document.createElement('textarea')
    temporaryTextarea.value = text
    temporaryTextarea.setAttribute('readonly', '')
    temporaryTextarea.style.position = 'fixed'
    temporaryTextarea.style.top = '0'
    temporaryTextarea.style.left = '0'
    temporaryTextarea.style.width = '1px'
    temporaryTextarea.style.height = '1px'
    temporaryTextarea.style.opacity = '0'
    temporaryTextarea.style.fontSize = '16px'
    temporaryTextarea.style.pointerEvents = 'none'

    document.body.appendChild(temporaryTextarea)
    temporaryTextarea.focus({ preventScroll: true })
    temporaryTextarea.select()
    temporaryTextarea.setSelectionRange(0, text.length)

    if (document.execCommand('copy')) {
      return 'copied'
    }
  } catch (error) {
    console.warn('textarea copy fallback failed, trying visible textarea selection', error)
  } finally {
    if (temporaryTextarea) {
      document.body.removeChild(temporaryTextarea)
    }
  }

  const visibleTextarea = fallbackTextareaRef?.current

  if (visibleTextarea) {
    try {
      visibleTextarea.focus()
      visibleTextarea.select()
      visibleTextarea.setSelectionRange(0, visibleTextarea.value.length)
      return 'selected'
    } catch (error) {
      console.warn('visible textarea selection fallback failed', error)
    }
  }

  return 'failed'
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeDiagnosisItem(item) {
  const priceCents = toNumber(getItemValue(item, 'priceCents', 'price_cents', 0))
  const wearCount = toNumber(getItemValue(item, 'wearCount', 'wear_count', 0))
  const idleDays = toNumber(getItemValue(item, 'idleDays', 'idle_days', 0))
  const cpwCents =
    toNumber(getItemValue(item, 'cpwCents', 'cpw_cents', 0)) ||
    (wearCount > 0 ? Math.round(priceCents / wearCount) : priceCents)

  return {
    ...item,
    id: getItemValue(item, 'id', 'id', ''),
    name: getItemValue(item, 'name', 'name', '未命名单品'),
    imageUrl: getItemValue(item, 'imageUrl', 'image_url', ''),
    colorKey: getItemValue(item, 'colorKey', 'color_key', ''),
    colorName: getItemValue(item, 'colorName', 'color_name', ''),
    priceCents,
    priceText:
      getItemValue(item, 'priceText', 'price_text', '') ||
      formatPriceFromCents(priceCents),
    wearCount,
    idleDays,
    cpwCents,
    cpwText:
      getItemValue(item, 'cpwText', 'cpw_text', '') ||
      formatPriceFromCents(cpwCents),
    level: item?.level || '',
    tags: Array.isArray(item?.tags) ? item.tags : [],
    suggestion: item?.suggestion || '',
    nextAction: item?.nextAction || item?.next_action || '',
  }
}

function mergeDiagnosisItems(wardrobe, diagnosis) {
  const wardrobeItems = wardrobe.map(normalizeDiagnosisItem)
  const diagnosisItems = (diagnosis?.items || []).map(normalizeDiagnosisItem)
  const diagnosisById = new Map(diagnosisItems.map((item) => [String(item.id), item]))

  if (wardrobeItems.length === 0) {
    return diagnosisItems
  }

  return wardrobeItems.map((item) => ({
    ...item,
    ...(diagnosisById.get(String(item.id)) || {}),
  }))
}

function getDiagnosisScore(item) {
  let score = 0

  if (item.level === 'danger') score += 120
  if (item.level === 'warning') score += 70
  if (item.nextAction === 'resale_or_rewear') score += 100
  if (item.wearCount === 0) score += 90
  if (item.wearCount > 0 && item.wearCount <= 2) score += 55
  if (item.wearCount > 2 && item.wearCount <= 4) score += 25

  score += Math.min(item.idleDays, 180)
  score += Math.min(item.priceCents / 1000, 120)
  score += Math.min(item.cpwCents / 1000, 140)

  return score
}

function pickFocusDiagnosisItem(items) {
  if (items.length === 0) return null

  return [...items].sort((a, b) => getDiagnosisScore(b) - getDiagnosisScore(a))[0]
}

function pickOutfitPartner(focusItem, items) {
  if (!focusItem) return null

  const candidates = items.filter((item) => String(item.id) !== String(focusItem.id))

  if (candidates.length === 0) return null

  return (
    candidates.find((item) => item.colorKey && item.colorKey !== focusItem.colorKey) ||
    candidates[0]
  )
}

function getFocusReasons(item) {
  if (!item) return []

  const reasons = []

  if (item.wearCount === 0) {
    reasons.push('从未穿着')
  } else if (item.wearCount <= 2) {
    reasons.push(`穿着次数仅 ${item.wearCount} 次`)
  }

  if (item.idleDays >= 90) {
    reasons.push(`已闲置 ${item.idleDays} 天`)
  } else if (item.idleDays >= 30) {
    reasons.push(`已有 ${item.idleDays} 天未穿`)
  }

  if (item.cpwCents >= 10000) {
    reasons.push(`当前 CPW 为 ${item.cpwText}`)
  }

  if (item.priceCents >= 50000) {
    reasons.push(`购入价为 ${item.priceText}`)
  }

  return reasons
}

function getDiagnosisSeverity(item, items) {
  if (!item || items.length === 0) return 'empty'

  const hasHighRisk =
    item.level === 'danger' ||
    item.nextAction === 'resale_or_rewear' ||
    item.wearCount === 0 ||
    item.idleDays >= 90 ||
    item.cpwCents >= 30000 ||
    (item.priceCents >= 50000 && item.wearCount <= 2)

  if (hasHighRisk) return 'high'

  const needsAttention =
    item.level === 'warning' ||
    item.wearCount <= 3 ||
    item.idleDays >= 30 ||
    item.cpwCents >= 10000

  if (needsAttention) return 'attention'

  return 'healthy'
}

function getDiagnosisViewModel(wardrobe, diagnosis) {
  const items = mergeDiagnosisItems(wardrobe, diagnosis)

  if (items.length === 0 || diagnosis?.isEmpty) {
    return {
      type: 'empty',
      status: '暂无可诊断数据',
      badgeClass:
        'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600',
      statusBoxClass: 'mt-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200',
      statusTitleClass: 'text-sm font-semibold text-slate-700',
      statusTextClass: 'mt-2 text-sm leading-6 text-slate-600',
      targetItem: null,
      outfitPartner: null,
      outfitText: '',
      judgmentTitle: '当前衣橱单品数为 0',
      judgment:
        '系统无法计算 CPW、闲置天数和穿着频率，因此不会给出空泛的单品判断。',
      suggestion:
        '请先录入至少 1 件衣服，或点击“重置演示数据”体验完整诊断流程。',
      action:
        '先建立衣橱数据，再启动闲置诊断与转卖文案流程。',
      primaryAction: 'add',
      primaryLabel: '录入第一件单品',
      secondaryAction: 'reset',
      secondaryLabel: '重置演示数据',
      showResaleAction: false,
    }
  }

  const focusItem = pickFocusDiagnosisItem(items)
  const outfitPartner = pickOutfitPartner(focusItem, items)
  const reasons = getFocusReasons(focusItem)
  const severity = getDiagnosisSeverity(focusItem, items)
  const outfitText = outfitPartner
    ? `推荐穿搭：${focusItem.name} + ${outfitPartner.name}`
    : ''

  if (severity === 'healthy') {
    return {
      type: 'healthy',
      status: '状态良好',
      badgeClass:
        'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700',
      statusBoxClass: 'mt-4 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100',
      statusTitleClass: 'text-sm font-semibold text-emerald-800',
      statusTextClass: 'mt-2 text-sm leading-6 text-emerald-700',
      targetItem: focusItem,
      outfitPartner,
      outfitText: '',
      judgmentTitle: '当前衣橱整体使用情况较健康',
      judgment:
        '系统未发现明显高风险单品。本次参考了价格、穿着次数、闲置天数和 CPW，整体没有出现需要立即挽救或转卖的信号。',
      suggestion:
        '继续保持当前穿着频率，并定期记录“今天穿了它”，让 CPW 和闲置判断更准确。',
      action: '继续观察衣橱变化，暂时不需要强推转卖。',
      primaryAction: 'close',
      primaryLabel: '继续观察 / 返回衣橱看板',
      secondaryAction: '',
      secondaryLabel: '',
      showResaleAction: false,
    }
  }

  if (severity === 'attention') {
    return {
      type: 'attention',
      status: '需要关注',
      badgeClass:
        'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700',
      statusBoxClass: 'mt-4 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100',
      statusTitleClass: 'text-sm font-semibold text-amber-800',
      statusTextClass: 'mt-2 text-sm leading-6 text-amber-700',
      targetItem: focusItem,
      outfitPartner,
      outfitText,
      judgmentTitle: `本次重点诊断单品：${focusItem.name}`,
      judgment: `系统选择它，是因为${reasons.join('，') || '它的使用效率低于衣橱平均状态'}。当前还不一定需要立刻转卖，但已经值得近期优先激活。`,
      suggestion:
        '建议近期优先穿着一次，降低闲置天数，并观察 CPW 是否继续下降。',
      action: outfitPartner
        ? `可以先尝试 ${focusItem.name} + ${outfitPartner.name}。`
        : `衣橱中目前只有 ${focusItem.name} 可作为重点单品，建议明天先穿这件。`,
      primaryAction: 'close',
      primaryLabel: outfitPartner ? '明天穿这套' : '明天穿这件',
      secondaryAction: 'resale',
      secondaryLabel: '生成转卖文案',
      showResaleAction: true,
    }
  }

  return {
    type: 'high',
    status: '高风险闲置',
    badgeClass:
      'rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700',
    statusBoxClass: 'mt-4 rounded-3xl bg-red-50 p-4 ring-1 ring-red-100',
    statusTitleClass: 'text-sm font-semibold text-red-800',
    statusTextClass: 'mt-2 text-sm leading-6 text-red-700',
    targetItem: focusItem,
    outfitPartner,
    outfitText,
    judgmentTitle: `本次重点诊断单品：${focusItem.name}`,
    judgment: `系统选择它，是因为${reasons.join('，') || '它同时具有低频和高成本信号'}。这说明它正在从“衣橱资产”变成“闲置成本”。`,
    suggestion:
      '建议先尝试搭配再穿；如果仍然不想穿，可以生成转卖文案，把闲置资产转化为预算回收。',
    action: outfitPartner
      ? `先尝试 ${focusItem.name} + ${outfitPartner.name}，如果仍然不想穿，再进入转卖流程。`
      : `衣橱中目前只有 ${focusItem.name}，建议明天先穿这件；如果仍然不想穿，再进入转卖流程。`,
    primaryAction: 'close',
    primaryLabel: outfitPartner ? '采纳建议，明天穿这套' : '采纳建议，明天穿这件',
    secondaryAction: 'resale',
    secondaryLabel: '放弃挽救，生成转卖文案',
    showResaleAction: true,
  }
}


function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

  const [wardrobe, setWardrobe] = useState([])
  const [imageErrorItemIds, setImageErrorItemIds] = useState([])
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('green sweater')
  const [newPrice, setNewPrice] = useState('')
  const [selectedColorKey, setSelectedColorKey] = useState('')
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState('')
  const [selectedImageName, setSelectedImageName] = useState('')
  const [imageProcessing, setImageProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resettingDemo, setResettingDemo] = useState(false)
  const [clearingDemo, setClearingDemo] = useState(false)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  const [checkingItemIds, setCheckingItemIds] = useState([])
const [deletingItemIds, setDeletingItemIds] = useState([])
const [deleteTarget, setDeleteTarget] = useState(null)
const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [diagnosisResult, setDiagnosisResult] = useState(null)
const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false)
const [diagnosisLoading, setDiagnosisLoading] = useState(false)

const [resaleCopy, setResaleCopy] = useState(null)
const [isResaleOpen, setIsResaleOpen] = useState(false)
const [resaleLoading, setResaleLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)

  const toastTimerRef = useRef(null)
  const imageInputRef = useRef(null)
  const resaleCopyTextareaRef = useRef(null)

    function showToast(message, type = 'success') {
    setToastMessage(message)
    setToastType(type)

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    const duration = type === 'error' ? 1500 : 1000

    toastTimerRef.current = setTimeout(() => {
      setToastMessage('')
      setToastType('success')
      toastTimerRef.current = null
    }, duration)
  }

  async function loadWardrobe(options = {}) {
    const { showLoading = true, keepScroll = false } = options
    const scrollY = window.scrollY

    try {
      if (showLoading) {
        setLoading(true)
      }

      setErrorMessage('')

      const result = await getWardrobe()
      const list = normalizeWardrobeList(result)

      setWardrobe(list)

      if (keepScroll) {
        requestAnimationFrame(() => {
          window.scrollTo({
            top: scrollY,
            left: 0,
            behavior: 'auto',
          })
        })
      }
    } catch (error) {
      console.error(error)
      setErrorMessage('衣柜列表读取失败，请确认后端 server 是否正在运行')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  async function loadColors() {
    try {
      const result = await getColors()
      const list = normalizeColors(result)
      setColors(list)

      const firstColor = list[0]
      const firstColorKey =
        firstColor?.key || firstColor?.colorKey || firstColor?.color_key || ''

      if (firstColorKey) {
        setSelectedColorKey(firstColorKey)
      }
    } catch (error) {
      console.error(error)
      showToast('颜色列表读取失败', 'error')
    }
  }

  async function completeAuth(result) {
    const data = result?.data || result || {}
    const token = data?.token || ''
    const user = data?.user || null

    if (!token || !user) {
      throw new Error('AUTH_RESPONSE_INVALID')
    }

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    setAuthToken(token)
    setCurrentUser(user)
    setAuthError('')
    setAuthPassword('')

    await loadWardrobe()
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()

    if (authSubmitting) {
      return
    }

    const username = authUsername.trim()

    if (!username) {
      setAuthError('请输入账号')
      return
    }

    if (!authPassword) {
      setAuthError('请输入密码')
      return
    }

    try {
      setAuthSubmitting(true)
      setAuthError('')

      const result =
        authMode === 'register'
          ? await register(username, authPassword)
          : await login(username, authPassword)

      await completeAuth(result)
    } catch (error) {
      console.error(error)

      const code = getErrorCode(error)
      const message =
        error?.data?.message ||
        error?.data?.error?.message ||
        error?.message ||
        ''

      if (code === 'USERNAME_EXISTS') {
        setAuthError('账号已存在，请换一个账号或直接登录')
      } else if (code === 'INVALID_CREDENTIALS') {
        setAuthError('账号或密码不正确')
      } else if (message && message !== 'AUTH_RESPONSE_INVALID') {
        setAuthError(message)
      } else {
        setAuthError(authMode === 'register' ? '注册失败，请稍后再试' : '登录失败，请稍后再试')
      }
    } finally {
      setAuthSubmitting(false)
    }
  }

  function switchAuthMode(nextMode) {
    if (authSubmitting) return

    setAuthMode(nextMode)
    setAuthError('')
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setAuthToken('')
    setCurrentUser(null)
    setWardrobe([])
    setErrorMessage('')
    setAuthPassword('')
    setIsAddOpen(false)
    setIsDiagnosisOpen(false)
    setIsResaleOpen(false)
    setIsClearConfirmOpen(false)
    setDeleteTarget(null)
  }

  function openAddPanel() {
    setIsAddOpen(true)
    loadColors()
  }

  function resetAddForm() {
    setNewName('green sweater')
    setNewPrice('')
    setSelectedColorKey('')
    setSelectedImageDataUrl('')
    setSelectedImageName('')
    setImageProcessing(false)

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function closeAddPanel() {
    if (saving) return
    setIsAddOpen(false)
    resetAddForm()
  }

  function openImagePicker() {
    if (saving || imageProcessing) return
    imageInputRef.current?.click()
  }

  function clearSelectedImage() {
    setSelectedImageDataUrl('')
    setSelectedImageName('')

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  async function handleImageFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const validationMessage = validateImageFile(file)

    if (validationMessage) {
      clearSelectedImage()
      showToast(validationMessage, 'error')
      return
    }

    try {
      setImageProcessing(true)

      const dataUrl = await resizeImageToDataUrl(file, {
        maxSide: 800,
        qualities: [0.7, 0.6, 0.5],
      })

      setSelectedImageDataUrl(dataUrl)
      setSelectedImageName(file.name)
      showToast('图片已添加')
    } catch (error) {
      console.error(error)
      clearSelectedImage()
      showToast('图片处理失败，请换一张更小的 JPG、PNG 或 WebP 图片', 'error')
    } finally {
      setImageProcessing(false)
    }
  }

async function handleResetDemoData() {
  if (resettingDemo) {
    return
  }

  try {
    setResettingDemo(true)

    await resetDemoWardrobe()
    setImageErrorItemIds([])
    showToast('演示数据已重置')

    await loadWardrobe({
      showLoading: false,
      keepScroll: true,
    })
  } catch (error) {
    console.error(error)
    showToast('重置演示数据失败', 'error')
  } finally {
    setResettingDemo(false)
  }
}

async function handleClearDemoData() {
  if (clearingDemo) {
    return
  }

  if (wardrobe.length === 0) {
    setClearingDemo(false)
    setIsClearConfirmOpen(false)
    showToast(EMPTY_WARDROBE_CLEAR_MESSAGE)
    return
  }

  try {
    setClearingDemo(true)

    await clearDemoWardrobe()
    setImageErrorItemIds([])
    setIsClearConfirmOpen(false)
    setIsDiagnosisOpen(false)
    setDiagnosisResult(null)
    setIsResaleOpen(false)
    setResaleCopy(null)
    setDeleteTarget(null)
    showToast('衣橱已清空，可以点击一键诊断查看空状态')

    await loadWardrobe({
      showLoading: false,
      keepScroll: true,
    })
  } catch (error) {
    console.error(error)
    showToast('清空衣橱失败', 'error')
  } finally {
    setClearingDemo(false)
  }
}

function openClearConfirm() {
  if (clearingDemo || resettingDemo) {
    return
  }

  if (wardrobe.length === 0) {
    showToast(EMPTY_WARDROBE_CLEAR_MESSAGE)
    return
  }

  setIsClearConfirmOpen(true)
}

function closeClearConfirm() {
  if (clearingDemo) {
    return
  }

  setIsClearConfirmOpen(false)
}

async function handleCreateItem() {
  if (saving || imageProcessing) {
    return
  }

  const priceNumber = Number(newPrice)

    if (!newName.trim()) {
      showToast('请先输入衣服名称', 'error')
      return
    }

    if (!selectedColorKey) {
      showToast('请先选择颜色', 'error')
      return
    }

    if (!newPrice) {
      showToast('请先输入价格', 'error')
      return
    }

    if (priceNumber <= 0) {
      showToast('价格必须大于 0', 'error')
      return
    }

    try {
      setSaving(true)

      await createWardrobeItem({
        name: newName.trim(),
        imageUrl: selectedImageDataUrl || DEFAULT_ITEM_IMAGE_URL,
        colorKey: selectedColorKey,
        priceCents: Math.round(priceNumber * 100),
      })

      showToast('新增衣服成功')
      setIsAddOpen(false)
      resetAddForm()

      await loadWardrobe({
        showLoading: false,
        keepScroll: true,
      })
    } catch (error) {
      console.error(error)
    showToast('新增衣服失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleWearItem(id, isCheckinCooling) {
    if (!id) {
      showToast('无法打卡：缺少衣服 ID', 'error')
      return
    }

    if (isCheckinCooling) {
      showToast('打卡虽好，切莫贪杯', 'error')
      return
    }

    if (checkingItemIds.includes(id)) {
      return
    }

    try {
      setCheckingItemIds((current) => [...current, id])

      await wearWardrobeItem(id)

      showToast('打卡成功')

      await loadWardrobe({
        showLoading: false,
        keepScroll: true,
      })
    } catch (error) {
      console.error(error)

      const code = getErrorCode(error)

            if (code === 'CHECKIN_COOLING') {
        showToast('打卡虽好，切莫贪杯', 'error')

        await loadWardrobe({
          showLoading: false,
          keepScroll: true,
        })
      } else {
        showToast('打卡失败', 'error')
      }
    } finally {
      setCheckingItemIds((current) => current.filter((itemId) => itemId !== id))
    }
  }

function handleDeleteItem(id, name) {
  if (!id) {
    showToast('无法删除：缺少衣服 ID', 'error')
    return
  }

  if (deletingItemIds.includes(id)) {
    return
  }

  setDeleteTarget({
    id,
    name: name || '这件单品',
  })
}

function closeDeleteConfirm() {
  if (deleteTarget && deletingItemIds.includes(deleteTarget.id)) {
    return
  }

  setDeleteTarget(null)
}

async function confirmDeleteItem() {
  if (!deleteTarget?.id) {
    return
  }

  const { id } = deleteTarget

  if (deletingItemIds.includes(id)) {
    return
  }

  try {
    setDeletingItemIds((current) => [...current, id])

    await deleteWardrobeItem(id)

    showToast('衣服已删除')
    setDeleteTarget(null)

    await loadWardrobe({
      showLoading: false,
      keepScroll: true,
    })
  } catch (error) {
    console.error(error)
    showToast('删除衣服失败', 'error')
  } finally {
    setDeletingItemIds((current) => current.filter((itemId) => itemId !== id))
  }
}

async function handleRunDiagnosis() {
  if (diagnosisLoading) {
    return
  }

  try {
    setDiagnosisLoading(true)

    const result = await runDiagnosis()
    const diagnosis = normalizeDiagnosisResult(result)

    setDiagnosisResult(diagnosis)
    setIsDiagnosisOpen(true)
  } catch (error) {
    console.error(error)

    const code = getErrorCode(error)
    const message =
      error?.data?.message ||
      error?.data?.error?.message ||
      error?.message ||
      ''

    if (code && message) {
      showToast(`诊断失败：${code}，${message}`, 'error')
    } else if (code) {
      showToast(`诊断失败：${code}`, 'error')
    } else if (message) {
      showToast(`诊断失败：${message}`, 'error')
    } else {
      showToast('诊断失败，请检查后端 POST /api/diagnosis', 'error')
    }
  } finally {
    setDiagnosisLoading(false)
  }
}

  function closeDiagnosisModal() {
    setIsDiagnosisOpen(false)
  }

function handleDiagnosisPrimaryAction() {
  if (!diagnosisViewModel) {
    closeDiagnosisModal()
    return
  }

  if (diagnosisViewModel.primaryAction === 'add') {
    closeDiagnosisModal()
    openAddPanel()
    return
  }

  closeDiagnosisModal()
}

async function handleDiagnosisSecondaryAction() {
  if (!diagnosisViewModel) {
    return
  }

  if (diagnosisViewModel.secondaryAction === 'reset') {
    closeDiagnosisModal()
    await handleResetDemoData()
    return
  }

  if (diagnosisViewModel.secondaryAction === 'resale') {
    await handleGenerateResaleCopy()
  }
}

async function handleCopyResaleText() {
  if (copyLoading) {
    return
  }

  const text = buildResaleCopyText(resaleCopy)

  if (!text.trim()) {
    showToast('暂无可复制的发布文案', 'error')
    return
  }

  try {
    setCopyLoading(true)

    const copyResult = await copyTextToClipboard(text, resaleCopyTextareaRef)

    if (copyResult === 'copied') {
      showToast('发布文案已复制')
    } else if (copyResult === 'selected') {
      showToast('已选中文案，请长按复制')
    } else {
      showToast('复制失败，请手动复制', 'error')
    }

    await sleep(300)
  } catch (error) {
    console.error(error)
    showToast('复制失败，请手动复制', 'error')
  } finally {
    setCopyLoading(false)
  }
}

async function handleGenerateResaleCopy() {
  if (resaleLoading) {
    return
  }

  const targetItem = diagnosisViewModel?.targetItem || wardrobe[0]
  const itemId = getItemValue(targetItem, 'id', 'id', '')

  if (!itemId) {
    showToast('请先新增至少一件衣服', 'error')
    return
  }

  try {
    setResaleLoading(true)

    const result = await generateResaleCopy(itemId)
    const copy = normalizeResaleCopy(result)

    setResaleCopy(copy)

    // 生成转卖文案成功后，关闭诊断弹窗，只保留转卖文案弹窗
    setIsDiagnosisOpen(false)
    setIsResaleOpen(true)
    showToast('闲鱼发布文案已生成')
  } catch (error) {
    console.error(error)
    showToast('生成转卖文案失败', 'error')
  } finally {
    setResaleLoading(false)
  }
}

function closeResaleDrawer() {
  setIsResaleOpen(false)
  setCopyLoading(false)
}

  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

      if (!storedToken) {
        setAuthLoading(false)
        setLoading(false)
        return
      }

      try {
        setAuthLoading(true)

        const result = await getMe(storedToken)
        const user = result?.data?.user || result?.user || null

        if (!user) {
          throw new Error('AUTH_RESPONSE_INVALID')
        }

        setAuthToken(storedToken)
        setCurrentUser(user)
        setAuthError('')

        await loadWardrobe()
      } catch (error) {
        console.error(error)
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
        setAuthToken('')
        setCurrentUser(null)
        setWardrobe([])
        setLoading(false)
      } finally {
        setAuthLoading(false)
      }
    }

    restoreSession()

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

    useEffect(() => {
  const shouldLockScroll =
    isAddOpen ||
    isDiagnosisOpen ||
    isResaleOpen ||
    isClearConfirmOpen ||
    Boolean(deleteTarget)

  const originalOverflow = document.body.style.overflow

  if (shouldLockScroll) {
    document.body.style.overflow = 'hidden'
  }

  return () => {
    document.body.style.overflow = originalOverflow
  }
}, [isAddOpen, isDiagnosisOpen, isResaleOpen, isClearConfirmOpen, deleteTarget])

    const canSave =
    newName.trim() &&
    selectedColorKey &&
    newPrice &&
    Number(newPrice) > 0 &&
    !imageProcessing

  const diagnosisViewModel = diagnosisResult
    ? getDiagnosisViewModel(wardrobe, diagnosisResult)
    : null

  const canSubmitAuth =
    authUsername.trim() && authPassword && !authSubmitting && !authLoading

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase text-emerald-600">
            Wardrobe Asset
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">
            正在确认登录状态
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            请稍候，系统正在连接衣橱资产看板。
          </p>
        </section>
      </main>
    )
  }

  if (!currentUser || !authToken) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase text-emerald-600">
            Wardrobe Asset
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            衣橱资产
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            用 CPW 看见每件衣服的真实成本
          </p>

          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800 ring-1 ring-amber-100">
            当前版本为演示版。登录账号只用于进入系统，所有用户仍然共用同一套演示衣柜数据。
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchAuthMode('login')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                authMode === 'login'
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              登录
            </button>

            <button
              type="button"
              onClick={() => switchAuthMode('register')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                authMode === 'register'
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">
                账号
              </label>
              <input
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                autoComplete="username"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                placeholder="例如：testuser001"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">
                密码
              </label>
              <input
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                type="password"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                placeholder="6-32 位密码"
              />
            </div>

            {authError && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 ring-1 ring-red-100">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmitAuth}
              className="w-full rounded-full bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {authSubmitting
                ? authMode === 'register'
                  ? '注册中……'
                  : '登录中……'
                : authMode === 'register'
                  ? '注册并进入系统'
                  : '登录进入系统'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-28">
      <div className="mx-auto w-full max-w-md">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase text-emerald-600">
            Wardrobe Asset
          </p>

          <div className="mt-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">
                衣橱资产
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                用 CPW 看见每件衣服的真实成本
              </p>
            </div>

            <button
  onClick={handleRunDiagnosis}
  disabled={diagnosisLoading}
  className="mt-5 w-full rounded-full bg-red-600 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
>
  {diagnosisLoading ? '诊断中……' : '一键诊断衣橱'}
</button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <span>本地 SQLite 衣柜数据</span>
            <span className="font-semibold text-emerald-700">
              {apiBaseUrl ? '后端已配置' : '默认本地后端'}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-100">
            <span className="min-w-0 truncate">
              演示账号：{currentUser?.username || '已登录'}，数据仍为公共演示衣柜
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm ring-1 ring-amber-100 transition hover:bg-amber-100"
            >
              退出
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">我的衣橱</h2>
              <p className="mt-1 text-xs text-slate-500">
                CPW、闲置天数和今日打卡
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={handleResetDemoData}
                disabled={resettingDemo || clearingDemo}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {resettingDemo ? '重置中……' : '重置演示数据'}
              </button>

              <button
                onClick={openClearConfirm}
                disabled={clearingDemo || resettingDemo}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-red-100 disabled:text-red-300"
              >
                {clearingDemo ? '清空中……' : '清空衣橱'}
              </button>

              <button
  onClick={openAddPanel}
  className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
>
  录入
</button>
            </div>
          </div>

          {loading && (
            <div className="rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              正在读取衣柜数据……
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-3xl bg-red-50 p-5 text-sm text-red-700 ring-1 ring-red-200">
              {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && wardrobe.length === 0 && (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl">
      👗
    </div>

    <p className="mt-5 text-lg font-bold text-slate-900">
      还没有衣橱资产
    </p>

    <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
      先录入一件衣服，开始计算 CPW。
    </p>

    <button
      onClick={openAddPanel}
      className="mt-6 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
    >
      录入第一件单品
    </button>
  </div>
)}

          {!loading && !errorMessage && wardrobe.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {wardrobe.map((item) => {
                const id = getItemValue(item, 'id', 'id')
                const name = getItemValue(item, 'name', 'name', '未命名衣服')
                const imageUrl = getItemValue(item, 'imageUrl', 'image_url', '')
                const colorKey = getItemValue(
                  item,
                  'colorKey',
                  'color_key',
                  'unknown'
                )
                const priceCents = getItemValue(
                  item,
                  'priceCents',
                  'price_cents',
                  0
                )
                const wearCount = getItemValue(
                  item,
                  'wearCount',
                  'wear_count',
                  0
                )
                const idleDays = getItemValue(
                  item,
                  'idleDays',
                  'idle_days',
                  0
                )

                const cpwText =
                  getItemValue(item, 'cpwText', 'cpw_text', '') ||
                  formatPriceFromCents(
                    wearCount > 0
                      ? Number(priceCents) / Number(wearCount)
                      : priceCents
                  )

                const isCheckinCooling = Boolean(
                  getItemValue(
                    item,
                    'isCheckinCooling',
                    'is_checkin_cooling',
                    false
                  )
                )

                const isChecking = checkingItemIds.includes(id)
                const hasImageError = imageErrorItemIds.includes(id)

                return (
                  <article
  key={id}
  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-md"
>
  <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-xs text-slate-400">
    {imageUrl && !hasImageError ? (
      <img
        src={imageUrl}
        alt={name}
        className="h-full w-full object-cover"
        onError={() => {
          setImageErrorItemIds((current) =>
            current.includes(id) ? current : [...current, id]
          )
        }}
      />
    ) : (
      <span>图片暂不可用</span>
    )}

    {isCheckinCooling && (
      <span className="absolute right-2 top-2 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
        今日已记录
      </span>
    )}
  </div>

  <div className="p-3">
    <div>
      <h3 className="truncate text-sm font-bold text-slate-950">{name}</h3>
      <p className="mt-1 truncate text-xs text-slate-500">
        色彩标签：{getColorChineseName(colorKey)}
      </p>
    </div>

    <div className="mt-3 rounded-2xl bg-slate-950 p-3 text-white">
      <p className="text-xs font-medium text-slate-300">当前 CPW</p>
      <p className="mt-1 text-lg font-bold">{cpwText}</p>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
      <div className="rounded-2xl bg-slate-50 p-2">
        <p className="text-[10px] text-slate-500">穿着</p>
        <p className="mt-1 text-base font-bold text-slate-900">{wearCount}</p>
      </div>

      <div className="rounded-2xl bg-slate-50 p-2">
        <p className="text-[10px] text-slate-500">闲置</p>
        <p className="mt-1 text-base font-bold text-slate-900">{idleDays}天</p>
      </div>
    </div>

    <div className="mt-3 grid gap-2">
  <button
    onClick={() => handleWearItem(id, isCheckinCooling)}
    disabled={isChecking}
    className={`rounded-full px-3 py-2 text-xs font-semibold text-white transition ${
      isCheckinCooling
        ? 'bg-slate-400 hover:bg-slate-500'
        : 'bg-slate-900 hover:bg-slate-800'
    } disabled:cursor-not-allowed disabled:bg-slate-300`}
  >
    {isChecking
      ? '记录中……'
      : isCheckinCooling
        ? '今日已记录'
        : '今天穿了它'}
  </button>

  <button
    onClick={() => handleDeleteItem(id, name)}
    disabled={deletingItemIds.includes(id)}
    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
  >
    {deletingItemIds.includes(id) ? '删除中……' : '删除'}
  </button>
</div>
  </div>
</article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-100">
          <aside className="mx-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-100 px-5 py-4">
              <button
                onClick={closeAddPanel}
                disabled={saving}
                className="justify-self-start rounded-full px-1 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                取消
              </button>

              <h2 className="text-base font-bold text-slate-950">录入新单品</h2>

              <span className="justify-self-end rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                MVP 演示
              </span>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-sm">
                <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-5xl">
                  {selectedImageDataUrl ? (
                    <img
                      src={selectedImageDataUrl}
                      alt="新单品预览"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>👕</span>
                  )}

                  {imageProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm font-semibold">
                      图片处理中……
                    </div>
                  )}
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {selectedImageDataUrl ? '已选择本地图片' : '演示阶段可使用默认图片'}
                    </p>
                    <p className="mt-1 truncate text-xs leading-5 text-slate-300">
                      {selectedImageName || '支持 JPG / PNG / WebP，原图不超过 5MB'}
                    </p>
                  </div>

                  {selectedImageDataUrl && (
                    <button
                      type="button"
                      onClick={clearSelectedImage}
                      disabled={saving || imageProcessing}
                      className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      清除
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={openImagePicker}
                  disabled={saving || imageProcessing}
                  className="mt-3 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {imageProcessing ? '图片处理中……' : selectedImageDataUrl ? '重新选择图片' : '选择本地图片'}
                </button>

                <p className="mt-1 text-xs leading-5 text-slate-300">
                  保存时会把图片压缩为演示级预览图，不会上传原始文件。
                </p>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    单品名称
                  </label>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                    placeholder="例如：橄榄绿毛衣 / 蓝色衬衫"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    购入价格，单位：元
                  </label>
                  <input
                    value={newPrice}
                    onChange={(event) => setNewPrice(event.target.value)}
                    type="number"
                    min="0"
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                    placeholder="例如：299"
                  />
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      选择主色彩标签
                    </p>
                    {selectedColorKey && (
                      <span className="text-xs font-medium text-slate-500">
                        已选 {getColorChineseName(selectedColorKey)}
                      </span>
                    )}
                  </div>

                  {colors.length === 0 && (
                    <p className="mt-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                      正在读取颜色列表，或颜色接口暂无数据。
                    </p>
                  )}

                  {colors.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {colors.map((color) => {
                        const key =
                          color?.key || color?.colorKey || color?.color_key || ''
                        const hex =
                          color?.hex ||
                          color?.hexCode ||
                          color?.hex_code ||
                          '#e2e8f0'

                        const isSelected = selectedColorKey === key

                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedColorKey(key)}
                            className={`rounded-3xl border bg-white p-3 text-left shadow-sm transition ${
                              isSelected
                                ? 'border-slate-950 ring-2 ring-slate-950'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div
                              className="h-12 rounded-2xl border border-slate-200"
                              style={{ backgroundColor: hex }}
                            />
                            <p className="mt-2 truncate text-xs font-semibold text-slate-900">
                              {getColorChineseName(key)}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 py-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]">
              <button
                onClick={handleCreateItem}
                disabled={!canSave || saving}
                className="w-full rounded-full bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {saving ? '保存中……' : '保存入库'}
              </button>
            </div>
          </aside>
        </div>
      )}

{isDiagnosisOpen && diagnosisViewModel && (
  <div
    onClick={closeDiagnosisModal}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
  >
    <section
  onClick={(event) => event.stopPropagation()}
  className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-white/10"
>
      <div className="rounded-3xl bg-slate-950 p-5 text-white">
        <p className="text-xs font-semibold uppercase text-emerald-300">
          衣橱资产诊断
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          穿搭盲盒已掉落
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          系统根据价格、穿着次数、闲置天数和 CPW 生成本次诊断。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            数据驱动
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            CPW
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            闲置诊断
          </span>
        </div>
      </div>

      {diagnosisViewModel.targetItem && (
        <div className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
          <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-xs text-slate-400">
            {diagnosisViewModel.targetItem.imageUrl ? (
              <img
                src={diagnosisViewModel.targetItem.imageUrl}
                alt={diagnosisViewModel.targetItem.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>暂无图片</span>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              本次重点诊断单品
            </span>
          </div>

          <div className="p-4">
            <h3 className="truncate text-lg font-bold text-slate-950">
              {diagnosisViewModel.targetItem.name}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="text-[10px] text-slate-500">价格</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {diagnosisViewModel.targetItem.priceText}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="text-[10px] text-slate-500">穿着</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {diagnosisViewModel.targetItem.wearCount} 次
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-2">
                <p className="text-[10px] text-slate-500">闲置</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {diagnosisViewModel.targetItem.idleDays} 天
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-2 text-white">
                <p className="text-[10px] text-slate-300">CPW</p>
                <p className="mt-1 text-sm font-bold">
                  {diagnosisViewModel.targetItem.cpwText}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={diagnosisViewModel.statusBoxClass}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold text-slate-950">
            状况
          </h3>

          <span className={diagnosisViewModel.badgeClass}>
            {diagnosisViewModel.status}
          </span>
        </div>
        <p className={diagnosisViewModel.statusTextClass}>
          {diagnosisViewModel.type === 'empty'
            ? '当前没有衣橱单品，因此不会展示重点单品或穿搭建议。'
            : `系统已选出本次重点诊断单品：${diagnosisViewModel.targetItem.name}。`}
        </p>
      </div>

      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">系统判断</p>
        <p className="mt-2 text-base font-bold leading-6 text-slate-900">
          {diagnosisViewModel.judgmentTitle}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {diagnosisViewModel.judgment}
        </p>
      </div>

      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">系统建议</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {diagnosisViewModel.suggestion}
        </p>
      </div>

      <div className="mt-4 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <p className="text-sm font-semibold text-emerald-800">下一步行动</p>
        {diagnosisViewModel.outfitText && (
          <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
            {diagnosisViewModel.outfitText}
          </p>
        )}
        <p className="mt-2 text-sm leading-6 text-emerald-700">
          {diagnosisViewModel.action}
        </p>
      </div>
      <div className="mt-5 grid gap-3">
  <button
    onClick={handleDiagnosisPrimaryAction}
    className="rounded-full bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800"
  >
    {diagnosisViewModel.primaryLabel}
  </button>

  {diagnosisViewModel.secondaryAction && (
    <button
      onClick={handleDiagnosisSecondaryAction}
      disabled={resaleLoading || resettingDemo}
      className="rounded-full border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      {resaleLoading
        ? '生成中……'
        : resettingDemo
          ? '重置中……'
          : diagnosisViewModel.secondaryLabel}
    </button>
  )}
</div>
    </section>
  </div>
)}


  {isResaleOpen && resaleCopy && (
  <div
    onClick={closeResaleDrawer}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
  >
    <section
      onClick={(event) => event.stopPropagation()}
      className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-600">
            转卖回收方案
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            这件单品可以转卖回收预算
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            系统已根据原价、穿着次数、CPW 和闲置情况生成发布内容。
          </p>
        </div>

        <button
          onClick={closeResaleDrawer}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          关闭
        </button>
      </div>

      <div className="mt-6 rounded-3xl bg-emerald-600 p-5 text-white shadow-sm">
        <p className="text-sm font-semibold text-emerald-50">建议转卖价</p>
        <p className="mt-2 text-3xl font-bold">
          {getResaleSuggestedPrice(resaleCopy)}
        </p>
        <p className="mt-2 text-xs leading-5 text-emerald-50">
          价格由原价、穿着次数和当前单次穿着成本综合估算，可作为闲鱼发布时的参考价。
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">发布标题</p>
          <p className="mt-2 text-base font-bold leading-6 text-slate-900">
            {getResaleTitle(resaleCopy)}
          </p>
        </div>

        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">发布用途</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            可直接用于闲鱼、二手社群或课堂演示中的转卖发布场景。
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">发布描述</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
          {getResaleDescription(resaleCopy)}
        </p>
      </div>

      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">完整发布文案</p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            可手动复制
          </span>
        </div>

        <textarea
          ref={resaleCopyTextareaRef}
          readOnly
          value={buildResaleCopyText(resaleCopy)}
          onFocus={(event) => event.target.select()}
          className="mt-3 h-44 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-slate-900"
        />

        <p className="mt-2 text-xs text-slate-500">
          若一键复制受浏览器限制，系统会自动选中文案，可长按复制。
        </p>
      </div>

      <button
        onClick={handleCopyResaleText}
        disabled={copyLoading}
        className="mt-6 w-full rounded-full bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {copyLoading ? '复制中……' : '复制发布文案'}
      </button>
    </section>
  </div>
)}

{isClearConfirmOpen && (
  <div
    onClick={closeClearConfirm}
    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4"
  >
    <section
      onClick={(event) => event.stopPropagation()}
      className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-white/10"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-700">
        !
      </div>

      <h2 className="mt-4 text-center text-xl font-bold text-slate-900">
        清空衣橱？
      </h2>

      <p className="mt-3 text-center text-sm leading-6 text-slate-500">
        这是演示辅助功能。确认后会清空当前衣橱，方便展示空衣橱下的诊断结果。你可以随时点击“重置演示数据”恢复标准演示衣物。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={closeClearConfirm}
          disabled={clearingDemo}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          取消
        </button>

        <button
          onClick={handleClearDemoData}
          disabled={clearingDemo}
          className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {clearingDemo ? '清空中...' : '确认清空'}
        </button>
      </div>
    </section>
  </div>
)}

{deleteTarget && (
  <div
    onClick={closeDeleteConfirm}
    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4"
  >
    <section
      onClick={(event) => event.stopPropagation()}
      className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-white/10"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
        🗑️
      </div>

      <h2 className="mt-4 text-center text-xl font-bold text-slate-900">
        确认删除这件单品？
      </h2>

      <p className="mt-3 text-center text-sm leading-6 text-slate-500">
        「{deleteTarget.name}」删除后将不再出现在衣柜列表中，但不会影响你后续重新录入演示数据。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={closeDeleteConfirm}
          disabled={deletingItemIds.includes(deleteTarget.id)}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          取消
        </button>

        <button
          onClick={confirmDeleteItem}
          disabled={deletingItemIds.includes(deleteTarget.id)}
          className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {deletingItemIds.includes(deleteTarget.id) ? '删除中……' : '确认删除'}
        </button>
      </div>
    </section>
  </div>
)}

      <button
        onClick={openAddPanel}
        aria-label="录入新单品"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-3xl font-semibold leading-none text-white shadow-xl transition hover:bg-slate-800"
      >
        +
      </button>

            {toastMessage && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg ${
            toastType === 'error' ? 'bg-red-600' : 'bg-slate-900'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </main>
  )
}

export default App

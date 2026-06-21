import { useEffect, useRef, useState } from 'react'
import { getColors } from './api/colorsApi'
import { runDiagnosis } from './api/diagnosisApi'
import { generateResaleCopy } from './api/resaleApi'
import {
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

function buildResaleCopyText(copy) {
  const title = getResaleTitle(copy)
  const description = getResaleDescription(copy)
  const suggestedPriceText = getResaleSuggestedPrice(copy)

  return `${title}

${description}

建议转卖价：${suggestedPriceText}`
}

function getDiagnosisDisplay(diagnosis) {
  const combinedText = [
    diagnosis?.level,
    diagnosis?.suggestion,
    diagnosis?.nextAction,
    ...(diagnosis?.tags || []),
  ]
    .join(' ')
    .toLowerCase()

  if (
    combinedText.includes('风险') ||
    combinedText.includes('闲置') ||
    combinedText.includes('转卖') ||
    combinedText.includes('低频') ||
    combinedText.includes('偏高') ||
    combinedText.includes('90')
  ) {
    return {
      label: '风险',
      title: '这件单品已经出现低频使用信号',
      description:
        '系统判断这件单品可能存在闲置或高成本问题，建议尽快搭配再穿，或考虑转卖回收预算。',
      badgeClass:
        'rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700',
      boxClass: 'mt-5 rounded-2xl bg-red-50 p-4 ring-1 ring-red-100',
      titleClass: 'text-sm font-semibold text-red-800',
      textClass: 'mt-2 text-sm leading-6 text-red-700',
    }
  }

  if (
    combinedText.includes('提醒') ||
    combinedText.includes('建议') ||
    combinedText.includes('cpw') ||
    combinedText.includes('成本') ||
    combinedText.includes('多穿')
  ) {
    return {
      label: '提醒',
      title: '这件单品还可以继续提升使用效率',
      description:
        '系统判断这件单品仍有优化空间，建议近期多穿 1-2 次，让单次穿着成本继续下降。',
      badgeClass:
        'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700',
      boxClass: 'mt-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100',
      titleClass: 'text-sm font-semibold text-amber-800',
      textClass: 'mt-2 text-sm leading-6 text-amber-700',
    }
  }

  return {
    label: '健康',
    title: '这件单品目前状态良好',
    description:
      '系统暂未发现明显闲置风险，可以继续保持当前穿着频率，并观察后续 CPW 变化。',
    badgeClass:
      'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700',
    boxClass: 'mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100',
    titleClass: 'text-sm font-semibold text-emerald-800',
    textClass: 'mt-2 text-sm leading-6 text-emerald-700',
  }
}


function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

  const [wardrobe, setWardrobe] = useState([])
  const [imageErrorItemIds, setImageErrorItemIds] = useState([])
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('green sweater')
  const [newPrice, setNewPrice] = useState('')
  const [selectedColorKey, setSelectedColorKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [resettingDemo, setResettingDemo] = useState(false)

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

  function openAddPanel() {
    setIsAddOpen(true)
    loadColors()
  }

  function closeAddPanel() {
    if (saving) return
    setIsAddOpen(false)
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

async function handleCreateItem() {
  if (saving) {
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
        imageUrl: '/assets/items/green-knit.png',
        colorKey: selectedColorKey,
        priceCents: Math.round(priceNumber * 100),
      })

      showToast('新增衣服成功')
      setIsAddOpen(false)
      setNewName('green sweater')
      setNewPrice('')

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

async function handleCopyResaleText() {
  if (copyLoading) {
    return
  }

  const text = buildResaleCopyText(resaleCopy)

  try {
    setCopyLoading(true)

    // 让“复制中……”至少可见一小会儿，避免复制太快导致用户看不见按钮状态变化
    await sleep(500)

    await navigator.clipboard.writeText(text)
    showToast('发布文案已复制，打开闲鱼即可粘贴')
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

  const targetItem = wardrobe[0]
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
    loadWardrobe()

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

    useEffect(() => {
  const shouldLockScroll =
    isAddOpen || isDiagnosisOpen || isResaleOpen || Boolean(deleteTarget)

  const originalOverflow = document.body.style.overflow

  if (shouldLockScroll) {
    document.body.style.overflow = 'hidden'
  }

  return () => {
    document.body.style.overflow = originalOverflow
  }
}, [isAddOpen, isDiagnosisOpen, isResaleOpen, deleteTarget])

    const canSave =
    newName.trim() && selectedColorKey && newPrice && Number(newPrice) > 0

  const diagnosisDisplay = diagnosisResult
    ? getDiagnosisDisplay(diagnosisResult)
    : null

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
                disabled={resettingDemo}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {resettingDemo ? '重置中……' : '重置演示数据'}
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
                <div className="flex h-44 items-center justify-center rounded-2xl bg-white/10 text-5xl">
                  👕
                </div>
                <p className="mt-4 text-sm font-semibold">演示阶段使用默认图片</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  暂不做真实图片上传，保存后系统会使用固定演示图片跑通流程。
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

{isDiagnosisOpen && diagnosisResult && (
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
          穿搭盲盒
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          穿搭盲盒已掉落
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          系统根据 CPW、穿着次数和闲置天数，为你挑出值得重新激活的单品。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            高价值
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            低频
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            可挽救
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold text-slate-950">
            {diagnosisResult.level || '状态良好'}
          </h3>

          {diagnosisDisplay && (
            <span className={diagnosisDisplay.badgeClass}>
              {diagnosisDisplay.label}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">诊断标签</p>

        <div className="mt-2 flex flex-wrap gap-2">
          {(diagnosisResult.tags || []).length > 0 ? (
            diagnosisResult.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">
  系统暂未发现明显风险，这件单品目前状态良好。
</span>
          )}
        </div>
      </div>

      {diagnosisDisplay && (
        <div className="mt-4 rounded-3xl bg-red-50 p-4 ring-1 ring-red-100">
          <p className="text-sm font-semibold text-red-800">系统判断</p>
          <p className="mt-2 text-base font-bold text-slate-900">
            {diagnosisDisplay.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-red-700">
            {diagnosisDisplay.description}
          </p>
        </div>
      )}

      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">系统建议</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {diagnosisResult.suggestion || '系统暂未发现明显闲置风险，可以继续保持当前穿着频率。'}
        </p>
      </div>

      <div className="mt-4 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <p className="text-sm font-semibold text-emerald-800">下一步行动</p>
        <p className="mt-2 text-sm leading-6 text-emerald-700">
          {diagnosisResult.nextAction || '可以继续穿着观察，也可以生成转卖文案作为备选。'}
        </p>
      </div>
      <div className="mt-5 grid gap-3">
  <button
    onClick={closeDiagnosisModal}
    className="rounded-full bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800"
  >
    采纳建议，明天穿这套
  </button>

  <button
    onClick={handleGenerateResaleCopy}
    disabled={resaleLoading}
    className="rounded-full border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
  >
    {resaleLoading ? '生成中……' : '放弃挽救，我要转卖'}
  </button>
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
          readOnly
          value={buildResaleCopyText(resaleCopy)}
          onFocus={(event) => event.target.select()}
          className="mt-3 h-44 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-slate-900"
        />

        <p className="mt-2 text-xs text-slate-500">
          如果浏览器限制剪贴板权限，可以点击文本框后手动复制。
        </p>
      </div>

      <button
        onClick={handleCopyResaleText}
        disabled={copyLoading}
        className="mt-6 w-full rounded-full bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {copyLoading ? '复制中……' : '复制完整发布文案'}
      </button>
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

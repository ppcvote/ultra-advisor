import { useEffect, useRef, useState } from 'react'
import { Tldraw, Editor, TLStoreSnapshot, getSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'
import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../firebase'
import { ArrowLeft, Save, Share2, Eye, Users, Check, History, Loader2 } from 'lucide-react'
import { toast } from '../utils/toast'

const COLLECTION = 'whiteboards'
// 🔧 debounce 提高到 2000ms — Aug 流動車 demo 20 個 iPad 同時 viewer 才不會把 Firestore 寫爆
const SYNC_DEBOUNCE_MS = 2000
const PRESENTER_TOKEN_KEY = 'p'

function generateId(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}
function generateToken(): string {
  return generateId(24)
}
function parseRoute(): { roomId: string | null; presenterToken: string | null } {
  const path = window.location.pathname
  const match = path.match(/^\/whiteboard\/([a-z0-9]+)/)
  const roomId = match ? match[1] : null
  const params = new URLSearchParams(window.location.search)
  const presenterToken = params.get(PRESENTER_TOKEN_KEY)
  return { roomId, presenterToken }
}

export default function WhiteboardPage() {
  const [view, setView] = useState<'home' | 'board' | 'history' | 'loading'>('home')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [presenterToken, setPresenterToken] = useState<string | null>(null)
  const [isPresenter, setIsPresenter] = useState(false)
  const [initialSnapshot, setInitialSnapshot] = useState<TLStoreSnapshot | undefined>(undefined)
  const [presenterUrl, setPresenterUrl] = useState<string>('')
  const [viewerUrl, setViewerUrl] = useState<string>('')
  const [copied, setCopied] = useState<'presenter' | 'viewer' | null>(null)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [saved, setSaved] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPresenterRef = useRef(false)
  const viewerUnsubRef = useRef<(() => void) | null>(null)

  // === 偵測 route + 載入初始狀態 ===
  useEffect(() => {
    const { roomId: rid, presenterToken: tok } = parseRoute()
    if (!rid) return // 留在首頁
    setRoomId(rid)
    setPresenterToken(tok)
    setView('loading')

    ;(async () => {
      try {
        const ref = doc(db, COLLECTION, rid)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          toast.error('白板不存在')
          window.location.href = '/whiteboard'
          return
        }
        const data = snap.data()
        const validPresenter = !!tok && data.presenterToken === tok
        setIsPresenter(validPresenter)
        isPresenterRef.current = validPresenter

        const base = `${window.location.origin}/whiteboard/${rid}`
        setViewerUrl(base)
        setPresenterUrl(`${base}?${PRESENTER_TOKEN_KEY}=${data.presenterToken}`)

        // 注意：snapshot 直接傳給 Tldraw，不在 onMount 後才 load
        const remoteSnap = data.snapshot as TLStoreSnapshot | null
        if (remoteSnap) {
          setInitialSnapshot(remoteSnap)
        }
        setView('board')
      } catch (err) {
        console.error('Load whiteboard failed:', err)
        toast.error('載入白板失敗')
        window.location.href = '/whiteboard'
      }
    })()
  }, [])

  // === Create new whiteboard ===
  const handleCreate = async () => {
    const user = getAuth().currentUser
    if (!user) {
      toast.warning('請先登入才能建立白板')
      return
    }
    const newRoomId = generateId(8)
    const newToken = generateToken()
    const ref = doc(db, COLLECTION, newRoomId)
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      presenterToken: newToken,
      presenterUid: user.uid, // 🔒 SECURITY: 綁定建立者 UID（rules 用這個檢查寫入權限）
      snapshot: null,
      title: `白板 ${new Date().toLocaleString('zh-TW')}`,
    })
    const base = `${window.location.origin}/whiteboard/${newRoomId}`
    window.location.href = `${base}?${PRESENTER_TOKEN_KEY}=${newToken}`
  }

  // === Editor mount: 設定 readOnly + 訂閱 / 寫入 ===
  const handleMount = (editor: Editor) => {
    editorRef.current = editor
    editor.updateInstanceState({ isReadonly: !isPresenterRef.current })

    if (isPresenterRef.current) {
      // Presenter: 監聽本地變更 → 寫入 Firestore（不訂閱 Firestore）
      editor.store.listen(() => {
        if (!isPresenterRef.current) return
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(async () => {
          if (!roomId || !editorRef.current) return
          try {
            const snap = getSnapshot(editorRef.current.store)
            await setDoc(
              doc(db, COLLECTION, roomId),
              { snapshot: snap, updatedAt: serverTimestamp() },
              { merge: true }
            )
          } catch (err) {
            console.error('Sync failed:', err)
          }
        }, SYNC_DEBOUNCE_MS)
      }, { source: 'user', scope: 'document' })
    } else {
      // Viewer: 訂閱 Firestore → 用 mergeRemoteChanges 套用，避免 tldraw 抓到競態
      const unsub = onSnapshot(doc(db, COLLECTION, roomId!), (snap) => {
        if (!snap.exists() || !editorRef.current) return
        const data = snap.data()
        const newSnap = data.snapshot as TLStoreSnapshot | null
        if (!newSnap?.store) return
        try {
          // 用 mergeRemoteChanges 將遠端記錄寫進 store
          // 標記為「remote source」，避免觸發我們自己的 user-source listener
          editorRef.current.store.mergeRemoteChanges(() => {
            const records = Object.values(newSnap.store)
            editorRef.current!.store.put(records as any)
          })
        } catch (err) {
          console.error('Apply remote failed:', err)
        }
      })
      viewerUnsubRef.current = unsub
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      viewerUnsubRef.current?.()
      viewerUnsubRef.current = null
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // 角色變更時更新 readOnly
  useEffect(() => {
    isPresenterRef.current = isPresenter
    if (editorRef.current) {
      editorRef.current.updateInstanceState({ isReadonly: !isPresenter })
    }
  }, [isPresenter])

  // === Save permanent snapshot ===
  const handleSave = async () => {
    if (!roomId || !editorRef.current) return
    try {
      const snap = getSnapshot(editorRef.current.store)
      const titleInput = prompt('白板標題：', `白板 ${new Date().toLocaleString('zh-TW')}`)
      if (!titleInput) return
      await addDoc(collection(db, `${COLLECTION}/${roomId}/history`), {
        snapshot: snap,
        title: titleInput,
        savedAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      toast.error('儲存失敗')
    }
  }

  const copyUrl = (which: 'presenter' | 'viewer') => {
    const url = which === 'presenter' ? presenterUrl : viewerUrl
    navigator.clipboard.writeText(url).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const loadHistoryList = async () => {
    setView('history')
    try {
      const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(20))
      const snaps = await getDocs(q)
      setHistoryList(snaps.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const openBoard = (id: string, token?: string) => {
    const url = token ? `/whiteboard/${id}?${PRESENTER_TOKEN_KEY}=${token}` : `/whiteboard/${id}`
    window.location.href = url
  }

  // ============ LOADING ============
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-slate-400">載入白板中...</p>
        </div>
      </div>
    )
  }

  // ============ HOME ============
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-6 text-center">
          <h1 className="text-4xl font-bold">Ultra 白板</h1>
          <p className="text-slate-400">即時協作白板 · iPad 友善 · 一鍵分享</p>

          <button
            onClick={handleCreate}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 px-6 rounded-xl text-lg transition"
          >
            開始新白板
          </button>

          <button
            onClick={loadHistoryList}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <History size={18} />
            查看歷史白板
          </button>

          <div className="text-xs text-slate-500 mt-8 space-y-1 text-left bg-slate-900/50 p-4 rounded-lg">
            <p>💡 <strong>使用方式</strong></p>
            <p>1. 主持人點「開始新白板」</p>
            <p>2. 複製觀眾連結給團隊</p>
            <p>3. 大家用 iPad 開啟連結就能即時看到</p>
            <p>4. 結束按「儲存」永久保存</p>
          </div>
        </div>
      </div>
    )
  }

  // ============ HISTORY ============
  if (view === 'history') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setView('home')} className="flex items-center gap-2 text-slate-400 hover:text-white">
              <ArrowLeft size={18} /> 返回
            </button>
            <h2 className="text-2xl font-bold">歷史白板</h2>
            <div className="w-16"></div>
          </div>

          {historyList.length === 0 ? (
            <p className="text-center text-slate-500 mt-12">還沒有白板紀錄</p>
          ) : (
            <div className="space-y-2">
              {historyList.map((wb) => (
                <button
                  key={wb.id}
                  onClick={() => openBoard(wb.id, wb.presenterToken)}
                  className="w-full bg-slate-900 hover:bg-slate-800 p-4 rounded-lg text-left flex items-center justify-between transition"
                >
                  <div>
                    <p className="font-bold">{wb.title || `白板 ${wb.id}`}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {wb.createdAt?.toDate?.()?.toLocaleString('zh-TW') || '未知時間'}
                    </p>
                  </div>
                  <span className="text-amber-500 text-sm">開啟 →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============ BOARD ============
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => { window.location.href = '/whiteboard' }} className="text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <span className="font-mono text-amber-500">/{roomId}</span>
          {isPresenter ? (
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
              <Users size={12} /> 主持人
            </span>
          ) : (
            <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
              <Eye size={12} /> 觀眾（唯讀）
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPresenter && (
            <>
              <button
                onClick={() => copyUrl('viewer')}
                className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-white flex items-center gap-1.5 text-xs"
              >
                {copied === 'viewer' ? <Check size={14} /> : <Share2 size={14} />}
                {copied === 'viewer' ? '已複製' : '複製觀眾連結'}
              </button>
              <button
                onClick={handleSave}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded font-bold flex items-center gap-1.5 text-xs"
              >
                {saved ? <Check size={14} /> : <Save size={14} />}
                {saved ? '已儲存' : '儲存'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* tldraw: snapshot 透過 prop 傳入，不在 onMount 後才 load */}
      <div className="flex-1 relative">
        <Tldraw
          key={roomId} // 確保 roomId 改變時重新建立 editor
          snapshot={initialSnapshot}
          onMount={handleMount}
          autoFocus
        />
      </div>
    </div>
  )
}

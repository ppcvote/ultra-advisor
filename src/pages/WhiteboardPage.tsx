import { useEffect, useRef, useState } from 'react'
import { Tldraw, Editor, TLStoreSnapshot, getSnapshot, loadSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'
import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { ArrowLeft, Save, Share2, Eye, Users, Copy, Check, History } from 'lucide-react'

// --- Config ---
const COLLECTION = 'whiteboards'
const SYNC_DEBOUNCE_MS = 250
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
  const [view, setView] = useState<'home' | 'board' | 'history'>('home')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [presenterToken, setPresenterToken] = useState<string | null>(null)
  const [isPresenter, setIsPresenter] = useState(false)
  const [presenterUrl, setPresenterUrl] = useState<string>('')
  const [viewerUrl, setViewerUrl] = useState<string>('')
  const [copied, setCopied] = useState<'presenter' | 'viewer' | null>(null)
  const [viewerCount, setViewerCount] = useState(1)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [saved, setSaved] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const initialLoadedRef = useRef(false) // 是否已載入初始 snapshot（presenter 只載入一次）
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPresenterRef = useRef(false) // 給 listener 用的 ref（避免 stale closure）

  // Detect route on mount
  useEffect(() => {
    const { roomId: rid, presenterToken: tok } = parseRoute()
    if (rid) {
      setRoomId(rid)
      setPresenterToken(tok)
      setView('board')
    }
  }, [])

  // ===== Create new whiteboard =====
  const handleCreate = async () => {
    const newRoomId = generateId(8)
    const newToken = generateToken()
    const ref = doc(db, COLLECTION, newRoomId)
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      presenterToken: newToken,
      snapshot: null,
      title: `白板 ${new Date().toLocaleString('zh-TW')}`,
    })
    const base = `${window.location.origin}/whiteboard/${newRoomId}`
    window.history.pushState({}, '', `${base}?${PRESENTER_TOKEN_KEY}=${newToken}`)
    setRoomId(newRoomId)
    setPresenterToken(newToken)
    setView('board')
  }

  // ===== Validate presenter token + sync =====
  useEffect(() => {
    if (view !== 'board' || !roomId) return
    let isCurrentRoom = true
    const ref = doc(db, COLLECTION, roomId)

    // First load: verify token + 設定 URL
    getDoc(ref).then((snap) => {
      if (!isCurrentRoom) return
      if (!snap.exists()) {
        alert('白板不存在')
        window.location.href = '/whiteboard'
        return
      }
      const data = snap.data()
      const validPresenter = !!presenterToken && data.presenterToken === presenterToken
      setIsPresenter(validPresenter)
      isPresenterRef.current = validPresenter

      const base = `${window.location.origin}/whiteboard/${roomId}`
      setViewerUrl(base)
      setPresenterUrl(`${base}?${PRESENTER_TOKEN_KEY}=${data.presenterToken}`)
    })

    // Real-time listener
    // - Presenter: 只在「第一次」載入初始 snapshot，之後完全不接收（避免自己的 echo 洗掉畫面）
    // - Viewer: 每次都套用最新 snapshot
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists() || !editorRef.current) return
      const data = snap.data()
      const remoteSnap = data.snapshot as TLStoreSnapshot | null
      if (!remoteSnap) return

      // Presenter 只在初始載入一次就不再套用任何遠端資料
      if (isPresenterRef.current) {
        if (initialLoadedRef.current) return
        initialLoadedRef.current = true
        try {
          loadSnapshot(editorRef.current.store, remoteSnap)
        } catch (err) {
          console.error('Initial load failed:', err)
        }
        return
      }

      // Viewer: 套用每一次更新（這是純唯讀，不會有衝突）
      try {
        loadSnapshot(editorRef.current.store, remoteSnap)
      } catch (err) {
        console.error('Failed to apply remote snapshot:', err)
      }
    })

    return () => {
      isCurrentRoom = false
      unsub()
    }
  }, [view, roomId, presenterToken])

  // ===== Push local changes to Firestore (debounced) =====
  const handleMount = (editor: Editor) => {
    editorRef.current = editor

    // 用 ref 判斷（避免 closure stale）
    editor.updateInstanceState({ isReadonly: !isPresenterRef.current })

    // Listen for changes from local user
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
          console.error('Failed to sync snapshot:', err)
        }
      }, SYNC_DEBOUNCE_MS)
    }, { source: 'user', scope: 'document' })
  }

  // 當 isPresenter resolved 後，更新 ref + readOnly
  useEffect(() => {
    isPresenterRef.current = isPresenter
    if (editorRef.current) {
      editorRef.current.updateInstanceState({ isReadonly: !isPresenter })
    }
  }, [isPresenter])

  // ===== Permanent save (snapshot to history) =====
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
      alert('儲存失敗')
    }
  }

  // ===== Copy URL =====
  const copyUrl = (which: 'presenter' | 'viewer') => {
    const url = which === 'presenter' ? presenterUrl : viewerUrl
    navigator.clipboard.writeText(url).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  // ===== History list =====
  const loadHistoryList = async () => {
    setView('history')
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
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

  // ============ HOME VIEW ============
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

  // ============ HISTORY VIEW ============
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

  // ============ BOARD VIEW ============
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950">
      {/* Top bar */}
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

      {/* tldraw fills remaining space */}
      <div className="flex-1 relative">
        <Tldraw
          onMount={handleMount}
          autoFocus
        />
      </div>
    </div>
  )
}

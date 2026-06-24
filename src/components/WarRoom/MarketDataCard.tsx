import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  User, Check, Zap, Plus, Trash2, Settings, X,
  Edit3, Loader2, RefreshCw, Sparkles, BarChart3,
  Share2, Quote, Calendar, Layout, Type, ImageIcon, ExternalLink, PenTool, RotateCcw, Handshake,
  MapPin, Navigation, ParkingCircle, Volume2, MessageCircle
} from 'lucide-react';
import html2canvas from 'html2canvas';
// PERF: today's quote/bg 用 build-time prerender, 不用為了「今天那筆」就拉整包.
// 但 random / IG 仍需要完整資料集, 所以留著.
import { getRandomQuote, getRandomBackground, DailyQuote, getTodayIGQuote, getRandomIGQuote, IGStyleQuote } from '../../data/dailyQuotes';
import { todayQuote as prerenderedTodayQuote, todayBackground as prerenderedTodayBackground, type PrerenderedBackground } from '../../data/_today-quote.generated';
import { formatDateChinese } from '../../utils/dateFormat';
import { toast } from '../../utils/toast';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../../firebase';

// ==========================================
// 🏪 Ultra Alliance 模擬合作夥伴資料
// ==========================================
interface Partner {
  id: string;
  name: string;
  type: 'meeting_spot' | 'service_provider';
  category: 'cafe' | 'restaurant' | 'business' | 'suit' | 'photo';
  location: { lat: number; lng: number; address: string };
  features: { quiet: boolean; parking: boolean; power: boolean };
  offer: { title: string; description: string };
  image: string;
  rating: number;
  isUltraPartner: boolean;
}

// 模擬合作夥伴資料（未來從 Firestore 讀取）
// isUltraPartner = true 為正式合作店家，false 為 Google 高評分推薦
const MOCK_PARTNERS: Partner[] = [
  // ===== Ultra 合作店家 =====
  {
    id: '1',
    name: '路易莎咖啡 信義旗艦店',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0330, lng: 121.5654, address: '台北市信義區信義路五段7號' },
    features: { quiet: true, parking: true, power: true },
    offer: { title: 'Ultra 會員 9 折', description: '出示會員畫面即可' },
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop',
    rating: 4.6,
    isUltraPartner: true,
  },
  {
    id: '2',
    name: 'Cama Café 南港軟體園區店',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0596, lng: 121.6177, address: '台北市南港區三重路19-2號' },
    features: { quiet: true, parking: false, power: true },
    offer: { title: '第二杯半價', description: '限手沖系列' },
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
    rating: 4.5,
    isUltraPartner: true,
  },
  {
    id: '3',
    name: 'COFFEE LAW 大安旗艦',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0264, lng: 121.5436, address: '台北市大安區敦化南路一段233巷28號' },
    features: { quiet: true, parking: true, power: true },
    offer: { title: 'Ultra 專屬包廂', description: '提前預約享免費使用' },
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    rating: 4.8,
    isUltraPartner: true,
  },
  {
    id: '4',
    name: 'WeWork 信義區',
    type: 'meeting_spot',
    category: 'business',
    location: { lat: 25.0330, lng: 121.5637, address: '台北市信義區松仁路100號' },
    features: { quiet: true, parking: true, power: true },
    offer: { title: '免費會議室 2 小時', description: 'Ultra 白金會員專屬' },
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
    rating: 4.7,
    isUltraPartner: true,
  },
  // ===== Google 高評分推薦（非合作，但適合約客戶） =====
  {
    id: '5',
    name: '星巴克 101 門市',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0339, lng: 121.5645, address: '台北市信義區市府路45號' },
    features: { quiet: false, parking: true, power: true },
    offer: { title: '高評分推薦', description: 'Google 4.5 ★' },
    image: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=400&h=300&fit=crop',
    rating: 4.5,
    isUltraPartner: false,
  },
  {
    id: '6',
    name: 'ABG Coffee 大安店',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0280, lng: 121.5450, address: '台北市大安區復興南路一段107巷5弄18號' },
    features: { quiet: true, parking: false, power: true },
    offer: { title: '高評分推薦', description: 'Google 4.7 ★' },
    image: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=400&h=300&fit=crop',
    rating: 4.7,
    isUltraPartner: false,
  },
  {
    id: '7',
    name: 'Fika Fika Cafe',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0520, lng: 121.5210, address: '台北市中山區伊通街33號' },
    features: { quiet: true, parking: false, power: true },
    offer: { title: '高評分推薦', description: 'Google 4.6 ★' },
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=300&fit=crop',
    rating: 4.6,
    isUltraPartner: false,
  },
  {
    id: '8',
    name: 'All Day Roasting Company',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0410, lng: 121.5490, address: '台北市大安區仁愛路四段27巷4弄1號' },
    features: { quiet: true, parking: true, power: true },
    offer: { title: '高評分推薦', description: 'Google 4.8 ★' },
    image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400&h=300&fit=crop',
    rating: 4.8,
    isUltraPartner: false,
  },
  {
    id: '9',
    name: 'Café de Gear',
    type: 'meeting_spot',
    category: 'cafe',
    location: { lat: 25.0350, lng: 121.5580, address: '台北市大安區敦化南路一段160巷53號' },
    features: { quiet: true, parking: true, power: true },
    offer: { title: '高評分推薦', description: 'Google 4.5 ★' },
    image: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&h=300&fit=crop',
    rating: 4.5,
    isUltraPartner: false,
  },
];

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // 地球半徑（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 距離（公里）
};

// 格式化距離顯示
const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

// ==========================================
// 📊 市場數據卡片（含每日金句）
// ==========================================

// 文案字體風格配置（使用 Google Fonts 繁體中文字體）
// 注意：所有字體都已在 index.html 中透過 Google Fonts 載入
type FontStyle = 'default' | 'wenkai' | 'headline' | 'elegant';
const FONT_STYLES: Record<FontStyle, { name: string; fontFamily: string; className: string }> = {
  default: {
    name: '預設',
    fontFamily: '"Noto Sans TC", sans-serif',
    className: ''
  },
  wenkai: {
    name: '楷書',
    fontFamily: '"LXGW WenKai Mono TC", cursive',
    className: ''
  },
  headline: {
    name: '粗黑',
    fontFamily: '"Noto Sans TC", sans-serif',
    className: 'font-black tracking-tight'
  },
  elegant: {
    name: '明體',
    fontFamily: '"Noto Serif TC", serif',
    className: ''
  }
};

// 排版風格類型
type LayoutStyle = 'center' | 'left' | 'magazine' | 'card';

// 顧問名字字體風格配置（繁體中文書法/手寫風格）
// 注意：所有字體都已在 index.html 中透過 Google Fonts 載入
type NameFontStyle = 'default' | 'serif' | 'wenkai' | 'xiaowei' | 'kuaile';
const NAME_FONT_STYLES: Record<NameFontStyle, { name: string; fontFamily: string; preview: string }> = {
  default: {
    name: '預設',
    fontFamily: '"Noto Sans TC", sans-serif',
    preview: '王大明'
  },
  serif: {
    name: '明體',
    fontFamily: '"Noto Serif TC", serif',
    preview: '王大明'
  },
  wenkai: {
    name: '楷書',
    fontFamily: '"LXGW WenKai Mono TC", cursive',
    preview: '王大明'
  },
  xiaowei: {
    name: '文藝',
    fontFamily: '"ZCOOL XiaoWei", serif',
    preview: '王大明'
  },
  kuaile: {
    name: '可愛',
    fontFamily: '"ZCOOL KuaiLe", cursive',
    preview: '王大明'
  }
};

// 自訂背景介面
interface CustomBackground {
  id: string;
  dataUrl: string;       // base64 用於本地預覽/截圖
  storageUrl?: string;   // Firebase Storage URL（持久化）
  storagePath?: string;  // Storage 路徑（用於刪除）
  uploadedAt: number;
}

// 濾鏡類型
type FilterStyle = 'grayscale' | 'sepia' | 'warm' | 'cool' | 'none';

const FILTER_STYLES: Record<FilterStyle, { name: string; css: string; preview: string }> = {
  grayscale: { name: '黑白', css: 'grayscale(100%)', preview: '⬛' },
  sepia: { name: '復古', css: 'sepia(80%)', preview: '🟤' },
  warm: { name: '暖色', css: 'sepia(30%) saturate(140%) brightness(105%)', preview: '🟠' },
  cool: { name: '冷色', css: 'saturate(80%) hue-rotate(20deg) brightness(105%)', preview: '🔵' },
  none: { name: '原色', css: 'none', preview: '🌈' },
};

// 預載入圖片並套用濾鏡，返回 data URL
const loadImageWithFilter = (imageUrl: string, filterStyle: FilterStyle): Promise<string> => {
  return new Promise((resolve) => {
    // 如果是原色，直接返回原圖
    if (filterStyle === 'none') {
      resolve(imageUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      // 繪製圖片
      ctx.drawImage(img, 0, 0);

      // 取得像素資料並套用濾鏡
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (filterStyle === 'grayscale') {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          } else if (filterStyle === 'sepia') {
            data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
          } else if (filterStyle === 'warm') {
            data[i] = Math.min(255, r * 1.1);
            data[i + 1] = Math.min(255, g * 1.0);
            data[i + 2] = Math.min(255, b * 0.9);
          } else if (filterStyle === 'cool') {
            data[i] = Math.min(255, r * 0.9);
            data[i + 1] = Math.min(255, g * 1.0);
            data[i + 2] = Math.min(255, b * 1.1);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        // 跨域錯誤，返回原圖
        console.warn('無法處理跨域圖片，使用原圖');
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      resolve(imageUrl);
    };

    // 設定超時
    setTimeout(() => resolve(imageUrl), 5000);

    img.src = imageUrl;
  });
};

interface MarketDataCardProps {
  userId?: string;
  userDisplayName?: string;
  userPhotoURL?: string;
  membership?: any;
  onOpenThreadsAssistant?: () => void;
}

const MarketDataCard: React.FC<MarketDataCardProps> = ({ userId, userDisplayName, userPhotoURL, membership, onOpenThreadsAssistant }) => {
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const [totalShareDays, setTotalShareDays] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [todayShared, setTodayShared] = useState(false);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [bgBase64, setBgBase64] = useState<string | null>(null);
  // 市場報告模式
  const [storyMode, setStoryMode] = useState<'quote' | 'market'>('quote');
  const [marketReport, setMarketReport] = useState<any>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  // 隨機文案/背景 state
  const [customQuote, setCustomQuote] = useState<DailyQuote | null>(null);
  const [customBg, setCustomBg] = useState<PrerenderedBackground | null>(null);
  const storyRef = useRef<HTMLDivElement>(null);

  // ========== 進階設定狀態 ==========
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  // 排版風格
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('center');
  // 文案編輯
  const [useCustomText, setUseCustomText] = useState(false);
  const [customText, setCustomText] = useState('');
  // IG 風格專用文案
  const [customIGQuote, setCustomIGQuote] = useState<IGStyleQuote | null>(null);
  const [useCustomIGText, setUseCustomIGText] = useState(false);
  const [customIGTitle, setCustomIGTitle] = useState('');
  const [customIGLines, setCustomIGLines] = useState('');
  // 字體選擇
  const [fontStyle, setFontStyle] = useState<FontStyle>('default');
  // 顧問名字字體
  const [nameFontStyle, setNameFontStyle] = useState<NameFontStyle>('default');
  // 金句字體大小（百分比，100 = 預設大小）
  const [quoteFontSize, setQuoteFontSize] = useState(100);
  // 自訂背景
  const [customBackgrounds, setCustomBackgrounds] = useState<CustomBackground[]>([]);
  const [selectedCustomBgIndex, setSelectedCustomBgIndex] = useState<number | null>(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  // 濾鏡選擇
  const [filterStyle, setFilterStyle] = useState<FilterStyle>('grayscale');
  // 頭像大小
  const [avatarSize, setAvatarSize] = useState<'small' | 'medium' | 'large'>('large');

  // ========== 簽名功能狀態 ==========
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureColor, setSignatureColor] = useState('#FFFFFF'); // 預設白色
  const [signatureSize, setSignatureSize] = useState<'small' | 'medium' | 'large'>('medium');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // ========== 雜誌風格位置（固定值，移除拖拉功能）==========
  const magazineTitlePos = { x: 24, y: 80 };
  const magazineContentPos = { x: 24, y: 140 };

  // ========== Ultra Alliance GPS 狀態 ==========
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyPartners, setNearbyPartners] = useState<(Partner & { distance: number })[]>([]);

  // 取得使用者位置
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('您的瀏覽器不支援定位功能');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);

        // 計算並排序附近夥伴
        // 排序優先級：1. Ultra 合作店家優先 2. 評分高優先 3. 距離近優先
        const partnersWithDistance = MOCK_PARTNERS.map(partner => ({
          ...partner,
          distance: calculateDistance(latitude, longitude, partner.location.lat, partner.location.lng)
        }))
        .filter(p => p.distance <= 5) // 5km 內（擴大範圍以確保有足夠結果）
        .sort((a, b) => {
          // 1. Ultra 合作店家優先
          if (a.isUltraPartner && !b.isUltraPartner) return -1;
          if (!a.isUltraPartner && b.isUltraPartner) return 1;
          // 2. 同類型則按評分排序（高→低）
          if (a.rating !== b.rating) return b.rating - a.rating;
          // 3. 評分相同則按距離（近→遠）
          return a.distance - b.distance;
        })
        .slice(0, 3); // 只取前 3 間

        setNearbyPartners(partnersWithDistance);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('permission_denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('無法取得位置資訊');
            break;
          case error.TIMEOUT:
            setLocationError('定位逾時，請重試');
            break;
          default:
            setLocationError('定位失敗');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // 不再自動請求定位，讓用戶進入 Alliance 頁面後再請求

  // ========== IG 風格位置（固定值，移除拖拉功能）==========
  const igTitlePos = { x: 16, y: 180 };
  const igContentPos = { x: 16, y: 260 };

  const todayQuote = prerenderedTodayQuote;
  const todayBg = prerenderedTodayBackground;
  const todayDate = formatDateChinese();
  const todayIGQuote = getTodayIGQuote();

  // 實際顯示的金句和背景（優先使用自訂，否則用今日預設）
  const displayQuote = customQuote || todayQuote;

  // IG 風格文案（優先：自訂 > 隨機 > 今日預設）
  const displayIGQuote = useMemo((): IGStyleQuote => {
    if (useCustomIGText && customIGTitle.trim()) {
      return {
        title: customIGTitle,
        lines: customIGLines.split('\n').filter(line => line.trim())
      };
    }
    return customIGQuote || todayIGQuote;
  }, [useCustomIGText, customIGTitle, customIGLines, customIGQuote, todayIGQuote]);

  // 優先：自訂背景 > 隨機背景 > 今日預設
  const displayBg = useMemo(() => {
    if (selectedCustomBgIndex !== null && customBackgrounds[selectedCustomBgIndex]) {
      return {
        id: customBackgrounds[selectedCustomBgIndex].id,
        imageUrl: customBackgrounds[selectedCustomBgIndex].dataUrl,
        fallbackGradient: 'from-slate-900 via-slate-800 to-zinc-900'
      };
    }
    return customBg || todayBg;
  }, [selectedCustomBgIndex, customBackgrounds, customBg, todayBg]);

  // 實際顯示的文案（自訂文案 > 金句庫）- 置中排版用
  const displayQuoteText = useCustomText && customText.trim()
    ? customText
    : displayQuote.text;

  // 將句號後自動換行（用於顯示）
  const formatQuoteWithLineBreaks = (text: string) => {
    // 以句號（。）分割，但保留句號
    const parts = text.split(/(?<=。)/);
    return parts.map((part, index) => (
      <span key={index}>
        {part}
        {index < parts.length - 1 && <br />}
      </span>
    ));
  };

  // 隨機切換文案和背景
  const handleShuffle = () => {
    if (layoutStyle === 'left' || layoutStyle === 'magazine') {
      // IG 風格 & 雜誌風格：切換 IG 專用文案（標題+分段）
      setCustomIGQuote(getRandomIGQuote());
    } else {
      // 置中/卡片風格：切換一般金句
      setCustomQuote(getRandomQuote());
    }
    setCustomBg(getRandomBackground());
  };

  // 重置為今日預設
  const handleResetToToday = () => {
    setCustomQuote(null);
    setCustomBg(null);
    setCustomIGQuote(null);
    setSelectedCustomBgIndex(null);
  };

  // ========== 背景上傳處理（上傳至 Firebase Storage + Firestore 持久化）==========
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 7 - customBackgrounds.length;
    if (remainingSlots <= 0) {
      toast.warning('最多只能上傳 7 張自訂背景');
      return;
    }

    setIsUploadingBg(true);
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    const newBackgrounds: CustomBackground[] = [];

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} 超過 5MB 限制`);
        continue;
      }

      const bgId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 轉 base64（供 html2canvas 截圖）
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 上傳至 Firebase Storage
      let storageUrl = '';
      let storagePath = '';
      if (userId) {
        try {
          storagePath = `dailyStoryBg/${userId}/${bgId}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          storageUrl = await getDownloadURL(storageRef);
        } catch (err) {
          console.error('[DailyStory] 背景上傳 Storage 失敗:', err);
        }
      }

      newBackgrounds.push({
        id: bgId,
        dataUrl,
        storageUrl: storageUrl || undefined,
        storagePath: storagePath || undefined,
        uploadedAt: Date.now()
      });
    }

    const updatedBgs = [...customBackgrounds, ...newBackgrounds];
    setCustomBackgrounds(updatedBgs);
    setIsUploadingBg(false);
    e.target.value = '';

    // 儲存到 Firestore
    if (userId) {
      try {
        const docRef = doc(db, 'users', userId, 'dailyStory', 'customBackgrounds');
        await setDoc(docRef, {
          backgrounds: updatedBgs.map(bg => ({
            id: bg.id,
            storageUrl: bg.storageUrl || '',
            storagePath: bg.storagePath || '',
            uploadedAt: bg.uploadedAt
          })),
          updatedAt: Timestamp.now()
        });
      } catch (err) {
        console.error('[DailyStory] 儲存背景清單失敗:', err);
      }
    }
  };

  // 刪除自訂背景（同步刪除 Storage + Firestore）
  const handleDeleteBg = async (index: number) => {
    const bgToDelete = customBackgrounds[index];
    const updatedBgs = customBackgrounds.filter((_, i) => i !== index);
    setCustomBackgrounds(updatedBgs);

    if (selectedCustomBgIndex === index) {
      setSelectedCustomBgIndex(null);
    } else if (selectedCustomBgIndex !== null && selectedCustomBgIndex > index) {
      setSelectedCustomBgIndex(prev => prev! - 1);
    }

    // 刪除 Storage 檔案
    if (bgToDelete.storagePath) {
      try {
        const storageRef = ref(storage, bgToDelete.storagePath);
        await deleteObject(storageRef);
      } catch (err) {
        console.error('[DailyStory] 刪除 Storage 背景失敗:', err);
      }
    }

    // 更新 Firestore
    if (userId) {
      try {
        const docRef = doc(db, 'users', userId, 'dailyStory', 'customBackgrounds');
        await setDoc(docRef, {
          backgrounds: updatedBgs.map(bg => ({
            id: bg.id,
            storageUrl: bg.storageUrl || '',
            storagePath: bg.storagePath || '',
            uploadedAt: bg.uploadedAt
          })),
          updatedAt: Timestamp.now()
        });
      } catch (err) {
        console.error('[DailyStory] 更新背景清單失敗:', err);
      }
    }
  };

  // 載入已儲存的自訂背景
  useEffect(() => {
    if (!userId) return;
    const loadCustomBgs = async () => {
      try {
        const docRef = doc(db, 'users', userId, 'dailyStory', 'customBackgrounds');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const savedBgs: CustomBackground[] = (data.backgrounds || []).map((bg: any) => ({
            id: bg.id,
            dataUrl: bg.storageUrl || '',  // 用 storageUrl 作為圖片來源
            storageUrl: bg.storageUrl,
            storagePath: bg.storagePath,
            uploadedAt: bg.uploadedAt
          }));
          if (savedBgs.length > 0) {
            setCustomBackgrounds(savedBgs);
            console.log(`[DailyStory] 載入 ${savedBgs.length} 張自訂背景`);
          }
        }
      } catch (err) {
        console.error('[DailyStory] 載入自訂背景失敗:', err);
      }
    };
    loadCustomBgs();
  }, [userId]);

  // ========== 簽名功能處理 ==========
  // 初始化簽名畫布
  const initSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 設定畫布為白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // 開始簽名
  const startSignatureDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    // 阻止預設行為（防止觸控滾動導致反白）
    e.preventDefault();
    e.stopPropagation();

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();

    // 計算縮放比例（CSS 寬度 vs canvas 實際寬度）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    lastPosRef.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  // 繪製簽名
  const drawSignature = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 阻止預設行為（防止觸控滾動導致反白）
    e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();

    // 計算縮放比例（CSS 寬度 vs canvas 實際寬度）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentPos = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };

    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.strokeStyle = '#000000'; // 用黑色畫，之後再轉換
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPosRef.current = currentPos;
  }, []);

  // 結束簽名繪製
  const endSignatureDrawing = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    isDrawingRef.current = false;
  }, []);

  // 清除簽名
  const clearSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // 儲存簽名（去除白色背景，轉為指定顏色）
  const saveSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 取得畫布資料
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 解析目標顏色
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 255, b: 255 };
    };
    const targetColor = hexToRgb(signatureColor);

    // 建立輸出畫布（去背景版本）
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    const outputImageData = outputCtx.createImageData(canvas.width, canvas.height);
    const outputData = outputImageData.data;

    // 檢查是否有繪製內容
    let hasContent = false;

    // 遍歷每個像素：白色變透明，黑色變目標顏色
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 判斷是否為白色背景（允許一些誤差）
      const isWhite = r > 240 && g > 240 && b > 240;

      if (isWhite) {
        // 白色變透明
        outputData[i] = 0;
        outputData[i + 1] = 0;
        outputData[i + 2] = 0;
        outputData[i + 3] = 0;
      } else {
        // 非白色（筆跡）變成目標顏色
        hasContent = true;
        // 根據原始像素的深淺程度計算透明度
        const darkness = 255 - ((r + g + b) / 3);
        outputData[i] = targetColor.r;
        outputData[i + 1] = targetColor.g;
        outputData[i + 2] = targetColor.b;
        outputData[i + 3] = Math.min(255, darkness * 1.5); // 增強對比
      }
    }

    if (!hasContent) {
      toast.warning('請先簽名');
      return;
    }

    outputCtx.putImageData(outputImageData, 0, 0);
    const dataUrl = outputCanvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
  }, [signatureColor]);

  // 刪除簽名
  const deleteSignature = useCallback(() => {
    setSignatureDataUrl(null);
  }, []);

  // 簽名尺寸對應的 CSS class
  const getSignatureSizeClass = () => {
    switch (signatureSize) {
      case 'small': return 'h-6';
      case 'large': return 'h-14';
      default: return 'h-10';
    }
  };

  // 頭像尺寸對應的 CSS 配置（含明確像素尺寸，避免 html2canvas 壓扁）
  const getAvatarSizeConfig = () => {
    switch (avatarSize) {
      case 'small': return { size: 'w-8 h-8', px: 32, text: 'text-sm', nameText: 'text-xs' };
      case 'large': return { size: 'w-16 h-16', px: 64, text: 'text-xl', nameText: 'text-base' };
      default: return { size: 'w-11 h-11', px: 44, text: 'text-lg', nameText: 'text-sm' }; // medium
    }
  };

  // 當簽名畫布彈窗打開時，初始化畫布
  useEffect(() => {
    if (showSignaturePad) {
      // 延遲一點確保 canvas 已經渲染
      setTimeout(initSignatureCanvas, 50);
    }
  }, [showSignaturePad, initSignatureCanvas]);

  // 圖片代理 API URL（Cloud Functions）
  const IMAGE_PROXY_URL = 'https://us-central1-grbt-f87fa.cloudfunctions.net/imageProxy';

  // 檢查是否為有效的圖片 URL（Firebase Storage 或其他圖片來源）
  const isValidImageUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    return (
      url.startsWith('https://') ||
      url.startsWith('http://')
    ) && (
      url.includes('firebasestorage.googleapis.com') ||
      url.includes('googleusercontent.com') ||
      url.includes('storage.googleapis.com') ||
      /\.(jpg|jpeg|png|gif|webp)/i.test(url)
    );
  };

  // 載入頭貼並轉成 base64（透過代理 API 繞過 CORS）
  useEffect(() => {
    if (!isValidImageUrl(userPhotoURL)) {
      console.log('[MarketDataCard] 無效的頭貼 URL，跳過載入');
      setAvatarBase64(null);
      setAvatarLoadError(true);
      return;
    }

    setAvatarLoadError(false);
    console.log('[MarketDataCard] 開始載入頭貼（透過代理）');

    const loadAvatarAsBase64 = async () => {
      // 嘗試多個 URL：高解析度優先，失敗回退原始 URL
      const urlsToTry: string[] = [];
      const originalUrl = userPhotoURL!;

      // Google 大頭貼預設 96px，嘗試請求 512px
      if (originalUrl.includes('googleusercontent.com') && /=s\d+-c/.test(originalUrl)) {
        urlsToTry.push(originalUrl.replace(/=s\d+-c/, '=s512-c'));
      }
      urlsToTry.push(originalUrl); // 原始 URL 作為 fallback

      for (const avatarUrl of urlsToTry) {
        try {
          const proxyUrl = `${IMAGE_PROXY_URL}?url=${encodeURIComponent(avatarUrl)}`;
          const response = await fetch(proxyUrl);

          if (!response.ok) {
            console.warn(`[Avatar] ${avatarUrl} 代理回應: ${response.status}，嘗試下一個`);
            continue;
          }

          const blob = await response.blob();
          if (blob.size < 100) {
            console.warn(`[Avatar] ${avatarUrl} 回應太小 (${blob.size}B)，嘗試下一個`);
            continue;
          }

          // 用 canvas 把頭像裁切成正方形並輸出高解析度 base64
          // 這樣 <img> 不需要 object-fit，html2canvas 一定能渲染
          const squareBase64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const size = 256; // 輸出 256x256，夠高解析度
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d')!;
              // 居中裁切成正方形
              const srcSize = Math.min(img.width, img.height);
              const sx = (img.width - srcSize) / 2;
              const sy = (img.height - srcSize) / 2;
              ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Image load failed'));
            // 從 blob 建立 object URL 載入
            img.src = URL.createObjectURL(blob);
          });

          setAvatarBase64(squareBase64);
          console.log(`[Avatar] 頭貼載入成功 (${avatarUrl === originalUrl ? '原始' : '高解析度'}, 256x256)`);
          return; // 成功就結束
        } catch (err) {
          console.warn(`[Avatar] ${avatarUrl} 載入失敗:`, err);
          continue;
        }
      }

      // 全部失敗
      console.error('[Avatar] 所有 URL 都載入失敗');
      setAvatarBase64(null);
      setAvatarLoadError(true);
    };

    loadAvatarAsBase64();
  }, [userPhotoURL]);

  // 預載入背景圖為 base64（解決 html2canvas 無法渲染外部 URL background-image 導致截圖變暗的問題）
  useEffect(() => {
    if (!displayBg?.imageUrl) {
      setBgBase64(null);
      return;
    }

    // 自訂背景已經是 data URL，不需要轉換
    if (displayBg.imageUrl.startsWith('data:')) {
      setBgBase64(displayBg.imageUrl);
      return;
    }

    setBgBase64(null); // 重置，等新圖載入

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // 限制解析度以控制記憶體（最大 1200px 寬）
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setBgBase64(dataUrl);
          console.log('[MarketDataCard] 背景圖 base64 轉換成功');
        }
      } catch (e) {
        console.warn('[MarketDataCard] 背景圖 base64 轉換失敗（CORS）:', e);
        setBgBase64(null);
      }
    };

    img.onerror = () => {
      console.warn('[MarketDataCard] 背景圖載入失敗');
      setBgBase64(null);
    };

    // 設定超時
    const timeout = setTimeout(() => {
      if (!bgBase64) setBgBase64(null);
    }, 8000);

    img.src = displayBg.imageUrl;

    return () => clearTimeout(timeout);
  }, [displayBg?.imageUrl]);

  // 載入今日市場報告（使用台灣時區日期）
  useEffect(() => {
    const now = new Date();
    const twDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = twDate.toISOString().split('T')[0];
    console.log('[MarketReport] 查詢日期:', today);
    const reportRef = doc(db, 'dailyMarketReports', today);

    const unsubscribe = onSnapshot(reportRef, (snap) => {
      if (snap.exists()) {
        setMarketReport(snap.data());
      } else {
        setMarketReport(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 載入使用者的累積分享天數
  useEffect(() => {
    if (!userId) {
      console.log('[loadShareData] 無 userId，跳過載入');
      return;
    }

    const loadShareData = async () => {
      try {
        const docRef = doc(db, 'users', userId, 'dailyStory', 'stats');
        const docSnap = await getDoc(docRef);
        const today = new Date().toISOString().split('T')[0];

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('[loadShareData] 載入成功:', {
            userId,
            totalShareDays: data.totalShareDays,
            lastShareDate: data.lastShareDate,
            today,
            isSameDay: data.lastShareDate === today
          });
          setTotalShareDays(data.totalShareDays || 0);
          // 檢查今天是否已分享
          if (data.lastShareDate === today) {
            setTodayShared(true);
            console.log('[loadShareData] 今天已分享過');
          } else {
            setTodayShared(false);
            console.log('[loadShareData] 今天還沒分享，lastShareDate:', data.lastShareDate, '!== today:', today);
          }
        } else {
          console.log('[loadShareData] 無資料，首次使用，userId:', userId);
          setTotalShareDays(0);
          setTodayShared(false);
        }
      } catch (error) {
        console.error('[loadShareData] 載入分享資料失敗:', error);
      }
    };

    loadShareData();
  }, [userId]);

  // 記錄分享並更新累積天數（每天有分享就 +1，一天只算一次）
  const recordShare = async () => {
    if (!userId) {
      console.log('[recordShare] 無 userId，跳過記錄');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    console.log('[recordShare] 開始記錄分享, userId:', userId, 'today:', today, 'todayShared:', todayShared);

    try {
      const docRef = doc(db, 'users', userId, 'dailyStory', 'stats');
      const docSnap = await getDoc(docRef);

      let newTotal = 1;
      let shareHistory: string[] = [];

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('[recordShare] 現有資料:', data);

        // 如果今天還沒分享，累積天數 +1
        if (data.lastShareDate !== today) {
          newTotal = (data.totalShareDays || 0) + 1;
          shareHistory = data.shareHistory || [];
          shareHistory.push(today);
          console.log('[recordShare] 今天首次分享，天數 +1 =', newTotal);
        } else {
          // 今天已經分享過，不增加天數
          newTotal = data.totalShareDays || 1;
          shareHistory = data.shareHistory || [];
          console.log('[recordShare] 今天已分享過，保持天數 =', newTotal);
        }
      } else {
        shareHistory = [today];
        console.log('[recordShare] 首次分享，初始化為 Day 1');
      }

      await setDoc(docRef, {
        totalShareDays: newTotal,
        lastShareDate: today,
        shareHistory: shareHistory.slice(-365), // 只保留最近 365 天
        updatedAt: Timestamp.now()
      });

      console.log('[recordShare] 寫入成功, newTotal:', newTotal);
      setTotalShareDays(newTotal);
      setTodayShared(true);
    } catch (error) {
      console.error('[recordShare] 記錄分享失敗:', error);
    }
  };

  // 生成並下載圖片
  const handleDownload = async () => {
    if (!storyRef.current) return;

    setIsGenerating(true);
    try {
      // 等待 DOM 更新
      await new Promise(resolve => setTimeout(resolve, 200));

      // 使用 html2canvas 截圖（最簡配置）
      const outputCanvas = await html2canvas(storyRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      console.log('[handleDownload] canvas:', outputCanvas.width, 'x', outputCanvas.height);

      // 檢測平台
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;

      if (isMobile) {
        // 手機：開新視窗顯示圖片，讓用戶長按存到相簿
        const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              <title>每日金句</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  background: #0f172a;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 20px;
                }
                .container {
                  width: 100%;
                  max-width: 400px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }
                img {
                  width: 100%;
                  border-radius: 16px;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .hint {
                  color: #94a3b8;
                  font-family: system-ui, -apple-system, sans-serif;
                  text-align: center;
                  margin-top: 24px;
                  font-size: 15px;
                  line-height: 1.6;
                }
                .hint strong {
                  color: #a78bfa;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <img src="${dataUrl}" alt="每日金句" />
                <p class="hint">
                  👆 <strong>長按圖片</strong> → 選擇「${isIOS ? '加入照片' : '儲存圖片'}」<br>
                  即可存到相簿
                </p>
              </div>
            </body>
            </html>
          `);
          newWindow.document.close();
        }
      } else {
        // 桌面平台：直接下載
        const link = document.createElement('a');
        link.download = `ultra-advisor-daily-${new Date().toISOString().split('T')[0]}.png`;
        link.href = outputCanvas.toDataURL('image/png', 1.0);
        link.click();
      }

      // 記錄分享
      await recordShare();
    } catch (error) {
      console.error('生成圖片失敗:', error);
      toast.error('生成圖片失敗，請稍後再試');
    } finally {
      setIsGenerating(false);
    }
  };

  // Web Share API 分享（優化支援 IG 限時動態）
  const handleShare = async () => {
    if (!storyRef.current) return;

    setIsGenerating(true);
    try {
      // 等待 DOM 更新
      await new Promise(resolve => setTimeout(resolve, 200));

      // 使用 html2canvas 截圖（最簡配置）
      const outputCanvas = await html2canvas(storyRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      console.log('[handleShare] canvas:', outputCanvas.width, 'x', outputCanvas.height);

      // 轉為 blob
      const blob = await new Promise<Blob>((resolve) => {
        outputCanvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
      });

      // 使用時間戳確保每次都是新檔案
      const timestamp = Date.now();
      const file = new File([blob], `daily-quote-${timestamp}.png`, { type: 'image/png' });

      // 先記錄分享
      console.log('[handleShare] 準備記錄分享...');
      await recordShare();
      console.log('[handleShare] 記錄分享完成');

      // 通用的 fallback 函數：開啟圖片頁面
      const openFallbackPage = () => {
        const dataUrl = outputCanvas.toDataURL('image/png');
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>分享到 IG 限時動態</title>
              <style>
                body { margin: 0; padding: 20px; background: #0f172a; display: flex; flex-direction: column; align-items: center; min-height: 100vh; font-family: system-ui; }
                img { max-width: 100%; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 20px; }
                .steps { color: #e2e8f0; text-align: left; padding: 20px; background: #1e293b; border-radius: 12px; max-width: 300px; }
                .steps h3 { color: #a855f7; margin-top: 0; }
                .steps ol { padding-left: 20px; line-height: 1.8; }
                .steps li { margin-bottom: 8px; }
                .highlight { color: #f59e0b; font-weight: bold; }
              </style>
            </head>
            <body>
              <img src="${dataUrl}" alt="每日金句" />
              <div class="steps">
                <h3>📱 分享到 IG 限時動態</h3>
                <ol>
                  <li><span class="highlight">長按圖片</span> → 儲存圖片</li>
                  <li>開啟 <span class="highlight">Instagram</span></li>
                  <li>點擊 <span class="highlight">+</span> → 限時動態</li>
                  <li>從相簿選擇此圖片</li>
                  <li>發布！🎉</li>
                </ol>
              </div>
            </body>
            </html>
          `);
          newWindow.document.close();
        } else {
          // 彈出視窗被封鎖，改用下載方式
          console.log('[handleShare] window.open 被封鎖，改用下載');
          const link = document.createElement('a');
          link.download = `daily-quote-${Date.now()}.png`;
          link.href = dataUrl;
          link.click();
        }
      };

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /CriOS|Chrome/.test(navigator.userAgent);
      const isIOSChrome = isIOS && isChrome;

      // iOS Chrome 的 Web Share API 有問題，直接使用 fallback
      if (isIOSChrome) {
        console.log('[handleShare] iOS Chrome 偵測到，使用 fallback');
        openFallbackPage();
      } else if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        // 檢查是否支援 Web Share API（含檔案分享）
        try {
          await navigator.share({
            files: [file],
            title: '每日金句',
            text: `「${displayQuoteText}」— Ultra Advisor 💼`,
          });
        } catch (shareError: any) {
          // 用戶取消分享不算錯誤
          if (shareError.name === 'AbortError') {
            console.log('[handleShare] 用戶取消分享');
          } else {
            console.error('[handleShare] Web Share 失敗，使用 fallback:', shareError);
            // Web Share 失敗時使用 fallback
            if (isIOS || /Android/.test(navigator.userAgent)) {
              openFallbackPage();
            } else {
              handleDownload();
            }
          }
        }
      } else {
        // 不支援 Web Share API，提供替代方案
        const isAndroid = /Android/.test(navigator.userAgent);

        if (isIOS || isAndroid) {
          openFallbackPage();
        } else {
          // 桌面：直接下載
          handleDownload();
        }
      }
    } catch (error: any) {
      console.error('[handleShare] 整體失敗:', error);
      // 出錯時嘗試下載
      handleDownload();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-6">
      {/* ===== 每日金句 / 市場快訊 區塊 ===== */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          {/* Tab 切換 */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
            <button
              onClick={() => setStoryMode('quote')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                storyMode === 'quote'
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Quote size={10} />
              金句
            </button>
            <button
              onClick={() => setStoryMode('market')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                storyMode === 'market'
                  ? 'bg-blue-500/30 text-blue-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 size={10} />
              市場
            </button>
          </div>
          {totalShareDays > 0 && (
            <span className="ml-auto text-[10px] text-purple-400 font-bold">
              累積分享 {totalShareDays} 天
            </span>
          )}
        </div>

        {/* 金句預覽卡片 */}
        {storyMode === 'quote' && (
        <div
          className="relative rounded-xl p-4 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform border border-white/10"
          onClick={() => setShowStoryPreview(true)}
        >
          {/* 風景背景（套用濾鏡） */}
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none"
            style={{
              backgroundImage: `url(${displayBg.imageUrl})`,
              filter: FILTER_STYLES[filterStyle].css
            }}
          />
          {/* 暗化遮罩 */}
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />

          {/* 內容 */}
          <div className="relative z-10 text-center">
            <Quote size={20} className="text-white/30 mx-auto mb-2" />
            <p
              className={`text-white font-bold text-sm leading-relaxed mb-2 line-clamp-3 ${FONT_STYLES[fontStyle].className}`}
              style={{ fontFamily: FONT_STYLES[fontStyle].fontFamily }}
            >
              {displayQuoteText}
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between mt-3 pt-3 border-t border-white/20">
            <div className="flex items-center gap-1 text-white/50 text-[10px]">
              <Calendar size={10} />
              {todayDate}
            </div>
            <div className="text-white/50 text-[10px]">
              點擊預覽 & 分享
            </div>
          </div>
        </div>
        )}

        {/* 市場快訊預覽卡片 */}
        {storyMode === 'market' && (
          <div
            className="relative rounded-xl p-4 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform border border-white/10 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900"
            onClick={() => { if (marketReport) setShowStoryPreview(true); }}
          >
            {marketReport ? (
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={14} className="text-blue-400" />
                  <span className="text-blue-400 text-[10px] font-bold">盤後快訊</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    marketReport.aiSummary?.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
                    marketReport.aiSummary?.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {marketReport.aiSummary?.sentiment === 'bullish' ? '偏多' :
                     marketReport.aiSummary?.sentiment === 'bearish' ? '偏空' : '中性'}
                  </span>
                </div>
                <p className="text-white font-bold text-sm mb-1">{marketReport.aiSummary?.headline}</p>
                <p className="text-white/60 text-[11px] line-clamp-2">{marketReport.aiSummary?.summary}</p>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10">
                  {marketReport.marketData?.twii && (
                    <span className={`text-[10px] font-bold ${marketReport.marketData.twii.change >= 0 ? 'text-green-400' : 'text-blue-400'}`}>
                      🇹🇼 {marketReport.marketData.twii.price?.toLocaleString()} ({marketReport.marketData.twii.change >= 0 ? '+' : ''}{marketReport.marketData.twii.changePercent}%)
                    </span>
                  )}
                  {marketReport.marketData?.sp500 && (
                    <span className={`text-[10px] font-bold ${marketReport.marketData.sp500.change >= 0 ? 'text-green-400' : 'text-blue-400'}`}>
                      🇺🇸 {marketReport.marketData.sp500.price?.toLocaleString()} ({marketReport.marketData.sp500.change >= 0 ? '+' : ''}{marketReport.marketData.sp500.changePercent}%)
                    </span>
                  )}
                </div>
                <div className="text-white/30 text-[9px] mt-2 text-right">點擊預覽 & 分享</div>
              </div>
            ) : (
              <div className="relative z-10 text-center py-4">
                <BarChart3 size={24} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">今日市場報告尚未產出</p>
                <p className="text-slate-600 text-[10px] mt-1">每日 14:30 台股收盤後自動更新</p>
              </div>
            )}
          </div>
        )}

        {/* 快速分享按鈕 */}
        <div className="flex gap-2 mt-3">
          {/* 如果有自訂，顯示重置按鈕 - 放最左邊 */}
          {(customQuote || customBg) && (
            <button
              onClick={handleResetToToday}
              className="flex items-center justify-center gap-1 py-2 px-2
                       bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold
                       rounded-lg transition-all"
              title="重置為今日預設"
            >
              <Calendar size={14} />
            </button>
          )}
          {/* 隨機換一組按鈕 */}
          <button
            onClick={handleShuffle}
            className="flex items-center justify-center gap-1 py-2 px-3
                     bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold
                     rounded-lg transition-all"
            title="隨機換一組文案和背景"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowStoryPreview(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3
                     bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold
                     rounded-lg transition-all"
          >
            <Edit3 size={14} />
            進入編輯
          </button>
          <button
            onClick={handleShare}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3
                     bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold
                     rounded-lg transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Share2 size={14} />
            )}
            分享社群
          </button>
        </div>
      </div>

      {/* ===== MindThread 社群助理入口 ===== */}
      <div className="mt-3">
        <a
          href="https://mindthread.tw"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all
            dark:bg-gradient-to-r dark:from-purple-900/30 dark:to-blue-900/30 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-500/30 hover:border-purple-400 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={16} className="text-purple-400" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-xs font-bold dark:text-white text-slate-800 block">
              MindThread 社群助理
            </span>
            <span className="text-[10px] text-slate-500">
              AI 自動生成 Threads 貼文
            </span>
          </div>
          <ExternalLink size={14} className="text-purple-400" />
        </a>
      </div>

      {/* ===== Ultra Alliance 戰術據點 ===== */}
      <div className="mt-3 pt-3 border-t dark:border-slate-800 border-slate-200">
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Handshake size={12} className="text-purple-400" />
            </div>
            <span className="text-[11px] font-bold dark:text-white text-slate-800">Ultra Alliance</span>
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-bold rounded">
              {nearbyPartners.length > 0 ? `${nearbyPartners.filter(p => p.isUltraPartner).length} 間合作` : 'NEW'}
            </span>
          </div>
          <a
            href="/alliance"
            className="text-[9px] text-purple-400 hover:text-purple-300 transition-colors"
          >
            了解更多 →
          </a>
        </div>

        {/* 店家列表 */}
        {(() => {
          const displayPartners = userLocation && nearbyPartners.length > 0
            ? nearbyPartners.slice(0, 2)
            : MOCK_PARTNERS
                .sort((a, b) => {
                  if (a.isUltraPartner && !b.isUltraPartner) return -1;
                  if (!a.isUltraPartner && b.isUltraPartner) return 1;
                  return b.rating - a.rating;
                })
                .slice(0, 2)
                .map(p => ({ ...p, distance: 0 }));

          return (
            <div className="space-y-1.5">
              {displayPartners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex items-center gap-2 p-2 rounded-lg dark:bg-slate-800/30 bg-slate-50
                           border dark:border-slate-700/50 border-slate-200 hover:border-purple-500/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative">
                    <img src={partner.image} alt={partner.name} className="w-full h-full object-cover" />
                    {partner.isUltraPartner && (
                      <div className="absolute top-0 right-0 w-4 h-4 bg-purple-500 rounded-bl-lg flex items-center justify-center">
                        <Check size={8} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold dark:text-white text-slate-800 truncate block">{partner.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {userLocation && partner.distance > 0 && (
                        <span className="text-[8px] text-slate-500 flex items-center gap-0.5">
                          <Navigation size={7} /> {formatDistance(partner.distance)}
                        </span>
                      )}
                      {partner.isUltraPartner ? (
                        <span className="text-[8px] text-purple-400 bg-purple-500/20 px-1 py-0.5 rounded">{partner.offer.title}</span>
                      ) : (
                        <span className="text-[8px] text-amber-400">★ {partner.rating}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {partner.features.quiet && <Volume2 size={10} className="text-slate-500" />}
                    {partner.features.power && <Zap size={10} className="text-amber-500" />}
                    {partner.features.parking && <ParkingCircle size={10} className="text-blue-500" />}
                  </div>
                </div>
              ))}
              <button
                onClick={requestLocation}
                disabled={isLocating}
                className="w-full flex items-center justify-center gap-1 py-1 text-[8px]
                         text-slate-500 hover:text-purple-400 transition-colors disabled:opacity-50"
              >
                {isLocating ? <><Loader2 size={9} className="animate-spin" /> 定位中...</>
                  : userLocation ? <><RefreshCw size={9} /> 重新定位</>
                  : <><MapPin size={9} /> 開啟定位查看距離</>}
              </button>
            </div>
          );
        })()}
      </div>

      {/* ===== 限時動態預覽彈窗 ===== */}
      {showStoryPreview && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          {/* 關閉按鈕 - 固定在畫面右上角 */}
          <button
            onClick={() => setShowStoryPreview(false)}
            className="absolute top-4 right-4 z-[110] w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full
                       flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <X size={24} />
          </button>

          <div className="relative max-w-sm w-full">

            {/* 限時動態預覽（這個會被截圖） */}
            <div
              ref={storyRef}
              className={`aspect-[9/16] rounded-3xl overflow-hidden ${
                storyMode === 'market'
                  ? 'bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]'
                  : `bg-gradient-to-br ${displayBg.fallbackGradient}`
              } flex flex-col items-center justify-center p-8 relative`}
            >
              {/* ========== 市場快訊模板 ========== */}
              {storyMode === 'market' && marketReport && (
                <>
                  {/* 深色科技感背景 */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(59,130,246,0.08) 0%, transparent 50%)' }} />

                  {/* 頂部標題 */}
                  <div className="absolute top-6 left-6 right-6 z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-blue-400 text-xs font-bold tracking-wider">盤後快訊</span>
                      </div>
                      <span className="text-white/40 text-[10px]">{marketReport.date}</span>
                    </div>
                  </div>

                  {/* AI 標題 */}
                  <div className="absolute top-16 left-6 right-6 z-10">
                    <p className="text-white font-black text-xl leading-tight mb-2">
                      {marketReport.aiSummary?.headline}
                    </p>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      marketReport.aiSummary?.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
                      marketReport.aiSummary?.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {marketReport.aiSummary?.sentiment === 'bullish' ? '📈 偏多' :
                       marketReport.aiSummary?.sentiment === 'bearish' ? '📉 偏空' : '➡️ 中性'}
                    </div>
                  </div>

                  {/* 指數數據卡片 */}
                  <div className="absolute top-[120px] left-5 right-5 z-10 space-y-1.5">
                    {[
                      { key: 'twii', flag: '🇹🇼', label: '加權指數' },
                      { key: 'sp500', flag: '🇺🇸', label: 'S&P 500' },
                      { key: 'nasdaq', flag: '🇺🇸', label: 'NASDAQ' },
                      { key: 'dji', flag: '🇺🇸', label: '道瓊' },
                      { key: 'usdtwd', flag: '💱', label: 'USD/TWD' },
                      { key: 'us10y', flag: '📊', label: '美 10Y 殖利率' },
                    ].map(({ key, flag, label }) => {
                      const d = marketReport.marketData?.[key];
                      if (!d) return null;
                      const isUp = d.change >= 0;
                      return (
                        <div key={key} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-1.5 border border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{flag}</span>
                            <span className="text-white/70 text-[11px] font-medium">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-sm">{
                              key === 'usdtwd' || key === 'us10y'
                                ? d.price?.toFixed(2)
                                : d.price?.toLocaleString(undefined, { maximumFractionDigits: 0 })
                            }</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isUp ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {isUp ? '▲' : '▼'} {Math.abs(d.changePercent)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI 摘要 */}
                  <div className="absolute bottom-24 left-5 right-5 z-10">
                    <div className="bg-white/[0.04] rounded-lg px-3 py-2.5 border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={10} className="text-blue-400" />
                        <span className="text-blue-400 text-[9px] font-bold">AI 觀點</span>
                      </div>
                      <p className="text-white/80 text-[11px] leading-relaxed line-clamp-3">
                        {marketReport.aiSummary?.outlook}
                      </p>
                    </div>
                  </div>

                  {/* 底部：顧問資訊 + 品牌 */}
                  <div className="absolute bottom-6 left-5 z-10 flex items-center gap-2">
                    <div
                      className="rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        width: getAvatarSizeConfig().px,
                        height: getAvatarSizeConfig().px,
                        minWidth: getAvatarSizeConfig().px,
                        minHeight: getAvatarSizeConfig().px,
                        borderRadius: '50%',
                        background: (!avatarBase64 && !isValidImageUrl(userPhotoURL)) ? 'linear-gradient(135deg, #a855f7, #3b82f6)' : undefined,
                      }}
                    >
                      {avatarBase64 ? (
                        <img src={avatarBase64} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                      ) : !isValidImageUrl(userPhotoURL) ? (
                        <span className={`text-white font-bold ${getAvatarSizeConfig().text}`}>
                          {(userDisplayName || '顧')[0]}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-white font-bold ${getAvatarSizeConfig().nameText}`}
                        style={{ fontFamily: NAME_FONT_STYLES[nameFontStyle].fontFamily }}>
                        {userDisplayName || '財務顧問'}
                      </span>
                      <span className="text-white/40 text-[9px]">{todayDate}</span>
                    </div>
                  </div>
                  <div className="absolute bottom-6 right-5 z-10"
                    style={{ lineHeight: '16px' }}>
                    <img src="/logo.png" alt="Ultra Advisor"
                      style={{ width: 14, height: 14, verticalAlign: 'middle', display: 'inline-block', marginRight: 4 }} />
                    <span style={{ fontSize: 10, fontWeight: 'bold', verticalAlign: 'middle' }}>
                      <span style={{ color: '#ef4444' }}>Ultra</span>
                      <span style={{ color: '#60a5fa' }}> Advisor</span>
                    </span>
                  </div>
                </>
              )}

              {/* ========== 金句模式（原有內容） ========== */}
              {storyMode === 'quote' && (
              <>
              {/* 風景背景（使用 base64 確保 html2canvas 能正確渲染，避免截圖變暗） */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${bgBase64 || displayBg.imageUrl})`,
                  filter: FILTER_STYLES[filterStyle].css
                }}
              />
              {/* 暗化遮罩 */}
              <div className="absolute inset-0 bg-black/50" />

              {/* ========== 置中排版 ========== */}
              {layoutStyle === 'center' && (
                <>
                  {/* 累積天數徽章 */}
                  <div className="absolute top-6 right-6 z-10">
                    <span className="text-white text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                      Day {totalShareDays + (todayShared ? 0 : 1)}
                    </span>
                  </div>

                  {/* 金句內容 - 置中 */}
                  <div className="relative z-10 text-center max-w-[280px] px-4">
                    <Quote size={36} className="text-white/30 mx-auto mb-4" />
                    <p
                      className={`text-white font-black leading-relaxed drop-shadow-lg ${FONT_STYLES[fontStyle].className}`}
                      style={{
                        fontFamily: FONT_STYLES[fontStyle].fontFamily,
                        fontSize: `${18 * quoteFontSize / 100}px`,
                      }}
                    >
                      {formatQuoteWithLineBreaks(displayQuoteText)}
                    </p>
                  </div>

                  {/* 底部左側：顧問頭貼 + 名字 + 日期（獨立定位避免 flexbox justify-between 問題） */}
                  <div className="absolute bottom-6 left-5 z-10 flex items-center gap-2">
                    <div
                      className="rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        width: getAvatarSizeConfig().px,
                        height: getAvatarSizeConfig().px,
                        minWidth: getAvatarSizeConfig().px,
                        minHeight: getAvatarSizeConfig().px,
                        borderRadius: '50%',
                        background: (!avatarBase64 && !isValidImageUrl(userPhotoURL)) ? 'linear-gradient(135deg, #a855f7, #3b82f6)' : undefined,
                      }}
                    >
                      {avatarBase64 ? (
                        <img src={avatarBase64} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                      ) : !isValidImageUrl(userPhotoURL) ? (
                        <span className={`text-white font-bold ${getAvatarSizeConfig().text}`}>
                          {(userDisplayName || '顧')[0]}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`text-white font-bold ${getAvatarSizeConfig().nameText}`}
                        style={{ fontFamily: NAME_FONT_STYLES[nameFontStyle].fontFamily }}
                      >
                        {userDisplayName || '財務顧問'}
                      </span>
                      <span className="text-white/50 text-[10px]">
                        {todayDate}
                      </span>
                    </div>
                  </div>

                  {/* 底部右側：品牌浮水印（與左側頭像區垂直置中對齊） */}
                  <div className="absolute right-5 z-10"
                    style={{ bottom: 24, height: getAvatarSizeConfig().px, lineHeight: `${getAvatarSizeConfig().px}px` }}>
                    <img
                      src="/logo.png"
                      alt="Ultra Advisor"
                      style={{ width: 14, height: 14, verticalAlign: 'middle', display: 'inline-block', marginRight: 4 }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 'bold', verticalAlign: 'middle', lineHeight: `${getAvatarSizeConfig().px}px` }}>
                      <span style={{ color: '#ef4444' }}>Ultra</span>
                      <span style={{ color: '#60a5fa' }}> Advisor</span>
                    </span>
                  </div>

                  {/* 簽名（置中下方，品牌上方） */}
                  {signatureDataUrl && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
                      <img
                        src={signatureDataUrl}
                        alt="簽名"
                        className={`${getSignatureSizeClass()} object-contain drop-shadow-lg`}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ========== IG 風格左對齊排版 ========== */}
              {layoutStyle === 'left' && (
                <>
                  {/* 累積天數徽章 */}
                  <div className="absolute top-6 right-6 z-10">
                    <span className="text-white text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                      Day {totalShareDays + (todayShared ? 0 : 1)}
                    </span>
                  </div>

                  {/* 黃色大標題 */}
                  <div
                    className="absolute z-10"
                    style={{ left: igTitlePos.x, top: igTitlePos.y, maxWidth: 280 }}
                  >
                    <h2
                      className={`text-amber-400 font-black leading-tight drop-shadow-lg ${FONT_STYLES[fontStyle].className}`}
                      style={{
                        fontFamily: FONT_STYLES[fontStyle].fontFamily,
                        fontSize: `${20 * quoteFontSize / 100}px`,
                      }}
                    >
                      「{displayIGQuote.title}」
                    </h2>
                  </div>

                  {/* 白色內文 */}
                  <div
                    className="absolute z-10"
                    style={{ left: igContentPos.x, top: igContentPos.y, maxWidth: 280 }}
                  >
                    <div className="border-l-2 border-white/40 pl-4 space-y-2">
                      {displayIGQuote.lines.map((line, i) => (
                        <p
                          key={i}
                          className={`text-white leading-relaxed drop-shadow-md ${FONT_STYLES[fontStyle].className}`}
                          style={{
                            fontFamily: FONT_STYLES[fontStyle].fontFamily,
                            fontSize: `${14 * quoteFontSize / 100}px`,
                          }}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* 底部左側：顧問頭貼 + 名字（獨立定位） */}
                  <div className="absolute bottom-6 left-4 z-10 flex items-center gap-2">
                    <div
                      className="rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        width: getAvatarSizeConfig().px,
                        height: getAvatarSizeConfig().px,
                        minWidth: getAvatarSizeConfig().px,
                        minHeight: getAvatarSizeConfig().px,
                        borderRadius: '50%',
                        background: (!avatarBase64 && !isValidImageUrl(userPhotoURL)) ? 'linear-gradient(135deg, #a855f7, #3b82f6)' : undefined,
                      }}
                    >
                      {avatarBase64 ? (
                        <img src={avatarBase64} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                      ) : !isValidImageUrl(userPhotoURL) ? (
                        <span className={`text-white font-bold ${getAvatarSizeConfig().text}`}>
                          {(userDisplayName || '顧')[0]}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`text-white font-bold ${getAvatarSizeConfig().nameText}`}
                        style={{ fontFamily: NAME_FONT_STYLES[nameFontStyle].fontFamily }}
                      >
                        {userDisplayName || '財務顧問'}
                      </span>
                      <span className="text-white/50 text-[10px]">
                        ultra-advisor.tw
                      </span>
                    </div>
                  </div>

                  {/* 底部右側：品牌浮水印（與左側頭像區垂直置中對齊） */}
                  <div className="absolute right-4 z-10"
                    style={{ bottom: 24, height: getAvatarSizeConfig().px, lineHeight: `${getAvatarSizeConfig().px}px` }}>
                    <img
                      src="/logo.png"
                      alt="Ultra Advisor"
                      style={{ width: 14, height: 14, verticalAlign: 'middle', display: 'inline-block', marginRight: 4 }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 'bold', verticalAlign: 'middle', lineHeight: `${getAvatarSizeConfig().px}px` }}>
                      <span style={{ color: '#ef4444' }}>Ultra</span>
                      <span style={{ color: '#60a5fa' }}> Advisor</span>
                    </span>
                  </div>

                  {/* 簽名（底部資訊上方） */}
                  {signatureDataUrl && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
                      <img
                        src={signatureDataUrl}
                        alt="簽名"
                        className={`${getSignatureSizeClass()} object-contain drop-shadow-lg`}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ========== 雜誌風格排版 ========== */}
              {layoutStyle === 'magazine' && (
                <>
                  {/* 累積天數徽章 */}
                  <div className="absolute top-6 right-6 z-10">
                    <span className="text-white text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                      Day {totalShareDays + (todayShared ? 0 : 1)}
                    </span>
                  </div>

                  {/* 頂部大標題區 */}
                  <div
                    className="absolute z-10"
                    style={{ left: magazineTitlePos.x, top: magazineTitlePos.y, maxWidth: 280 }}
                  >
                    <div className="px-2">
                      <h1
                        className={`text-white font-black leading-tight drop-shadow-lg ${FONT_STYLES[fontStyle].className}`}
                        style={{
                          fontFamily: FONT_STYLES[fontStyle].fontFamily,
                          fontSize: `${20 * quoteFontSize / 100}px`,
                        }}
                      >
                        {displayIGQuote.title}
                      </h1>
                      <div className="w-12 h-1 bg-amber-400 mt-3" />
                    </div>
                  </div>

                  {/* 中間內容區 */}
                  <div
                    className="absolute z-10"
                    style={{ left: magazineContentPos.x, top: magazineContentPos.y, maxWidth: 280 }}
                  >
                    <div className="px-2 space-y-2">
                      {displayIGQuote.lines.map((line, i) => (
                        <p
                          key={i}
                          className={`text-white/90 leading-relaxed drop-shadow-md ${FONT_STYLES[fontStyle].className}`}
                          style={{
                            fontFamily: FONT_STYLES[fontStyle].fontFamily,
                            fontSize: `${14 * quoteFontSize / 100}px`,
                          }}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* 左側：顧問資訊 */}
                  <div className="absolute bottom-5 left-4 z-10">
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-white/30"
                        style={{
                          width: getAvatarSizeConfig().px,
                          height: getAvatarSizeConfig().px,
                          minWidth: getAvatarSizeConfig().px,
                          minHeight: getAvatarSizeConfig().px,
                          borderRadius: '50%',
                          background: (!avatarBase64 && !isValidImageUrl(userPhotoURL)) ? 'linear-gradient(135deg, #a855f7, #3b82f6)' : undefined,
                        }}
                      >
                        {avatarBase64 ? (
                          <img src={avatarBase64} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                        ) : !isValidImageUrl(userPhotoURL) ? (
                          <span className={`text-white font-bold ${getAvatarSizeConfig().text}`}>
                            {(userDisplayName || '顧')[0]}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`text-white font-bold ${getAvatarSizeConfig().nameText} whitespace-nowrap`}
                          style={{ fontFamily: NAME_FONT_STYLES[nameFontStyle].fontFamily }}
                        >
                          {userDisplayName || '財務顧問'}
                        </span>
                        <span className="text-white/60 text-[10px] whitespace-nowrap">
                          {todayDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 中間：品牌浮水印 */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                    <div style={{ lineHeight: '16px', whiteSpace: 'nowrap' }}>
                      <img
                        src="/logo.png"
                        alt="Ultra Advisor"
                        style={{ width: 14, height: 14, verticalAlign: 'middle', display: 'inline-block', marginRight: 4 }}
                      />
                      <span style={{ fontSize: 10, fontWeight: 'bold', verticalAlign: 'middle' }}>
                        <span style={{ color: '#ef4444' }}>Ultra</span>
                        <span style={{ color: '#60a5fa' }}> Advisor</span>
                      </span>
                    </div>
                  </div>

                  {/* 簽名（品牌浮水印上方） */}
                  {signatureDataUrl && (
                    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10">
                      <img
                        src={signatureDataUrl}
                        alt="簽名"
                        className={`${getSignatureSizeClass()} object-contain drop-shadow-lg`}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ========== 卡片風格排版 ========== */}
              {layoutStyle === 'card' && (
                <>
                  {/* 累積天數徽章 */}
                  <div className="absolute top-6 right-6 z-10">
                    <span className="text-white text-xs font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                      Day {totalShareDays + (todayShared ? 0 : 1)}
                    </span>
                  </div>

                  {/* 中央卡片區域 - 垂直置中 */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center px-5">
                    {/* 主內容卡片 - 包含所有資訊 */}
                    <div className="w-full bg-white/10 border border-white/20 rounded-2xl p-5">
                      {/* 引號裝飾 */}
                      <div className="text-amber-400 text-4xl font-serif leading-none mb-3">"</div>

                      {/* 金句內容 */}
                      <p
                        className={`text-white font-bold leading-relaxed mb-4 ${FONT_STYLES[fontStyle].className}`}
                        style={{
                          fontFamily: FONT_STYLES[fontStyle].fontFamily,
                          fontSize: `${(displayQuoteText.length > 50 ? 16 : 18) * quoteFontSize / 100}px`,
                        }}
                      >
                        {formatQuoteWithLineBreaks(displayQuoteText)}
                      </p>

                      {/* 簽名（卡片內） */}
                      {signatureDataUrl && (
                        <div className="flex justify-center mb-3">
                          <img
                            src={signatureDataUrl}
                            alt="簽名"
                            className={`${getSignatureSizeClass()} object-contain`}
                          />
                        </div>
                      )}

                      {/* 分隔線 */}
                      <div className="w-full h-px bg-white/20 my-4" />

                      {/* 底部資訊（用 relative + 兩個 absolute 避免 justify-between 問題） */}
                      <div className="relative w-full h-10">
                        {/* 左側：顧問資訊 */}
                        <div className="absolute left-0 top-0 flex items-center gap-2">
                          <div
                            className="rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                            style={{
                              width: getAvatarSizeConfig().px,
                              height: getAvatarSizeConfig().px,
                              minWidth: getAvatarSizeConfig().px,
                              minHeight: getAvatarSizeConfig().px,
                              borderRadius: '50%',
                              background: (!avatarBase64 && !isValidImageUrl(userPhotoURL)) ? 'linear-gradient(135deg, #a855f7, #3b82f6)' : undefined,
                            }}
                          >
                            {avatarBase64 ? (
                              <img src={avatarBase64} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                            ) : !isValidImageUrl(userPhotoURL) ? (
                              <span className={`text-white font-bold ${getAvatarSizeConfig().text}`}>
                                {(userDisplayName || '顧')[0]}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-white font-bold ${getAvatarSizeConfig().nameText}`}
                              style={{ fontFamily: NAME_FONT_STYLES[nameFontStyle].fontFamily }}
                            >
                              {userDisplayName || '財務顧問'}
                            </span>
                            <span className="text-white/50 text-[9px]">
                              {todayDate}
                            </span>
                          </div>
                        </div>

                        {/* 右側：品牌浮水印 */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2"
                          style={{ lineHeight: '16px' }}>
                          <img
                            src="/logo.png"
                            alt="Ultra Advisor"
                            style={{ width: 14, height: 14, verticalAlign: 'middle', display: 'inline-block', marginRight: 4 }}
                          />
                          <span style={{ fontSize: 10, fontWeight: 'bold', verticalAlign: 'middle' }}>
                            <span style={{ color: '#ef4444' }}>Ultra</span>
                            <span style={{ color: '#60a5fa' }}> Advisor</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              </>
              )}
            </div>

            {/* 隨機切換 & 進階設定按鈕 */}
            <div className="flex gap-2 mt-4">
              {/* 回到今日按鈕 - 放最左邊 */}
              {(customQuote || customBg || selectedCustomBgIndex !== null) && (
                <button
                  onClick={handleResetToToday}
                  className="flex items-center justify-center gap-2 py-2.5 px-3
                           bg-slate-800 text-white font-bold rounded-xl
                           hover:bg-slate-700 transition-all"
                  title="重置為今日預設"
                >
                  <Calendar size={16} />
                </button>
              )}
              <button
                onClick={handleShuffle}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                         bg-amber-500 text-white font-bold rounded-xl
                         hover:bg-amber-400 transition-all"
              >
                <RefreshCw size={16} />
                隨機換一組
              </button>
              <button
                onClick={() => setShowAdvancedSettings(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-4
                         bg-slate-700 text-white font-bold rounded-xl
                         hover:bg-slate-600 transition-all"
              >
                <Settings size={16} />
                進階設定
              </button>
            </div>

            {/* 分享按鈕 */}
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleShare}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 py-3
                         bg-purple-600 text-white font-bold rounded-xl
                         hover:bg-purple-500 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Share2 size={18} />
                )}
                分享社群
              </button>
            </div>

            {/* 提示文字 */}
            <p className="text-center text-white/50 text-xs mt-3">
              下載後可分享到 LINE、IG、FB 限時動態
            </p>

            {/* ========== 進階設定底部抽屜 ========== */}
            {showAdvancedSettings && (
              <div className="fixed inset-0 z-[120] flex items-end justify-center pointer-events-none">
                {/* 背景遮罩 - 只遮下半部 */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-auto"
                  onClick={() => setShowAdvancedSettings(false)}
                />
                {/* 設定面板 - 限制最大高度為 50% */}
                <div className="relative w-full max-w-md bg-slate-900/95 border-t border-slate-700
                                rounded-t-3xl p-5 max-h-[50vh] overflow-y-auto animate-slide-up pointer-events-auto">
                  {/* 頂部拖曳指示條 */}
                  <div className="flex justify-center mb-3">
                    <div className="w-10 h-1 bg-slate-600 rounded-full" />
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-bold text-base flex items-center gap-2">
                      <Settings size={16} /> 進階設定
                    </h4>
                    <button
                      onClick={() => setShowAdvancedSettings(false)}
                      className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center"
                    >
                      <X size={16} className="text-slate-400" />
                    </button>
                  </div>

                  {/* 排版風格 */}
                  <div className="mb-4">
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <Layout size={12} /> 排版風格
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={() => setLayoutStyle('center')}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all
                                   ${layoutStyle === 'center'
                                     ? 'bg-purple-600 text-white'
                                     : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        置中
                      </button>
                      <button
                        onClick={() => setLayoutStyle('left')}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all
                                   ${layoutStyle === 'left'
                                     ? 'bg-purple-600 text-white'
                                     : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        IG
                      </button>
                      <button
                        onClick={() => setLayoutStyle('magazine')}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all
                                   ${layoutStyle === 'magazine'
                                     ? 'bg-purple-600 text-white'
                                     : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        雜誌
                      </button>
                      <button
                        onClick={() => setLayoutStyle('card')}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all
                                   ${layoutStyle === 'card'
                                     ? 'bg-purple-600 text-white'
                                     : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        卡片
                      </button>
                    </div>

                    {/* IG/雜誌風格：編輯位置按鈕 + 重置按鈕 */}
                    {/* 字體大小調整滑桿 */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 text-[10px] font-bold">字體大小</span>
                        <span className="text-purple-400 text-[10px] font-bold">{quoteFontSize}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQuoteFontSize(Math.max(60, quoteFontSize - 10))}
                          className="w-7 h-7 rounded-lg bg-slate-700 text-white text-sm font-bold hover:bg-slate-600 transition-all"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="60"
                          max="150"
                          step="5"
                          value={quoteFontSize}
                          onChange={(e) => setQuoteFontSize(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                        />
                        <button
                          onClick={() => setQuoteFontSize(Math.min(150, quoteFontSize + 10))}
                          className="w-7 h-7 rounded-lg bg-slate-700 text-white text-sm font-bold hover:bg-slate-600 transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 文案設定 - 根據排版風格顯示不同編輯區 */}
                  <div className="mb-4">
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <Type size={12} /> 文案設定
                    </label>

                    {/* 置中/卡片排版：單一文案框 */}
                    {(layoutStyle === 'center' || layoutStyle === 'card') && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          <button
                            onClick={() => setUseCustomText(false)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                                       ${!useCustomText
                                         ? 'bg-purple-600 text-white'
                                         : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          >
                            使用金句庫
                          </button>
                          <button
                            onClick={() => setUseCustomText(true)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                                       ${useCustomText
                                         ? 'bg-purple-600 text-white'
                                         : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          >
                            自訂文案
                          </button>
                        </div>
                        {useCustomText && (
                          <textarea
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="輸入你的金句..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2
                                       text-white text-xs resize-none h-16 focus:outline-none focus:border-purple-500"
                            maxLength={120}
                          />
                        )}
                      </>
                    )}

                    {/* IG 風格 & 雜誌風格：標題 + 分段內文 */}
                    {(layoutStyle === 'left' || layoutStyle === 'magazine') && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          <button
                            onClick={() => setUseCustomIGText(false)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                                       ${!useCustomIGText
                                         ? 'bg-purple-600 text-white'
                                         : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          >
                            使用文案庫
                          </button>
                          <button
                            onClick={() => setUseCustomIGText(true)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                                       ${useCustomIGText
                                         ? 'bg-purple-600 text-white'
                                         : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          >
                            自訂文案
                          </button>
                        </div>
                        {useCustomIGText && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-slate-500 text-[9px] mb-1 block">標題</label>
                              <input
                                type="text"
                                value={customIGTitle}
                                onChange={(e) => setCustomIGTitle(e.target.value)}
                                placeholder="例：你的人生，其實一直在用最低標準過日子"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2
                                           text-amber-400 text-xs focus:outline-none focus:border-purple-500"
                                maxLength={40}
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[9px] mb-1 block">內文（每行一段）</label>
                              <textarea
                                value={customIGLines}
                                onChange={(e) => setCustomIGLines(e.target.value)}
                                placeholder={"你有沒有發現\n你的人生\n好像一直都在..."}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2
                                           text-white text-xs resize-none h-16 focus:outline-none focus:border-purple-500"
                              />
                            </div>
                          </div>
                        )}
                        {!useCustomIGText && (
                          <div className="bg-slate-800/50 rounded-lg p-2 text-[10px] text-slate-400">
                            <div className="text-amber-400 font-bold mb-0.5 truncate">「{displayIGQuote.title}」</div>
                            <div className="text-slate-300 truncate">{displayIGQuote.lines[0]}...</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 字體選擇 */}
                  <div className="mb-4">
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <Type size={12} /> 金句字體
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(Object.entries(FONT_STYLES) as [FontStyle, typeof FONT_STYLES[FontStyle]][]).map(([key, style]) => (
                        <button
                          key={key}
                          onClick={() => setFontStyle(key)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                                     ${fontStyle === key
                                       ? 'bg-purple-600 text-white'
                                       : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}
                                     ${style.className}`}
                          style={{ fontFamily: style.fontFamily }}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 顧問名字字體 */}
                  <div className="mb-4">
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <PenTool size={12} /> 顧問名字字體
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(Object.entries(NAME_FONT_STYLES) as [NameFontStyle, typeof NAME_FONT_STYLES[NameFontStyle]][]).map(([key, style]) => (
                        <button
                          key={key}
                          onClick={() => setNameFontStyle(key)}
                          className={`py-2 rounded-lg text-sm transition-all
                                     ${nameFontStyle === key
                                       ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                       : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                          style={{ fontFamily: style.fontFamily }}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                    {/* 預覽 */}
                    <div className="mt-2 bg-slate-800/50 rounded-lg p-3 text-center">
                      <span
                        className="text-white text-lg"
                        style={{ fontFamily: NAME_FONT_STYLES[nameFontStyle].fontFamily }}
                      >
                        {userDisplayName || '財務顧問'}
                      </span>
                      <p className="text-slate-500 text-[9px] mt-1">預覽效果</p>
                    </div>
                  </div>

                  {/* 自訂背景 */}
                  <div>
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <ImageIcon size={12} /> 自訂背景 ({customBackgrounds.length}/7)
                    </label>

                    {/* 上傳按鈕 */}
                    <button
                      onClick={() => bgInputRef.current?.click()}
                      disabled={customBackgrounds.length >= 7 || isUploadingBg}
                      className="w-full border border-dashed border-slate-600 rounded-lg p-2.5
                                 text-slate-400 text-xs hover:border-purple-500 hover:text-purple-400
                                 transition-all mb-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUploadingBg ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Plus size={14} />
                      )}
                      上傳照片
                    </button>
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBgUpload}
                      className="hidden"
                    />

                    {/* 背景預覽格 */}
                    {customBackgrounds.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {customBackgrounds.map((bg, index) => (
                          <div
                            key={bg.id}
                            className={`relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer
                                       border-2 transition-all ${selectedCustomBgIndex === index
                                         ? 'border-purple-500 scale-105'
                                         : 'border-transparent hover:border-slate-500'}`}
                            onClick={() => setSelectedCustomBgIndex(index)}
                          >
                            <img
                              src={bg.dataUrl}
                              className="w-full h-full object-cover"
                              style={{ filter: FILTER_STYLES[filterStyle].css }}
                              alt={`背景 ${index + 1}`}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteBg(index); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full
                                         flex items-center justify-center hover:bg-red-400"
                            >
                              <Trash2 size={10} className="text-white" />
                            </button>
                            {selectedCustomBgIndex === index && (
                              <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                <Check size={16} className="text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 使用預設背景按鈕 */}
                    {selectedCustomBgIndex !== null && (
                      <button
                        onClick={() => setSelectedCustomBgIndex(null)}
                        className="w-full py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold
                                   hover:bg-slate-700 transition-all"
                      >
                        改用預設背景庫
                      </button>
                    )}
                  </div>

                  {/* 濾鏡選擇 */}
                  <div>
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <Sparkles size={12} /> 背景濾鏡
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(Object.keys(FILTER_STYLES) as FilterStyle[]).map((key) => (
                        <button
                          key={key}
                          onClick={() => setFilterStyle(key)}
                          className={`py-2 px-1 rounded-lg text-center transition-all ${
                            filterStyle === key
                              ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <div className="text-base mb-0.5">{FILTER_STYLES[key].preview}</div>
                          <div className="text-[9px] font-bold">{FILTER_STYLES[key].name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 頭像大小設定 */}
                  <div className="mt-4">
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <User size={12} /> 頭像大小
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setAvatarSize(size)}
                          className={`py-2.5 rounded-lg text-center transition-all ${
                            avatarSize === size
                              ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <div className="text-[10px] font-bold">
                            {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 手寫簽名 */}
                  <div className="mt-4">
                    <label className="text-slate-400 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <PenTool size={12} /> 手寫簽名
                    </label>

                    {/* 已有簽名：顯示預覽 */}
                    {signatureDataUrl ? (
                      <div className="space-y-2">
                        <div className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-center">
                          <img
                            src={signatureDataUrl}
                            alt="簽名預覽"
                            className={`${getSignatureSizeClass()} object-contain`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setShowSignaturePad(true)}
                            className="py-2 rounded-lg text-[10px] font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all flex items-center justify-center gap-1"
                          >
                            <Edit3 size={12} /> 重新簽名
                          </button>
                          <button
                            onClick={deleteSignature}
                            className="py-2 rounded-lg text-[10px] font-bold bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all flex items-center justify-center gap-1"
                          >
                            <Trash2 size={12} /> 刪除簽名
                          </button>
                        </div>
                        {/* 簽名顏色選擇 */}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[9px]">簽名顏色：</span>
                          {['#FFFFFF', '#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7'].map((color) => (
                            <button
                              key={color}
                              onClick={() => setSignatureColor(color)}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${
                                signatureColor === color ? 'border-purple-500 scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        {/* 簽名尺寸選擇 */}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[9px]">簽名大小：</span>
                          <div className="grid grid-cols-3 gap-1 flex-1">
                            {(['small', 'medium', 'large'] as const).map((size) => (
                              <button
                                key={size}
                                onClick={() => setSignatureSize(size)}
                                className={`py-1 rounded text-[9px] font-bold transition-all ${
                                  signatureSize === size
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                }`}
                              >
                                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 尚無簽名：顯示建立按鈕 */
                      <button
                        onClick={() => setShowSignaturePad(true)}
                        className="w-full border border-dashed border-slate-600 rounded-lg p-3
                                   text-slate-400 text-xs hover:border-purple-500 hover:text-purple-400
                                   transition-all flex items-center justify-center gap-2"
                      >
                        <PenTool size={14} />
                        點擊簽名
                      </button>
                    )}
                  </div>

                  {/* 完成按鈕 */}
                  <button
                    onClick={() => setShowAdvancedSettings(false)}
                    className="w-full mt-6 py-3 bg-purple-600 text-white font-bold rounded-xl
                               hover:bg-purple-500 transition-all"
                  >
                    完成設定
                  </button>
                </div>
              </div>
            )}

            {/* ========== 簽名畫布彈窗 ========== */}
            {showSignaturePad && (
              <div className="fixed inset-0 z-[130] flex items-center justify-center">
                {/* 背景遮罩 */}
                <div
                  className="absolute inset-0 bg-black/80"
                  onClick={() => setShowSignaturePad(false)}
                />
                {/* 簽名面板 */}
                <div className="relative w-[90%] max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-bold text-base flex items-center gap-2">
                      <PenTool size={16} /> 手寫簽名
                    </h4>
                    <button
                      onClick={() => setShowSignaturePad(false)}
                      className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center"
                    >
                      <X size={16} className="text-slate-400" />
                    </button>
                  </div>

                  {/* 簽名畫布 */}
                  <div className="bg-white rounded-xl overflow-hidden mb-4 select-none">
                    <canvas
                      ref={signatureCanvasRef}
                      width={300}
                      height={150}
                      className="w-full touch-none cursor-crosshair select-none"
                      style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                      onMouseDown={startSignatureDrawing}
                      onMouseMove={drawSignature}
                      onMouseUp={endSignatureDrawing}
                      onMouseLeave={endSignatureDrawing}
                      onTouchStart={startSignatureDrawing}
                      onTouchMove={drawSignature}
                      onTouchEnd={endSignatureDrawing}
                      onTouchCancel={endSignatureDrawing}
                    />
                  </div>

                  {/* 提示文字 */}
                  <p className="text-slate-500 text-[10px] text-center mb-4">
                    在白色區域內簽名，系統會自動去除白色背景
                  </p>

                  {/* 顏色選擇 */}
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-slate-400 text-xs">簽名顏色：</span>
                    {['#FFFFFF', '#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setSignatureColor(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          signatureColor === color
                            ? 'border-purple-400 scale-110 ring-2 ring-purple-400/50'
                            : 'border-slate-600 hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color === '#FFFFFF' ? '白色' : color === '#FFD700' ? '金色' : color === '#FF6B6B' ? '紅色' : color === '#4ECDC4' ? '青色' : '紫色'}
                      />
                    ))}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={clearSignature}
                      className="py-3 rounded-xl text-sm font-bold bg-slate-700 text-slate-300
                                 hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} /> 清除重畫
                    </button>
                    <button
                      onClick={saveSignature}
                      className="py-3 rounded-xl text-sm font-bold bg-purple-600 text-white
                                 hover:bg-purple-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Check size={16} /> 確認簽名
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { MarketDataCard };
export type { MarketDataCardProps };

// WarRoom 共用型別定義

export type WarRoomTab = 'overview' | 'clients' | 'tools' | 'share';

export interface ProfileData {
  displayName: string;
  photoURL: string;
  email: string;
  phone: string;
  lineId: string;
  instagram: string;
  lineQrCode?: string;
}

export interface WarRoomProps {
  user: any;
  onSelectClient: (client: any) => void;
  onLogout: () => void;
  onNavigateToTool?: (toolId: string) => void;
  onStartCheckup?: (clientId: string, clientName: string) => void;
}

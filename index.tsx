import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Phone, 
  Users, 
  Settings, 
  QrCode, 
  Mic, 
  MicOff, 
  PhoneOff, 
  LogOut, 
  Search, 
  Bell, 
  Radio, 
  Activity,
  XCircle, 
  Menu,
  Wifi,
  WifiOff,
  Bot,
  Zap,
  Lock,
  UserPlus,
  CheckCircle2,
  Cpu,
  Globe,
  Network,
  Coffee,
  ConciergeBell,
  Info,
  ArrowRight,
  PhoneIncoming,
  Pause,
  Play,
  History,
  Keyboard,
  Speaker,
  Headphones,
  MapPin,
  Navigation,
  Shield,
  LocateFixed,
  Maximize,
  GitBranch,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Save,
  X,
  Server,
  RefreshCw,
  Power,
  Bug,
  Terminal,
  Volume2
} from 'lucide-react';

// --- Global Types for Twilio & Google Maps ---
declare global {
  interface Window {
    Twilio: any;
    google: any;
  }
}

// --- Types ---
type View = 'dialer' | 'contacts' | 'settings' | 'setup' | 'guest-kiosk' | 'admin';
type UserStatus = 'available' | 'busy' | 'offline';
type Role = 'admin' | 'staff' | 'contractor' | 'guest';
type CallState = 'idle' | 'incoming' | 'dialing' | 'connected';

interface AppUser {
  id: string;
  name: string;
  role: Role;
  siteId: string;
  token: string;
  avatar: string;
}

interface Contact {
  id: string;
  name: string;
  role: Role;
  phone: string;
  status: UserStatus;
  avatar: string;
  siteId: string;
  location?: { lat: number; lng: number };
  lastSeen?: string;
}

interface CallLog {
  id: string;
  number: string;
  name: string;
  direction: 'inbound' | 'outbound';
  timestamp: Date;
  duration: number;
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface SystemConfig {
  siteName: string;
  siteLat: number;
  siteLng: number;
  radiusMeters: number;
  heartbeatMs: number;
  emergencyNumber: string;
  tokenEndpoint: string;
  voiceUrl: string;
  // AI Agent Config
  aiAgentName: string;
  aiModelProvider: 'ultravox' | 'twilio' | 'custom';
  aiEndpoint: string;
  aiApiKey: string;
}

// Routing Types
interface RoutingRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  criteria: {
    targetRole?: Role | 'any';
    targetUserId?: string | 'any';
    targetStatus?: UserStatus | 'any';
    callerRole?: Role | 'any';
    callerUserId?: string | 'any';
    locationState?: 'on-site' | 'off-site' | 'any';
  };
  action: {
    redirectNumber: string;
    redirectName: string;
  };
}

// --- Mock Service Layer ---
const MOCK_ADMIN_USER: AppUser = {
  id: 'u_admin',
  name: 'Alex Mercer',
  role: 'admin',
  siteId: 'site_alpha',
  token: '', // Token will be fetched
  avatar: 'AM'
};

// NOTE: This URL is a placeholder. It MUST be replaced by the user's actual Twilio Function URL.
const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  siteName: 'Site Alpha',
  siteLat: -27.975644322187307,
  siteLng: 153.40359770326276,
  radiusMeters: 400,
  heartbeatMs: 60000,
  emergencyNumber: '000',
  tokenEndpoint: 'https://siteos-backend-9708.twil.io/token', 
  voiceUrl: 'https://siteos-backend-9708.twil.io/voice',
  aiAgentName: 'Concierge AI',
  aiModelProvider: 'ultravox',
  aiEndpoint: 'wss://api.ultravox.ai/v1/connect',
  aiApiKey: ''
};

// Expanded Mock Contacts with Location Data around the Site
const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Sarah Connor', role: 'admin', phone: '+61416000001', status: 'available', avatar: 'SC', siteId: 'site_alpha', location: { lat: -27.9758, lng: 153.4038 }, lastSeen: 'Just now' },
  { id: '2', name: 'John Smith', role: 'staff', phone: '+61416000002', status: 'busy', avatar: 'JS', siteId: 'site_alpha', location: { lat: -27.9754, lng: 153.4034 }, lastSeen: '5m ago' },
  { id: '3', name: 'Mike Ross', role: 'contractor', phone: '+61416000003', status: 'offline', avatar: 'MR', siteId: 'site_alpha', location: { lat: -27.9780, lng: 153.4060 }, lastSeen: '2h ago' }, // Further away
  { id: '4', name: 'Front Desk', role: 'staff', phone: '100', status: 'available', avatar: 'FD', siteId: 'site_alpha', location: { lat: -27.9756, lng: 153.4036 }, lastSeen: 'Always on' },
  { id: '5', name: 'Housekeeping 01', role: 'staff', phone: '101', status: 'available', avatar: 'HK', siteId: 'site_alpha', location: { lat: -27.9752, lng: 153.4040 }, lastSeen: '10m ago' },
  { id: '000', name: 'Emergency Services', role: 'admin', phone: '000', status: 'available', avatar: 'EM', siteId: 'site_alpha' },
];

const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    id: 'r1',
    name: 'Busy Staff Fallback',
    description: 'If a staff member is busy, route immediately to Front Desk.',
    isActive: true,
    criteria: { targetRole: 'staff', targetStatus: 'busy', locationState: 'any', callerRole: 'any', targetUserId: 'any', callerUserId: 'any' },
    action: { redirectNumber: '100', redirectName: 'Front Desk' }
  },
  {
    id: 'r2',
    name: 'Off-Site Contractor Redirect',
    description: 'If contractor is off-site, route to Site Admin.',
    isActive: true,
    criteria: { targetRole: 'contractor', locationState: 'off-site', targetStatus: 'any', callerRole: 'any', targetUserId: 'any', callerUserId: 'any' },
    action: { redirectNumber: '+61416000001', redirectName: 'Sarah Connor (Admin)' }
  },
  {
    id: 'r3',
    name: 'Guest Priority Line',
    description: 'All calls from Guest Rooms routed to Concierge AI if Front Desk is busy.',
    isActive: false,
    criteria: { callerRole: 'guest', targetRole: 'staff', targetStatus: 'busy', locationState: 'any', targetUserId: 'any', callerUserId: 'any' },
    action: { redirectNumber: 'AI_AGENT', redirectName: 'Concierge AI' }
  }
];

// --- Utilities ---
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatPhoneNumber = (input: string) => {
  if(!input) return '';
  const cleaned = input.replace(/\s+/g, '').replace(/-/g, '').replace(/[()]/g, '');
  if (cleaned.length < 5) return cleaned;
  if (cleaned.startsWith('+')) return cleaned;
  if (/^0[2-9]\d{8}$/.test(cleaned) || /^04\d{8}$/.test(cleaned)) {
     return `+61${cleaned.substring(1)}`;
  }
  if ((cleaned.length === 9) && !cleaned.startsWith('61')) {
     return `+61${cleaned}`;
  }
  if (cleaned.startsWith('61') && cleaned.length === 11) {
     return `+${cleaned}`;
  }
  return cleaned;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// --- Components ---

const StatusIndicator = ({ status }: { status: UserStatus }) => {
  const colors = {
    available: 'bg-emerald-500',
    busy: 'bg-rose-500',
    offline: 'bg-slate-400'
  };
  return <span className={`h-3 w-3 rounded-full ${colors[status]} ring-2 ring-white dark:ring-slate-900 shadow-sm`} />;
};

const KeypadButton: React.FC<{ value: string, sub?: string, onClick: (val: string) => void, compact?: boolean }> = ({ value, sub, onClick, compact }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(value); }}
    className={`${compact ? 'w-14 h-14 text-xl' : 'w-16 h-16 sm:w-20 sm:h-20 text-2xl'} rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center transition-all active:scale-95 active:bg-slate-200 dark:active:bg-slate-700 select-none group border border-transparent hover:border-slate-200 dark:hover:border-slate-700`}
  >
    <span className={`font-semibold text-slate-900 dark:text-white group-hover:scale-110 transition-transform`}>{value}</span>
    {!compact && sub && <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">{sub}</span>}
  </button>
);

// --- Google Map Component ---
const UserMap = ({ users, center, zoom = 18, historyPath }: { users: Contact[], center: {lat:number, lng:number}, zoom?: number, historyPath?: {lat:number, lng:number}[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const pathRef = useRef<any>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(!!(window.google && window.google.maps));
  const [mapType, setMapType] = useState<'satellite' | 'roadmap'>('satellite');

  useEffect(() => {
    if (!isGoogleReady) {
      const interval = setInterval(() => {
        if (window.google && window.google.maps) {
          setIsGoogleReady(true);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isGoogleReady]);

  useEffect(() => {
    if (mapRef.current && !mapInstance && isGoogleReady && window.google?.maps) {
      try {
        const map = new window.google.maps.Map(mapRef.current, {
          center: center,
          zoom: zoom,
          mapTypeId: 'satellite',
          styles: [
              { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
              {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
          ],
          disableDefaultUI: true,
          zoomControl: true,
        });
        setMapInstance(map);
      } catch (err) {
        console.error("Failed to initialize Google Map", err);
      }
    }
  }, [center.lat, center.lng, zoom, isGoogleReady]); 

  useEffect(() => {
    if (mapInstance) {
      mapInstance.setMapTypeId(mapType);
    }
  }, [mapInstance, mapType]);

  useEffect(() => {
    if (mapInstance && isGoogleReady && window.google?.maps) {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      
      if (pathRef.current) {
          pathRef.current.setMap(null);
          pathRef.current = null;
      }
      
      const bounds = new window.google.maps.LatLngBounds();
      let hasUsers = false;

      new window.google.maps.Marker({
         position: center,
         map: mapInstance,
         icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#6366f1',
            fillOpacity: 0.2,
            strokeWeight: 1,
            strokeColor: '#6366f1',
         },
         title: "Site Center"
      });
      bounds.extend(center);

      users.forEach(u => {
        if (!u.location) return;
        hasUsers = true;
        bounds.extend(u.location);
        const color = u.status === 'available' ? '#10b981' : u.status === 'busy' ? '#f43f5e' : '#94a3b8';
        const marker = new window.google.maps.Marker({
          position: u.location,
          map: mapInstance,
          title: u.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#ffffff',
          },
        });
        markersRef.current.push(marker);
      });

      if (historyPath && historyPath.length > 0) {
          const lineSymbol = { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW };
          const path = new window.google.maps.Polyline({
              path: historyPath,
              geodesic: true,
              strokeColor: '#fbbf24',
              strokeOpacity: 0.8,
              strokeWeight: 4,
              icons: [{ icon: lineSymbol, offset: '100%' }]
          });
          path.setMap(mapInstance);
          pathRef.current = path;
          historyPath.forEach(p => bounds.extend(p));
          
          const startMarker = new window.google.maps.Marker({
              position: historyPath[0],
              map: mapInstance,
              icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: '#fbbf24', strokeWeight: 1 },
              title: "Start of History"
          });
          markersRef.current.push(startMarker);
      }
      
      if (historyPath && historyPath.length > 0) {
          mapInstance.fitBounds(bounds);
      } else if (hasUsers && users.length > 1) {
          mapInstance.fitBounds(bounds);
      } else if (users.length === 1 && users[0].location) {
          mapInstance.panTo(users[0].location);
          mapInstance.setZoom(19);
      } else {
          mapInstance.panTo(center);
          mapInstance.setZoom(zoom);
      }
    }
  }, [mapInstance, users, center.lat, center.lng, zoom, isGoogleReady, historyPath]);

  const toggleFullscreen = () => {
    if (containerRef.current && !document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(e => console.warn(e));
    } else {
        document.exitFullscreen();
    }
  };

  if (!isGoogleReady) return <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono text-xs">Connecting to Satellites...</div>;

  return (
    <div ref={containerRef} className="w-full h-full relative rounded-xl overflow-hidden group bg-slate-900">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 sm:right-14 flex flex-col gap-2 z-[50]">
        <button onClick={() => setMapType(prev => prev === 'satellite' ? 'roadmap' : 'satellite')} className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-lg flex items-center justify-center text-slate-700 dark:text-white">
            {mapType === 'satellite' ? <Globe className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
        </button>
        <button onClick={toggleFullscreen} className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-lg flex items-center justify-center text-slate-700 dark:text-white">
            <Maximize className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- Independent Hooks ---

// 1. Audio Devices Hook (Separated from Twilio logic)
const useAudioDevices = () => {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const getDevices = useCallback(async () => {
    try {
      // Prompt for permission if not already granted to ensure labels are visible
      if (!permissionGranted) {
         await navigator.mediaDevices.getUserMedia({ audio: true });
         setPermissionGranted(true);
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput').map(d => ({ 
        deviceId: d.deviceId, 
        label: d.label || `Microphone ${d.deviceId.slice(0,5)}...`, 
        kind: 'audioinput' as const 
      }));
      const outputs = devices.filter(d => d.kind === 'audiooutput').map(d => ({ 
        deviceId: d.deviceId, 
        label: d.label || `Speaker ${d.deviceId.slice(0,5)}...`, 
        kind: 'audiooutput' as const 
      }));
      
      setInputDevices(inputs);
      setOutputDevices(outputs);
    } catch (e) {
      console.warn("Error getting audio devices", e);
    }
  }, [permissionGranted]);

  useEffect(() => {
    // Initial fetch
    getDevices();
    
    // Listener for hardware changes (plugging in headset)
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, [getDevices]);

  return { inputDevices, outputDevices, getDevices };
};

// 2. Geolocation Hook
const useGeolocationHeartbeat = (config: SystemConfig, currentUser: AppUser | null, setStatus: (s: UserStatus) => void, showToast: (m: string, t: 'success'|'info'|'error') => void) => {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isWithinFence, setIsWithinFence] = useState<boolean | null>(null);

  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        const distance = calculateDistance(latitude, longitude, config.siteLat, config.siteLng);
        const isInside = distance <= config.radiusMeters;
        if (isWithinFence !== isInside) {
           setIsWithinFence(isInside);
           if (isInside) setStatus('available');
           else setStatus('offline');
        }
      },
      (err) => console.warn("[Geo Heartbeat] Error:", err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [config, isWithinFence, setStatus]);

  useEffect(() => {
    if (!currentUser) return;
    checkLocation();
    const intervalId = setInterval(checkLocation, config.heartbeatMs);
    return () => clearInterval(intervalId);
  }, [config, currentUser, checkLocation]);

  return { location, isWithinFence };
};

// 3. Twilio Voice Hook
const useTwilioVoice = (token: string | null, onTokenExpired?: () => void) => {
  const [device, setDevice] = useState<any>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeConnection, setActiveConnection] = useState<any>(null);
  const [incomingConnection, setIncomingConnection] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!token || !window.Twilio) {
       setDeviceReady(false);
       return;
    }
    console.log("Initializing Twilio Device...");
    let newDevice: any;
    try {
      newDevice = new window.Twilio.Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        closeProtection: true,
      });
    } catch (e: any) {
      setError(e.message);
      return;
    }

    newDevice.on('registered', () => {
      console.log('Twilio Device Registered');
      setDeviceReady(true);
      setError(null);
    });

    newDevice.on('error', (err: any) => {
      console.error('Twilio Device Error:', err);
      setError(err.message || 'Twilio Error');
      if (err.code === 31205) { // Token expired
         setDeviceReady(false);
         if (onTokenExpired) onTokenExpired();
      }
    });

    newDevice.on('incoming', (connection: any) => {
      setCallState('incoming');
      setIncomingConnection(connection);
      connection.on('disconnect', () => {
        setCallState('idle');
        setIncomingConnection(null);
        setActiveConnection(null);
      });
    });

    newDevice.register();
    setDevice(newDevice);

    return () => {
      try { newDevice.destroy(); } catch (e) { console.warn("Error destroying device", e); }
    };
  }, [token]);

  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const makeCall = useCallback((number: string) => {
    if (!device) return;
    const formattedNumber = formatPhoneNumber(number);
    setCallState('dialing');
    const connection = device.connect({ params: { To: formattedNumber, AgentId: MOCK_ADMIN_USER.id } });
    setActiveConnection(connection);
    connection.on('accept', () => setCallState('connected'));
    connection.on('disconnect', () => { setCallState('idle'); setActiveConnection(null); });
    connection.on('error', (e: any) => { setCallState('idle'); setActiveConnection(null); setError("Call failed: " + e.message); });
  }, [device]);

  const endCall = useCallback(() => {
    if (activeConnection) activeConnection.disconnect();
    else if (incomingConnection) incomingConnection.reject();
    else if (device) device.disconnectAll();
    setCallState('idle');
    setActiveConnection(null);
    setIncomingConnection(null);
  }, [activeConnection, incomingConnection, device]);

  const acceptCall = useCallback(() => {
    if (incomingConnection) {
      incomingConnection.accept();
      setActiveConnection(incomingConnection);
      setIncomingConnection(null);
      setCallState('connected');
    }
  }, [incomingConnection]);

  const rejectCall = useCallback(() => {
    if (incomingConnection) {
      incomingConnection.reject();
      setIncomingConnection(null);
      setCallState('idle');
    }
  }, [incomingConnection]);
  
  const setAudioInput = useCallback((deviceId: string) => {
     if(device && device.audio) device.audio.setInputDevice(deviceId);
  }, [device]);

  const setAudioOutput = useCallback((deviceId: string) => {
     if(device && device.audio && device.audio.speaker) device.audio.speaker.setAudioOutputDevice(deviceId);
  }, [device]);

  return {
    device, deviceReady, callState, callDuration, error,
    activeConnection, incomingConnection,
    makeCall, endCall, acceptCall, rejectCall,
    setAudioInput, setAudioOutput
  };
};

const SettingsView = ({ 
  user, 
  handleLogout, 
  setTwilioToken,
  inputDevices, 
  outputDevices, 
  setAudioInput, 
  setAudioOutput, 
  refreshDevices,
  systemConfig, 
  setSystemConfig,
  isDeviceReady, 
  onRefreshConnection,
  geoState
}: { 
  user: AppUser, 
  handleLogout: () => void, 
  setTwilioToken: (s: string) => void,
  inputDevices: AudioDevice[], 
  outputDevices: AudioDevice[], 
  setAudioInput: (id: string) => void, 
  setAudioOutput: (id: string) => void, 
  refreshDevices: () => void,
  systemConfig: SystemConfig, 
  setSystemConfig: (c: SystemConfig) => void,
  isDeviceReady: boolean, 
  onRefreshConnection: (i: string) => void,
  geoState: { location: { lat: number, lng: number } | null, isWithinFence: boolean | null }
}) => {
   
   const [localEndpoint, setLocalEndpoint] = useState(systemConfig.tokenEndpoint);
   const [manualToken, setManualToken] = useState('');
   const [testResult, setTestResult] = useState<string | null>(null);

   const isPlaceholder = localEndpoint.includes('siteos-backend');

   const handleSaveConfig = () => {
      setSystemConfig({...systemConfig, tokenEndpoint: localEndpoint});
      onRefreshConnection(user.name);
   };

   const handleManualToken = () => {
      if(manualToken.length > 20) {
         setTwilioToken(manualToken);
         setTestResult("Manual token applied. Check dialer.");
      }
   };

   const testEndpoint = async () => {
      setTestResult("Testing...");
      try {
         const url = new URL(localEndpoint);
         url.searchParams.set('identity', 'TestUser');
         const start = Date.now();
         const res = await fetch(url.toString());
         const ms = Date.now() - start;
         
         if(res.ok) {
            const text = await res.text();
            let valid = false;
            try {
               const json = JSON.parse(text);
               if(json.token) valid = true;
            } catch {
               if(text.length > 50) valid = true;
            }
            setTestResult(`✅ Success (${ms}ms). Valid: ${valid}`);
         } else {
            setTestResult(`❌ Error ${res.status}: ${res.statusText}`);
         }
      } catch(e: any) {
         setTestResult(`❌ Network Error: ${e.message}. Check CORS.`);
      }
   };

   return (
      <div className="h-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right-4 duration-300">
         <h2 className="text-2xl font-bold mb-6 dark:text-white">Settings</h2>
         
         <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" /> Connection Status
               </h3>
               <div className="space-y-3">
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-500">Voice Service</span>
                     <span className={`text-sm font-bold flex items-center gap-1 ${isDeviceReady ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isDeviceReady ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                        {isDeviceReady ? 'Connected' : 'Offline'}
                     </span>
                  </div>
                  
                  {/* Connection Diagnostics */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-3 mt-2 border border-slate-200 dark:border-slate-700">
                     <h4 className="text-xs font-bold text-slate-500 flex items-center gap-2">
                        <Bug className="w-3 h-3" /> Connection Diagnostics
                     </h4>
                     
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Token Endpoint URL</label>
                        <div className="flex gap-2">
                           <input 
                              type="text" 
                              value={localEndpoint}
                              onChange={e => setLocalEndpoint(e.target.value)}
                              className={`flex-1 p-2 rounded-lg bg-white dark:bg-slate-800 border text-xs font-mono ${isPlaceholder ? 'border-amber-500 text-amber-600' : 'border-slate-200 dark:border-slate-700'}`}
                           />
                           <button onClick={handleSaveConfig} className="bg-indigo-600 text-white px-3 rounded-lg text-xs font-bold hover:bg-indigo-700">Save</button>
                        </div>
                        {isPlaceholder && <p className="text-[10px] text-amber-500 font-bold mt-1">⚠️ This is a placeholder URL. Replace with your own or use Manual Override.</p>}
                     </div>

                     <div className="flex items-center justify-between">
                        <button onClick={testEndpoint} className="text-xs font-bold text-indigo-500 hover:underline">Test Endpoint Connection</button>
                        {testResult && <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{testResult}</span>}
                     </div>

                     <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Manual Token Override (Debug)</label>
                        <div className="flex gap-2">
                           <input 
                              type="text" 
                              placeholder="Paste raw JWT here..."
                              value={manualToken}
                              onChange={e => setManualToken(e.target.value)}
                              className="flex-1 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                           />
                           <button onClick={handleManualToken} className="bg-slate-600 text-white px-3 rounded-lg text-xs font-bold hover:bg-slate-700">Apply</button>
                        </div>
                     </div>

                     <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Geolocation</label>
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-mono">{geoState.location ? `${geoState.location.lat.toFixed(4)}, ${geoState.location.lng.toFixed(4)}` : 'Acquiring...'}</span>
                           <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${geoState.isWithinFence ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {geoState.isWithinFence ? 'ON SITE' : 'OFF SITE'}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     <Speaker className="w-5 h-5 text-indigo-500" /> Audio Devices
                  </h3>
                  <button onClick={refreshDevices} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors" title="Refresh Devices">
                     <RefreshCw className="w-4 h-4" />
                  </button>
               </div>
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                        <Mic className="w-3 h-3" /> Microphone
                     </label>
                     <select onChange={e => setAudioInput(e.target.value)} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm dark:text-white">
                        {inputDevices.length === 0 && <option>No inputs found</option>}
                        {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                        <Volume2 className="w-3 h-3" /> Speaker
                     </label>
                     <select onChange={e => setAudioOutput(e.target.value)} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm dark:text-white">
                        {outputDevices.length === 0 && <option>No outputs found</option>}
                        {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                     </select>
                  </div>
               </div>
            </div>

            <button onClick={handleLogout} className="w-full py-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors">
               <LogOut className="w-5 h-5" /> Sign Out
            </button>

            <div className="text-center text-xs text-slate-400">
               SiteOS v1.3.0 • {systemConfig.siteName}
            </div>
         </div>
      </div>
   );
};

const NavButton = ({ icon: Icon, label, active, onClick, mobile }: { icon: any, label: string, active: boolean, onClick: () => void, mobile?: boolean }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${mobile ? 'flex-col justify-center text-[10px] w-full' : 'w-full'} ${active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
  >
    <Icon className={`${mobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
    <span className={mobile ? '' : ''}>{label}</span>
  </button>
);

const DialerView = ({ dialString, setDialString, handleCallStart, deviceReady, activeView, setActiveView, history, clearHistory, retryConnection }: any) => {
  const handleKeypad = (val: string) => {
    if (dialString.length < 15) setDialString((prev: string) => prev + val);
  };
  const handleBackspace = () => {
    setDialString((prev: string) => prev.slice(0, -1));
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-8 w-full max-w-xs">
           <input 
              type="text" 
              readOnly 
              value={dialString} 
              className="w-full text-center text-4xl font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-300"
              placeholder="Enter Number"
           />
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-8">
           {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
              <KeypadButton key={key} value={key} onClick={handleKeypad} />
           ))}
        </div>

        <div className="flex items-center gap-6">
           {dialString.length > 0 && (
             <button onClick={handleBackspace} className="p-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-8 h-8" />
             </button>
           )}
           <button 
             onClick={() => handleCallStart()}
             disabled={!deviceReady || dialString.length === 0}
             className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 ${deviceReady ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
           >
             <Phone className="w-8 h-8" />
           </button>
        </div>
        
        {!deviceReady && (
           <div className="mt-4 flex items-center gap-2 text-rose-500 text-sm font-bold cursor-pointer" onClick={retryConnection}>
              <WifiOff className="w-4 h-4" /> Service Offline (Tap to Retry)
           </div>
        )}
      </div>
      
      {/* Recent Calls Mini List */}
      <div className="h-1/3 bg-white dark:bg-slate-800 rounded-t-3xl shadow-lg p-6 overflow-hidden flex flex-col">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
               <History className="w-5 h-5 text-indigo-500" /> Recent
            </h3>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs text-rose-500 font-bold hover:underline">Clear</button>
            )}
         </div>
         <div className="flex-1 overflow-y-auto space-y-2">
            {history.length === 0 && <p className="text-center text-slate-400 text-sm mt-8">No recent calls</p>}
            {history.map((log: CallLog) => (
               <div key={log.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer group" onClick={() => setDialString(log.number)}>
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-full ${log.direction === 'inbound' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {log.direction === 'inbound' ? <PhoneIncoming className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 -rotate-45" />}
                     </div>
                     <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{log.name}</div>
                        <div className="text-xs text-slate-500">{log.number}</div>
                     </div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                     {log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const ContactsView = ({ user, setDialString, setActiveView }: any) => {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 p-6 overflow-y-auto">
       <h2 className="text-2xl font-bold mb-6 dark:text-white">Contacts</h2>
       
       <div className="mb-6">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
             <input type="text" placeholder="Search team..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-none shadow-sm outline-none text-slate-900 dark:text-white" />
          </div>
       </div>

       <div className="space-y-3">
          {MOCK_CONTACTS.map(contact => (
             <div key={contact.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setDialString(contact.phone); setActiveView('dialer'); }}>
                <div className="flex items-center gap-4">
                   <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-slate-700 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                         {contact.avatar}
                      </div>
                      <div className="absolute bottom-0 right-0">
                         <StatusIndicator status={contact.status} />
                      </div>
                   </div>
                   <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{contact.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                         <span className="capitalize bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">{contact.role}</span>
                         {contact.lastSeen && <span>• {contact.lastSeen}</span>}
                      </div>
                   </div>
                </div>
                <button className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-slate-600">
                   <Phone className="w-5 h-5" />
                </button>
             </div>
          ))}
       </div>
    </div>
  );
};

const AdminView = ({ setGeneratedQrToken, generatedQrToken, routingRules, setRoutingRules, systemConfig, setSystemConfig }: any) => {
   return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 p-6 overflow-y-auto">
         <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" /> Admin Console
         </h2>
         
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
               <h3 className="font-bold text-lg mb-4 dark:text-white">Call Routing Rules</h3>
               <div className="space-y-4">
                  {routingRules.map((rule: RoutingRule) => (
                     <div key={rule.id} className="border border-slate-100 dark:border-slate-700 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                           <h4 className="font-bold text-sm dark:text-white">{rule.name}</h4>
                           <div className={`w-8 h-4 rounded-full p-0.5 cursor-pointer ${rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => {
                               const updated = routingRules.map((r: RoutingRule) => r.id === rule.id ? {...r, isActive: !r.isActive} : r);
                               setRoutingRules(updated);
                           }}>
                              <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${rule.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                           </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{rule.description}</p>
                        <div className="flex gap-2 text-[10px] font-mono text-slate-400">
                           <span className="bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">IF {rule.criteria.targetRole === 'any' ? 'User' : rule.criteria.targetRole} is {rule.criteria.targetStatus}</span>
                           <span className="bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">THEN {rule.action.redirectName}</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
            
            <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                   <h3 className="font-bold text-lg mb-4 dark:text-white">Provisioning</h3>
                   <p className="text-sm text-slate-500 mb-4">Generate QR codes for staff quick login.</p>
                   <button 
                     onClick={() => setGeneratedQrToken('staff_id_2')} // Mock ID
                     className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold w-full"
                   >
                      Generate Staff Token (John Smith)
                   </button>
                   {generatedQrToken && (
                      <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl flex flex-col items-center">
                         <QrCode className="w-32 h-32 text-slate-900 dark:text-white" />
                         <p className="mt-2 text-xs font-mono text-slate-500 break-all">{window.location.origin}/?setup_token={generatedQrToken}</p>
                      </div>
                   )}
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
                   <h3 className="font-bold text-lg mb-4 dark:text-white">System Config</h3>
                   <div className="space-y-3">
                      <div>
                         <label className="text-xs font-bold text-slate-500">Site Name</label>
                         <input type="text" value={systemConfig.siteName} onChange={e => setSystemConfig({...systemConfig, siteName: e.target.value})} className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-500">Emergency Number</label>
                         <input type="text" value={systemConfig.emergencyNumber} onChange={e => setSystemConfig({...systemConfig, emergencyNumber: e.target.value})} className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" />
                      </div>
                   </div>
                </div>
            </div>
         </div>
      </div>
   );
};

const SetupView = ({ generateSetupLink, generatedQrToken, setGeneratedQrToken }: any) => {
   return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
         <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/30">
            <Radio className="w-10 h-10 text-white" />
         </div>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome to SiteOS</h1>
         <p className="text-slate-500 mb-8 max-w-sm">Secure Communication Platform for Enterprise Sites.</p>
         
         <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm">
            <h2 className="font-bold text-lg mb-4 dark:text-white">Device Setup</h2>
            <div className="flex flex-col gap-4">
               <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
                  Scan Provisioning QR
               </button>
               <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-800 px-2 text-slate-500">Or</span></div>
               </div>
               <input type="text" placeholder="Enter Provisioning Token" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-sm" />
               <button className="text-indigo-600 dark:text-indigo-400 text-sm font-bold mt-2">Manual Server Configuration</button>
            </div>
         </div>
         <p className="mt-8 text-xs text-slate-400">v1.3.0 • Secure Connection</p>
      </div>
   );
};

const GuestKioskView = ({ handleCallStart, setDialString, emergencyNumber }: any) => {
   return (
      <div className="h-full flex flex-col bg-slate-900 text-white p-6 relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
         
         <header className="flex justify-between items-center mb-12 relative z-10">
            <div>
               <h1 className="text-3xl font-bold">Good Morning</h1>
               <p className="text-indigo-200">Room 101 Guest</p>
            </div>
            <div className="text-right">
               <div className="text-2xl font-mono font-bold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
               <div className="text-sm text-indigo-300">{new Date().toLocaleDateString()}</div>
            </div>
         </header>

         <div className="flex-1 grid grid-cols-2 gap-6 relative z-10">
            <button onClick={() => handleCallStart('100')} className="bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-3xl p-6 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 border border-white/10">
               <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                  <ConciergeBell className="w-8 h-8 text-white" />
               </div>
               <span className="font-bold text-lg">Concierge</span>
            </button>
            
            <button onClick={() => handleCallStart('101')} className="bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-3xl p-6 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 border border-white/10">
               <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <Coffee className="w-8 h-8 text-white" />
               </div>
               <span className="font-bold text-lg">Room Service</span>
            </button>
            
            <button onClick={() => handleCallStart('AI_AGENT')} className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 col-span-2 shadow-xl shadow-indigo-600/30">
               <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                  <Bot className="w-8 h-8 text-white" />
               </div>
               <div className="text-center">
                  <span className="font-bold text-lg block">AI Assistant</span>
                  <span className="text-sm text-indigo-200">Ask about amenities, local area & more</span>
               </div>
            </button>
         </div>

         <div className="mt-6 relative z-10">
            <button onClick={() => handleCallStart(emergencyNumber)} className="w-full py-4 bg-rose-600 hover:bg-rose-700 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-transform active:scale-95">
               <AlertCircle className="w-6 h-6" /> Emergency Help ({emergencyNumber})
            </button>
         </div>
      </div>
   );
};

const App = () => {
  const [activeView, setActiveView] = useState<View>('dialer');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(MOCK_ADMIN_USER);
  const [dialString, setDialString] = useState('');
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(DEFAULT_ROUTING_RULES);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [generatedQrToken, setGeneratedQrToken] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [status, setStatus] = useState<UserStatus>('available');
  const [twilioToken, setTwilioToken] = useState<string>('');

  const [toast, setToast] = useState<{msg:string, type:'success'|'info'|'error'} | null>(null);
  const showToast = (msg: string, type: 'success'|'info'|'error' = 'info') => {
      setToast({msg, type});
      setTimeout(() => setToast(null), 3000);
  };

  const fetchTwilioToken = useCallback(async (identity: string) => {
     if(!identity || !systemConfig.tokenEndpoint) return;
     if (!systemConfig.tokenEndpoint.startsWith('http')) {
        console.warn("Invalid Token Endpoint format");
        return;
     }

     try {
       const url = new URL(systemConfig.tokenEndpoint);
       const safeIdentity = identity.replace(/\s+/g, '');
       url.searchParams.set('identity', safeIdentity);
       
       console.log("Fetching token for:", safeIdentity);
       const res = await fetch(url.toString());
       
       if (!res.ok) throw new Error(`Token Server returned ${res.status}: ${res.statusText}`);

       const text = await res.text();
       let token = '';
       try {
          const json = JSON.parse(text);
          token = json.token || (typeof json === 'string' ? json : '');
       } catch {
          token = text.trim();
       }
       
       if(token && token.length > 20) {
          setTwilioToken(token);
          if(currentUser) setCurrentUser({...currentUser, token});
          showToast('Voice Services Connected', 'success');
       } else {
          throw new Error('Invalid token format received');
       }
     } catch(e: any) {
        console.error(e);
     }
  }, [systemConfig.tokenEndpoint, currentUser]);

  // Use separated hooks
  const { inputDevices, outputDevices, getDevices } = useAudioDevices();
  const { location, isWithinFence } = useGeolocationHeartbeat(systemConfig, currentUser, setStatus, showToast);
  const { 
    deviceReady, 
    callState, 
    callDuration,
    makeCall, 
    endCall,
    acceptCall,
    rejectCall,
    setAudioInput,
    setAudioOutput,
    incomingConnection
  } = useTwilioVoice(twilioToken, () => {
      console.log("Token expired, refreshing...");
      if (currentUser) fetchTwilioToken(currentUser.name);
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupToken = params.get('setup_token'); 
    
    if (setupToken) {
       console.log("Found provisioning token:", setupToken);
       if (setupToken.startsWith('staff_id_')) {
          const id = setupToken.replace('staff_id_', '');
          const user = MOCK_CONTACTS.find(c => c.id === id);
          if (user) {
             const newUser = { id: user.id, name: user.name, role: user.role, siteId: user.siteId, token: '', avatar: user.avatar };
             setCurrentUser(newUser);
             fetchTwilioToken(newUser.name);
             showToast(`Provisioned as ${newUser.name}`, 'success');
             window.history.replaceState({}, document.title, "/");
          } else {
             showToast("Invalid Provisioning Token", 'error');
          }
       }
    } else if (currentUser && !twilioToken) {
       fetchTwilioToken(currentUser.name);
    }
  }, []);

  const handleCallStart = (number?: string) => {
      const target = number || dialString;
      if (!target) return;
      makeCall(target);
      setCallHistory(prev => [{
          id: Date.now().toString(),
          number: target,
          name: MOCK_CONTACTS.find(c => c.phone === target)?.name || 'Unknown',
          direction: 'outbound',
          timestamp: new Date(),
          duration: 0
      }, ...prev]);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setTwilioToken('');
    setActiveView('setup');
  };

  const clearHistory = () => setCallHistory([]);

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex overflow-hidden font-sans select-none">
       {/* Sidebar Navigation */}
       <aside className="hidden sm:flex flex-col items-center w-20 py-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-20">
          <div className="mb-8 p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30">
             <Radio className="w-8 h-8 text-white animate-pulse" />
          </div>
          <nav className="flex-1 flex flex-col gap-4 w-full px-2">
             <NavButton icon={Phone} label="Dialer" active={activeView === 'dialer'} onClick={() => setActiveView('dialer')} />
             <NavButton icon={Users} label="Contacts" active={activeView === 'contacts'} onClick={() => setActiveView('contacts')} />
             {currentUser?.role === 'admin' && (
                <NavButton icon={Shield} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
             )}
             <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} />
          </nav>
          <div className="mt-auto flex flex-col gap-4 items-center">
             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs relative group cursor-pointer" title={currentUser?.name}>
                {currentUser?.avatar || '?'}
                <div className="absolute bottom-0 right-0">
                   <StatusIndicator status={status} />
                </div>
             </div>
             <button onClick={handleLogout} className="text-slate-400 hover:text-rose-500 transition-colors p-2">
                <LogOut className="w-6 h-6" />
             </button>
          </div>
       </aside>

       <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Mobile Header */}
          <header className="sm:hidden h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-950 z-20">
             <div className="flex items-center gap-2">
                <Radio className="w-6 h-6 text-indigo-600" />
                <span className="font-bold text-lg tracking-tight">SiteOS</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs relative">
                {currentUser?.avatar}
                <div className="absolute bottom-0 right-0">
                   <StatusIndicator status={status} />
                </div>
             </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
             {activeView === 'dialer' && (
                <DialerView 
                   dialString={dialString}
                   setDialString={setDialString}
                   handleCallStart={handleCallStart}
                   deviceReady={deviceReady}
                   activeView={activeView}
                   setActiveView={setActiveView}
                   history={callHistory}
                   clearHistory={clearHistory}
                   retryConnection={() => fetchTwilioToken(currentUser?.name || '')}
                />
             )}
             
             {activeView === 'contacts' && currentUser && (
                <ContactsView 
                   user={currentUser}
                   setDialString={setDialString}
                   setActiveView={setActiveView}
                />
             )}

             {activeView === 'admin' && (
                <AdminView 
                   setGeneratedQrToken={setGeneratedQrToken}
                   generatedQrToken={generatedQrToken}
                   routingRules={routingRules}
                   setRoutingRules={setRoutingRules}
                   systemConfig={systemConfig}
                   setSystemConfig={setSystemConfig}
                />
             )}

             {activeView === 'settings' && currentUser && (
                <SettingsView 
                   user={currentUser}
                   handleLogout={handleLogout}
                   setTwilioToken={setTwilioToken}
                   inputDevices={inputDevices}
                   outputDevices={outputDevices}
                   setAudioInput={setAudioInput}
                   setAudioOutput={setAudioOutput}
                   refreshDevices={getDevices}
                   geoState={{location, isWithinFence}}
                   systemConfig={systemConfig}
                   setSystemConfig={setSystemConfig}
                   isDeviceReady={deviceReady}
                   onRefreshConnection={fetchTwilioToken}
                />
             )}

             {activeView === 'setup' && (
                <SetupView 
                   generateSetupLink={() => {}}
                   generatedQrToken={null}
                   setGeneratedQrToken={setGeneratedQrToken}
                />
             )}
             
             {activeView === 'guest-kiosk' && (
                <GuestKioskView 
                   handleCallStart={handleCallStart}
                   setDialString={setDialString}
                   emergencyNumber={systemConfig.emergencyNumber}
                />
             )}
          </div>

          {/* ... Modals (Call Overlay, Incoming, Toast) ... */}
          {callState === 'incoming' && incomingConnection && (
             <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mb-8 animate-pulse">
                   <PhoneIncoming className="w-16 h-16 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">{incomingConnection.parameters.From || 'Unknown Caller'}</h2>
                <p className="text-indigo-300 mb-12 animate-pulse">Incoming Call...</p>
                <div className="flex gap-8">
                   <button onClick={rejectCall} className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-rose-500/40">
                      <PhoneOff className="w-8 h-8" />
                   </button>
                   <button onClick={acceptCall} className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-emerald-500/40 animate-bounce">
                      <Phone className="w-8 h-8" />
                   </button>
                </div>
             </div>
          )}

          {callState === 'connected' && (
             <div className="absolute bottom-0 left-0 right-0 bg-indigo-600 text-white p-4 z-40 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                       <Activity className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="font-bold text-lg">Connected</h3>
                       <p className="text-indigo-200 font-mono">{formatDuration(callDuration)}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <button className="p-3 rounded-full hover:bg-white/10 transition-colors"><MicOff className="w-6 h-6" /></button>
                    <button onClick={endCall} className="p-4 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors shadow-lg">
                       <PhoneOff className="w-6 h-6" />
                    </button>
                 </div>
             </div>
          )}

          <nav className="sm:hidden h-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-20">
             <NavButton icon={Phone} label="Keypad" active={activeView === 'dialer'} onClick={() => setActiveView('dialer')} mobile />
             <NavButton icon={Users} label="Contacts" active={activeView === 'contacts'} onClick={() => setActiveView('contacts')} mobile />
             {currentUser?.role === 'admin' && (
               <NavButton icon={Shield} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} mobile />
             )}
             <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} mobile />
          </nav>
          
          {toast && (
             <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-[70] animate-in slide-in-from-top-4 fade-in flex items-center gap-2 font-bold text-sm ${toast.type === 'success' ? 'bg-emerald-500 text-white' : toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : toast.type === 'error' ? <AlertCircle className="w-4 h-4"/> : <Info className="w-4 h-4"/>}
                {toast.msg}
             </div>
          )}
       </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
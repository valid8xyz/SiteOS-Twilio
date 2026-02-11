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
  Volume2,
  Shuffle
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
  redirectedFrom?: string;
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

// 1. Audio Devices Hook
const useAudioDevices = () => {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const getDevices = useCallback(async () => {
    try {
      if (!permissionGranted) {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         // Important: Stop the stream immediately so we don't keep the mic open just for listing devices
         stream.getTracks().forEach(track => track.stop());
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
    getDevices();
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
const useTwilioVoice = (
  token: string | null, 
  onTokenExpired: () => void,
  selectedMic: string,
  selectedSpeaker: string
) => {
  const [device, setDevice] = useState<any>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeConnection, setActiveConnection] = useState<any>(null);
  const [incomingConnection, setIncomingConnection] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<any>(null);

  // Apply audio device settings whenever device is ready or selection changes
  useEffect(() => {
    if(device && deviceReady) {
       if(selectedMic && device.audio) {
          device.audio.setInputDevice(selectedMic);
       }
       if(selectedSpeaker && device.audio && device.audio.speaker) {
          device.audio.speaker.setAudioOutputDevice(selectedSpeaker);
       }
    }
  }, [device, deviceReady, selectedMic, selectedSpeaker]);

  // Expose manual setters for device management
  const setAudioInput = useCallback((deviceId: string) => {
    if (device && device.audio) {
       try {
         device.audio.setInputDevice(deviceId);
       } catch (e) { console.warn("Failed to set input device", e); }
    }
  }, [device]);

  const setAudioOutput = useCallback((deviceId: string) => {
    if (device && device.audio && device.audio.speaker) {
        try {
          device.audio.speaker.setAudioOutputDevice(deviceId);
        } catch (e) { console.warn("Failed to set output device", e); }
    }
  }, [device]);

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
      setError(`${err.message} (${err.code})`);
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

  const makeCall = useCallback((number: string, identity?: string, siteId?: string) => {
    if (!device) return;
    const formattedNumber = formatPhoneNumber(number);
    setCallState('dialing');
    
    const connection = device.connect({ 
        To: formattedNumber, 
        AgentId: identity || 'Unknown',
        SiteId: siteId || 'site_alpha'
    });
    
    setActiveConnection(connection);
    
    connection.on('accept', () => setCallState('connected'));
    connection.on('disconnect', () => { setCallState('idle'); setActiveConnection(null); });
    connection.on('error', (e: any) => { 
        setCallState('idle'); 
        setActiveConnection(null); 
        setError("Call failed: " + e.message); 
    });
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
  selectedMic,
  selectedSpeaker,
  refreshDevices,
  systemConfig, 
  setSystemConfig,
  isDeviceReady, 
  onRefreshConnection,
  geoState,
  lastError
}: { 
  user: AppUser, 
  handleLogout: () => void, 
  setTwilioToken: (s: string) => void,
  inputDevices: AudioDevice[], 
  outputDevices: AudioDevice[], 
  setAudioInput: (id: string) => void, 
  setAudioOutput: (id: string) => void, 
  selectedMic: string,
  selectedSpeaker: string,
  refreshDevices: () => void,
  systemConfig: SystemConfig, 
  setSystemConfig: (c: SystemConfig) => void,
  isDeviceReady: boolean, 
  onRefreshConnection: (i: string) => void,
  geoState: { location: { lat: number, lng: number } | null, isWithinFence: boolean | null },
  lastError: string | null
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
                  
                  {lastError && (
                     <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                        <p className="text-xs text-rose-600 dark:text-rose-300 font-mono flex items-center gap-1">
                           <AlertCircle className="w-3 h-3" /> {lastError}
                        </p>
                     </div>
                  )}
                  
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
                     <select value={selectedMic} onChange={e => setAudioInput(e.target.value)} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm dark:text-white">
                        {inputDevices.length === 0 && <option value="">No inputs found</option>}
                        {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                        <Volume2 className="w-3 h-3" /> Speaker
                     </label>
                     <select value={selectedSpeaker} onChange={e => setAudioOutput(e.target.value)} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm dark:text-white">
                        {outputDevices.length === 0 && <option value="">No outputs found</option>}
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

// ... (Rest of components NavButton, DialerView, etc. remain unchanged from previous correct output) ...
const NavButton = ({ icon: Icon, label, active, onClick, mobile }: { icon: any, label: string, active: boolean, onClick: () => void, mobile?: boolean }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${mobile ? 'flex-col justify-center text-[10px] w-full' : 'w-full'} ${active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
  >
    <Icon className={`${mobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
    <span className={mobile ? '' : ''}>{label}</span>
  </button>
);

const DialerView = ({ dialString, setDialString, handleCallStart, deviceReady, activeView, setActiveView, history, clearHistory, retryConnection, error }: any) => {
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
           <div className="mt-4 flex flex-col items-center gap-2 cursor-pointer" onClick={retryConnection}>
              <div className="flex items-center gap-2 text-rose-500 text-sm font-bold">
                  <WifiOff className="w-4 h-4" /> Service Offline (Tap to Retry)
              </div>
              {error && <span className="text-[10px] text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded max-w-[200px] text-center truncate">{error}</span>}
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
                  <div className="flex flex-col items-end gap-1">
                     <div className="text-xs text-slate-400 font-mono">
                        {log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </div>
                     {log.redirectedFrom && (
                        <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded flex items-center gap-0.5">
                           <Shuffle className="w-2 h-2" /> Route
                        </span>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

// ... (Keep ContactsView, AdminView, SetupView, GuestKioskView as they were) ...
const ContactsView = ({ user, setDialString, setActiveView }: any) => {
  const [filter, setFilter] = useState('');
  const filteredContacts = MOCK_CONTACTS.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.role.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right-4 duration-300">
       <div className="p-4 bg-white dark:bg-slate-800 shadow-sm z-10">
          <h2 className="text-2xl font-bold mb-4 dark:text-white">Contacts</h2>
          <div className="relative">
             <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
             <input type="text" placeholder="Search team..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all" />
          </div>
       </div>
       <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredContacts.map(contact => (
             <div key={contact.id} onClick={() => { setDialString(contact.phone); setActiveView('dialer'); }} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group border border-slate-100 dark:border-slate-700">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 relative">
                   {contact.avatar}
                   <div className="absolute bottom-0 right-0"><StatusIndicator status={contact.status} /></div>
                </div>
                <div className="flex-1">
                   <h3 className="font-bold text-slate-900 dark:text-white">{contact.name}</h3>
                   <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{contact.role}</span>
                      {contact.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> On Site</span>}
                   </div>
                </div>
                <button className="p-3 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"><Phone className="w-5 h-5" /></button>
             </div>
          ))}
          <div className="mt-6 h-64 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 relative">
             <UserMap users={filteredContacts} center={{ lat: DEFAULT_SYSTEM_CONFIG.siteLat, lng: DEFAULT_SYSTEM_CONFIG.siteLng }} />
             <div className="absolute top-2 left-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold shadow">Live Team Map</div>
          </div>
       </div>
    </div>
  );
};

const AdminView = ({ setGeneratedQrToken, generatedQrToken, routingRules, setRoutingRules, systemConfig, setSystemConfig }: any) => {
   const [activeTab, setActiveTab] = useState<'routing' | 'system'>('routing');
   return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right-4 duration-300">
         <div className="p-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold mb-4 dark:text-white flex items-center gap-2"><Shield className="w-6 h-6 text-indigo-600" /> Admin Console</h2>
            <div className="flex gap-4">
               <button onClick={() => setActiveTab('routing')} className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'routing' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Call Routing</button>
               <button onClick={() => setActiveTab('system')} className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'system' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>System Config</button>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'routing' ? (
               <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                     <p className="text-sm text-slate-500">Manage intelligent call routing rules.</p>
                     <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"><Plus className="w-4 h-4" /> New Rule</button>
                  </div>
                  {routingRules.map((rule: RoutingRule) => (
                     <div key={rule.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">{rule.name} {rule.isActive ? <span className="w-2 h-2 rounded-full bg-emerald-500"/> : <span className="w-2 h-2 rounded-full bg-slate-300"/>}</h3>
                              <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
                           </div>
                           <button onClick={() => setRoutingRules(routingRules.map((r: any) => r.id === rule.id ? {...r, isActive: !r.isActive} : r))} className={`w-10 h-6 rounded-full p-1 transition-colors ${rule.isActive ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${rule.isActive ? 'translate-x-4' : ''}`} /></button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                           <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">IF role={rule.criteria.targetRole} & status={rule.criteria.targetStatus}</span>
                           <ArrowRight className="w-3 h-3 text-slate-400 self-center" />
                           <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">REDIRECT {rule.action.redirectName}</span>
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <div className="space-y-6 max-w-2xl">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                     <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-500"><MapPin className="w-4 h-4" /> Site Geofence</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-400 mb-1">Site Name</label><input type="text" value={systemConfig.siteName} onChange={(e) => setSystemConfig({...systemConfig, siteName: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700" /></div>
                        <div><label className="block text-xs font-bold text-slate-400 mb-1">Radius (m)</label><input type="number" value={systemConfig.radiusMeters} onChange={(e) => setSystemConfig({...systemConfig, radiusMeters: parseInt(e.target.value)})} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700" /></div>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};

const SetupView = ({ generateSetupLink, generatedQrToken, setGeneratedQrToken }: any) => {
   const [manualId, setManualId] = useState('');
   const handleJoin = () => { if(manualId) window.location.search = `?setup_token=staff_id_${manualId}`; };
   return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 animate-in zoom-in duration-300">
         <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 text-center border border-slate-100 dark:border-slate-700">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30"><Radio className="w-10 h-10 text-white" /></div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome to SiteOS</h1>
            <p className="text-slate-500 mb-8">Secure communication & safety platform.</p>
            <div className="space-y-4">
               <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700"><QrCode className="w-12 h-12 text-slate-400 mx-auto mb-2" /><p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scan Site QR Code</p></div>
               <div className="flex gap-2"><input type="text" placeholder="e.g. 1 (Admin)" value={manualId} onChange={(e) => setManualId(e.target.value)} className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none border border-slate-200 dark:border-slate-700" /><button onClick={handleJoin} className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Join</button></div>
            </div>
         </div>
      </div>
   );
};

const GuestKioskView = ({ handleCallStart, setDialString, emergencyNumber }: any) => {
   return (
      <div className="h-full flex flex-col bg-slate-900 text-white p-6 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-900/50 to-transparent pointer-events-none" />
         <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8 max-w-lg mx-auto w-full">
            <div className="text-center mb-8"><h1 className="text-4xl font-bold mb-2">How can we help?</h1><p className="text-indigo-200">Tap to connect instantly.</p></div>
            <button onClick={() => { setDialString('100'); handleCallStart('100'); }} className="w-full p-6 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-3xl border border-white/10 flex items-center gap-6 transition-all group">
               <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform"><ConciergeBell className="w-8 h-8 text-white" /></div>
               <div className="text-left"><h3 className="text-2xl font-bold">Front Desk</h3><p className="text-indigo-200">General inquiries</p></div><ArrowRight className="w-6 h-6 ml-auto opacity-50 group-hover:opacity-100 transition-all" />
            </button>
            <button onClick={() => { setDialString('AI_AGENT'); handleCallStart('AI_AGENT'); }} className="w-full p-6 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 hover:from-violet-600/30 hover:to-fuchsia-600/30 backdrop-blur-md rounded-3xl border border-white/10 flex items-center gap-6 transition-all group">
               <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30 group-hover:scale-110 transition-transform"><Bot className="w-8 h-8 text-white" /></div>
               <div className="text-left"><h3 className="text-2xl font-bold">AI Concierge</h3><p className="text-fuchsia-200">24/7 Recommendations</p></div><Zap className="w-6 h-6 ml-auto text-yellow-400 group-hover:animate-pulse" />
            </button>
            <button onClick={() => { setDialString(emergencyNumber); handleCallStart(emergencyNumber); }} className="w-full mt-auto p-4 bg-rose-500/20 hover:bg-rose-500/30 backdrop-blur-md rounded-2xl border border-rose-500/30 flex items-center justify-center gap-3 transition-all text-rose-300 hover:text-white"><AlertCircle className="w-6 h-6" /><span className="font-bold text-lg">Emergency</span></button>
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
  
  // Audio State
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  const [toast, setToast] = useState<{msg:string, type:'success'|'info'|'error'} | null>(null);
  const showToast = (msg: string, type: 'success'|'info'|'error' = 'info') => {
      setToast({msg, type});
      setTimeout(() => setToast(null), 3000);
  };

  const fetchTwilioToken = useCallback(async (identity: string) => {
     // Don't auto-fetch if we have a manual token that looks like a JWT (very long)
     if(twilioToken.length > 200 && !systemConfig.tokenEndpoint.includes('localhost')) {
        console.log("Using manual token, skipping fetch");
        return;
     }

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
  }, [systemConfig.tokenEndpoint, currentUser, twilioToken]);

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
    setAudioInput, // Still needed for dynamic switching
    setAudioOutput,
    incomingConnection,
    error: voiceError
  } = useTwilioVoice(twilioToken, () => {
      console.log("Token expired, refreshing...");
      if (currentUser) fetchTwilioToken(currentUser.name);
  }, selectedMic, selectedSpeaker);

  // Manual handlers to update app state + device
  const handleSetAudioInput = (id: string) => {
     setSelectedMic(id);
     setAudioInput(id); // Try to set on device immediately
  };
  
  const handleSetAudioOutput = (id: string) => {
     setSelectedSpeaker(id);
     setAudioOutput(id);
  };

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
      let target = number || dialString;
      if (!target) return;
      
      // --- Client-Side Routing Logic (Simulation) ---
      // 1. Check if target is in contacts
      const targetContact = MOCK_CONTACTS.find(c => c.phone === target || c.phone.endsWith(target));
      let redirectedFrom = undefined;

      if (targetContact) {
         // 2. Check rules
         const matchedRule = routingRules.find(rule => 
            rule.isActive &&
            (rule.criteria.targetRole === 'any' || rule.criteria.targetRole === targetContact.role) &&
            (rule.criteria.targetStatus === 'any' || rule.criteria.targetStatus === targetContact.status)
         );

         if (matchedRule) {
            console.log("Applying Routing Rule:", matchedRule.name);
            showToast(`Rerouting: ${matchedRule.name}`, 'info');
            redirectedFrom = target;
            target = matchedRule.action.redirectNumber;
            // Short delay to show the user what happened
            setTimeout(() => {
               makeCall(target, currentUser?.name, currentUser?.siteId);
            }, 800);
         } else {
            makeCall(target, currentUser?.name, currentUser?.siteId);
         }
      } else {
         makeCall(target, currentUser?.name, currentUser?.siteId);
      }

      setCallHistory(prev => [{
          id: Date.now().toString(),
          number: target,
          name: MOCK_CONTACTS.find(c => c.phone === target)?.name || 'Unknown',
          direction: 'outbound',
          timestamp: new Date(),
          duration: 0,
          redirectedFrom
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
       <aside className="hidden sm:flex flex-col items-center w-20 py-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-20">
          <div className="mb-8 p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30"><Radio className="w-8 h-8 text-white animate-pulse" /></div>
          <nav className="flex-1 flex flex-col gap-4 w-full px-2">
             <NavButton icon={Phone} label="Dialer" active={activeView === 'dialer'} onClick={() => setActiveView('dialer')} />
             <NavButton icon={Users} label="Contacts" active={activeView === 'contacts'} onClick={() => setActiveView('contacts')} />
             {currentUser?.role === 'admin' && <NavButton icon={Shield} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />}
             <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} />
          </nav>
          <div className="mt-auto flex flex-col gap-4 items-center">
             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs relative group cursor-pointer" title={currentUser?.name}>
                {currentUser?.avatar || '?'}<div className="absolute bottom-0 right-0"><StatusIndicator status={status} /></div>
             </div>
             <button onClick={handleLogout} className="text-slate-400 hover:text-rose-500 transition-colors p-2"><LogOut className="w-6 h-6" /></button>
          </div>
       </aside>

       <main className="flex-1 flex flex-col relative overflow-hidden">
          <header className="sm:hidden h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-950 z-20">
             <div className="flex items-center gap-2"><Radio className="w-6 h-6 text-indigo-600" /><span className="font-bold text-lg tracking-tight">SiteOS</span></div>
             <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs relative">{currentUser?.avatar}<div className="absolute bottom-0 right-0"><StatusIndicator status={status} /></div></div>
          </header>

          <div className="flex-1 overflow-hidden relative">
             {activeView === 'dialer' && <DialerView dialString={dialString} setDialString={setDialString} handleCallStart={handleCallStart} deviceReady={deviceReady} activeView={activeView} setActiveView={setActiveView} history={callHistory} clearHistory={clearHistory} retryConnection={() => fetchTwilioToken(currentUser?.name || '')} error={voiceError} />}
             {activeView === 'contacts' && currentUser && <ContactsView user={currentUser} setDialString={setDialString} setActiveView={setActiveView} />}
             {activeView === 'admin' && <AdminView setGeneratedQrToken={setGeneratedQrToken} generatedQrToken={generatedQrToken} routingRules={routingRules} setRoutingRules={setRoutingRules} systemConfig={systemConfig} setSystemConfig={setSystemConfig} />}
             {activeView === 'settings' && currentUser && <SettingsView user={currentUser} handleLogout={handleLogout} setTwilioToken={setTwilioToken} inputDevices={inputDevices} outputDevices={outputDevices} setAudioInput={handleSetAudioInput} setAudioOutput={handleSetAudioOutput} selectedMic={selectedMic} selectedSpeaker={selectedSpeaker} refreshDevices={getDevices} geoState={{location, isWithinFence}} systemConfig={systemConfig} setSystemConfig={setSystemConfig} isDeviceReady={deviceReady} onRefreshConnection={fetchTwilioToken} lastError={voiceError} />}
             {activeView === 'setup' && <SetupView generateSetupLink={() => {}} generatedQrToken={null} setGeneratedQrToken={setGeneratedQrToken} />}
             {activeView === 'guest-kiosk' && <GuestKioskView handleCallStart={handleCallStart} setDialString={setDialString} emergencyNumber={systemConfig.emergencyNumber} />}
          </div>

          {callState === 'incoming' && incomingConnection && (
             <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mb-8 animate-pulse"><PhoneIncoming className="w-16 h-16 text-white" /></div>
                <h2 className="text-3xl font-bold text-white mb-2">{incomingConnection.parameters.From || 'Unknown Caller'}</h2><p className="text-indigo-300 mb-12 animate-pulse">Incoming Call...</p>
                <div className="flex gap-8"><button onClick={rejectCall} className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-rose-500/40"><PhoneOff className="w-8 h-8" /></button><button onClick={acceptCall} className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-emerald-500/40 animate-bounce"><Phone className="w-8 h-8" /></button></div>
             </div>
          )}

          {callState === 'connected' && (
             <div className="absolute bottom-0 left-0 right-0 bg-indigo-600 text-white p-4 z-40 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom">
                 <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse"><Activity className="w-6 h-6" /></div><div><h3 className="font-bold text-lg">Connected</h3><p className="text-indigo-200 font-mono">{formatDuration(callDuration)}</p></div></div>
                 <div className="flex items-center gap-4"><button className="p-3 rounded-full hover:bg-white/10 transition-colors"><MicOff className="w-6 h-6" /></button><button onClick={endCall} className="p-4 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors shadow-lg"><PhoneOff className="w-6 h-6" /></button></div>
             </div>
          )}

          <nav className="sm:hidden h-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-20">
             <NavButton icon={Phone} label="Keypad" active={activeView === 'dialer'} onClick={() => setActiveView('dialer')} mobile />
             <NavButton icon={Users} label="Contacts" active={activeView === 'contacts'} onClick={() => setActiveView('contacts')} mobile />
             {currentUser?.role === 'admin' && <NavButton icon={Shield} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} mobile />}
             <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} mobile />
          </nav>
          
          {toast && (
             <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-[70] animate-in slide-in-from-top-4 fade-in flex items-center gap-2 font-bold text-sm ${toast.type === 'success' ? 'bg-emerald-500 text-white' : toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : toast.type === 'error' ? <AlertCircle className="w-4 h-4"/> : <Info className="w-4 h-4"/>}{toast.msg}
             </div>
          )}
       </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
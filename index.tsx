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
  Power
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
  token: 'mock_token',
  avatar: 'AM'
};

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

// Formats numbers to E.164 if they look like AU numbers
const formatPhoneNumber = (input: string) => {
  const cleaned = input.replace(/\s+/g, '').replace(/-/g, '');
  
  // Internal Extensions or Short codes (e.g. 100, 911, 000)
  if (cleaned.length < 5) return cleaned;
  
  // Already International
  if (cleaned.startsWith('+')) return cleaned;
  
  // AU Standard: 04xx... or 02xx...
  if (cleaned.startsWith('0')) {
     return `+61${cleaned.substring(1)}`;
  }
  
  // Missing Leading 0 but looks like AU (8-9 digits)
  if (cleaned.length >= 8 && cleaned.length <= 10 && !cleaned.startsWith('61')) {
     return `+61${cleaned}`;
  }

  // Pre-formatted 61...
  if (cleaned.startsWith('61')) {
     return `+${cleaned}`;
  }

  return input;
};

// Haversine formula to calculate distance in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
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
const UserMap = ({ users, center, zoom = 18 }: { users: Contact[], center: {lat:number, lng:number}, zoom?: number }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isGoogleReady, setIsGoogleReady] = useState(!!(window.google && window.google.maps));
  const [mapType, setMapType] = useState<'satellite' | 'roadmap'>('satellite');

  // Poll for Google Maps API if not ready
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

  // Initialize Map
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

  // Update Map Type
  useEffect(() => {
    if (mapInstance) {
      mapInstance.setMapTypeId(mapType);
    }
  }, [mapInstance, mapType]);

  // Update Markers & Auto-Bounds
  useEffect(() => {
    if (mapInstance && isGoogleReady && window.google?.maps) {
      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      
      const bounds = new window.google.maps.LatLngBounds();
      let hasUsers = false;

      // Add Site Marker (Center) - Always present
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

      // Add User Markers
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

        const infoWindow = new window.google.maps.InfoWindow({
           content: `<div style="color: black; padding: 4px;"><strong>${u.name}</strong><br/>${u.role.toUpperCase()}<br/><span style="color:${color}">● ${u.status}</span></div>`
        });

        marker.addListener("click", () => {
           infoWindow.open(mapInstance, marker);
        });

        markersRef.current.push(marker);
      });
      
      // Auto Zoom Logic
      if (hasUsers && users.length > 1) {
          mapInstance.fitBounds(bounds);
      } else if (users.length === 1 && users[0].location) {
          mapInstance.panTo(users[0].location);
          mapInstance.setZoom(19);
      } else {
          // No users found or just center
          mapInstance.panTo(center);
          mapInstance.setZoom(zoom);
      }
    }
  }, [mapInstance, users, center.lat, center.lng, zoom, isGoogleReady]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
      } else {
          document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen API not supported", e);
    }
  };

  if (!isGoogleReady) return <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono text-xs">Connecting to Satellites...</div>;

  return (
    <div ref={containerRef} className="w-full h-full relative rounded-xl overflow-hidden group bg-slate-900">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 sm:right-14 flex flex-col gap-2 z-[50]">
        <button 
           onClick={() => setMapType(prev => prev === 'satellite' ? 'roadmap' : 'satellite')}
           className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
           title="Toggle Map View"
        >
            {mapType === 'satellite' ? <Globe className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
        </button>
        <button 
           onClick={toggleFullscreen}
           className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
           title="Fullscreen"
        >
            <Maximize className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ... (Hooks) ...
const useGeolocationHeartbeat = (
  config: SystemConfig, 
  currentUser: AppUser | null, 
  setStatus: (s: UserStatus) => void,
  showToast: (m: string, t: 'success'|'info'|'error') => void
) => {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isWithinFence, setIsWithinFence] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string>('unknown');

  const sendLocalNotification = (title: string, body: string) => {
    showToast(`${title}: ${body}`, 'info');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  };

  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    try {
      navigator.permissions.query({ name: 'geolocation' as any }).then(result => {
          setPermission(result.state);
      });
    } catch (e) {
      console.warn("Permissions API not fully supported");
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });

        const distance = calculateDistance(
          latitude, longitude, 
          config.siteLat, config.siteLng
        );
        
        const isInside = distance <= config.radiusMeters;

        if (isWithinFence !== isInside) {
           setIsWithinFence(isInside);
           if (isInside) {
              setStatus('available');
              sendLocalNotification("SiteOS Geofence", "You have entered the site. Status set to Available.");
           } else {
              setStatus('offline');
              sendLocalNotification("SiteOS Geofence", "You have left the site. Status set to Offline.");
           }
        }
      },
      (err) => {
        console.warn("[Geo Heartbeat] Error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [config, isWithinFence, setStatus]);

  useEffect(() => {
    if (!currentUser) return;
    checkLocation();
    const intervalId = setInterval(checkLocation, config.heartbeatMs);
    return () => clearInterval(intervalId);
  }, [config, currentUser, checkLocation]);

  return { location, isWithinFence, permission };
};

const useTwilioVoice = (token: string | null, onTokenExpired?: () => void) => {
  const [device, setDevice] = useState<any>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeConnection, setActiveConnection] = useState<any>(null);
  const [incomingConnection, setIncomingConnection] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<any>(null);

  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);

  useEffect(() => {
    if (!token || !window.Twilio) {
       setDeviceReady(false);
       if (!window.Twilio) console.warn("Twilio SDK not loaded");
       return;
    }

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
      
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
           const inputs = devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Default Mic', kind: 'audioinput' as const }));
           const outputs = devices.filter(d => d.kind === 'audiooutput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Default Speaker', kind: 'audiooutput' as const }));
           setInputDevices(inputs);
           setOutputDevices(outputs);
        });
      }
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
      console.log('Incoming call from:', connection.parameters.From);
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
      try {
        newDevice.destroy();
      } catch (e) {
        console.warn("Error destroying device", e);
      }
    };
  }, [token]);

  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const makeCall = useCallback((number: string) => {
    if (!device) return;
    
    // Auto-Format Number to E.164 before calling
    const formattedNumber = formatPhoneNumber(number);
    console.log(`Dialing: ${formattedNumber}`);

    const params = { 
      To: formattedNumber,
      SiteId: MOCK_ADMIN_USER.siteId,
      AgentId: MOCK_ADMIN_USER.id 
    };
    
    setCallState('dialing');
    
    const connection = device.connect({ params });
    setActiveConnection(connection);

    connection.on('accept', () => {
      setCallState('connected');
    });

    connection.on('disconnect', () => {
      setCallState('idle');
      setActiveConnection(null);
    });
    
    connection.on('error', (e: any) => {
       console.error("Connection error", e);
       setCallState('idle');
       setActiveConnection(null);
       setError("Call failed: " + e.message);
    });

  }, [device]);

  const endCall = useCallback(() => {
    if (activeConnection) {
      activeConnection.disconnect();
    } else if (incomingConnection) {
      incomingConnection.reject();
    } else if (device) {
       device.disconnectAll();
    }
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

  const sendDigits = useCallback((digits: string) => {
     if(activeConnection) {
        activeConnection.sendDigits(digits);
     }
  }, [activeConnection]);
  
  const setAudioInput = useCallback((deviceId: string) => {
     if(device && device.audio) {
        device.audio.setInputDevice(deviceId);
     }
  }, [device]);

  const setAudioOutput = useCallback((deviceId: string) => {
     if(device && device.audio && device.audio.speaker) {
        device.audio.speaker.setAudioOutputDevice(deviceId);
     }
  }, [device]);

  return {
    device,
    deviceReady,
    callState,
    callDuration,
    error,
    activeConnection,
    incomingConnection,
    inputDevices,
    outputDevices,
    makeCall,
    endCall,
    acceptCall,
    rejectCall,
    sendDigits,
    setAudioInput,
    setAudioOutput
  };
};

const DialerView = ({ 
  dialString, 
  setDialString, 
  handleCallStart, 
  deviceReady,
  activeView,
  setActiveView,
  history,
  clearHistory 
}: {
  dialString: string;
  setDialString: React.Dispatch<React.SetStateAction<string>>;
  handleCallStart: (n?: string) => void;
  deviceReady: boolean;
  activeView: View;
  setActiveView: (v: View) => void;
  history: CallLog[];
  clearHistory: () => void;
}) => {
  const handleKeypadClick = (val: string) => {
    setDialString(prev => prev + val);
  };
  
  const handleBackspace = () => {
    setDialString(prev => prev.slice(0, -1));
  };

  return (
    <div className="h-full flex flex-col sm:flex-row animate-in slide-in-from-right-4 duration-300">
      <div className="flex-1 flex flex-col items-center justify-center p-6 border-r border-slate-100 dark:border-slate-800">
         {/* Display */}
         <div className="mb-8 w-full max-w-xs">
            <input 
              type="text" 
              value={dialString}
              onChange={(e) => setDialString(e.target.value)}
              className="w-full text-center text-3xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-300"
              placeholder="Enter Number..."
            />
            {dialString.length > 0 && (
               <button onClick={handleBackspace} className="mx-auto block text-slate-400 hover:text-rose-500 mt-2">
                  <XCircle className="w-6 h-6" />
               </button>
            )}
         </div>

         {/* Keypad */}
         <div className="grid grid-cols-3 gap-4 mb-8">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((digit) => (
              <KeypadButton key={digit} value={digit} onClick={handleKeypadClick} />
            ))}
         </div>

         {/* Call Button */}
         <button 
           onClick={() => handleCallStart()}
           disabled={!deviceReady && dialString.length > 0 && dialString !== 'AI_AGENT'}
           className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${deviceReady ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-slate-300 text-slate-500'}`}
         >
            <Phone className="w-8 h-8" />
         </button>
         {!deviceReady && <p className="text-xs text-rose-500 mt-4 font-bold animate-pulse">Voice Service Offline (Connecting...)</p>}
      </div>

      {/* History Side Panel */}
      <div className="w-full sm:w-80 bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 h-1/3 sm:h-full overflow-hidden">
         <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-500 text-sm uppercase tracking-wider flex items-center gap-2">
               <History className="w-4 h-4" /> Recent Calls
            </h3>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs text-rose-500 hover:text-rose-600">Clear</button>
            )}
         </div>
         <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {history.length === 0 ? (
               <div className="text-center text-slate-400 py-10 text-sm">No recent calls</div>
            ) : (
               history.map((log) => (
                  <div key={log.id} onClick={() => { setDialString(log.number); }} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500 cursor-pointer group transition-all">
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="font-bold text-slate-900 dark:text-white text-sm">{log.name}</p>
                           <p className="text-xs text-slate-500">{log.number}</p>
                        </div>
                        <span className="text-[10px] text-slate-400">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     </div>
                     <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        {log.direction === 'inbound' ? <PhoneIncoming className="w-3 h-3 text-emerald-500" /> : <Phone className="w-3 h-3 text-indigo-500 rotate-90" />}
                        <span>{formatDuration(log.duration)}</span>
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>
    </div>
  );
};

// ... (RuleEditorModal remains same) ...
const RuleEditorModal = ({ 
  initialRule, 
  contacts, 
  onClose, 
  onSave 
}: { 
  initialRule?: RoutingRule, 
  contacts: Contact[], 
  onClose: () => void, 
  onSave: (r: RoutingRule) => void 
}) => {
  const [name, setName] = useState(initialRule?.name || '');
  const [description, setDescription] = useState(initialRule?.description || '');
  const [targetRole, setTargetRole] = useState<Role | 'any'>(initialRule?.criteria.targetRole || 'any');
  const [targetStatus, setTargetStatus] = useState<UserStatus | 'any'>(initialRule?.criteria.targetStatus || 'any');
  const [locationState, setLocationState] = useState<'on-site' | 'off-site' | 'any'>(initialRule?.criteria.locationState || 'any');
  const [redirectName, setRedirectName] = useState(initialRule?.action.redirectName || '');
  const [redirectNumber, setRedirectNumber] = useState(initialRule?.action.redirectNumber || '');

  const handleSave = () => {
    const rule: RoutingRule = {
      id: initialRule?.id || Date.now().toString(),
      name,
      description,
      isActive: initialRule?.isActive ?? true,
      criteria: {
        targetRole,
        targetStatus,
        locationState,
        callerRole: 'any',
        targetUserId: 'any',
        callerUserId: 'any'
      },
      action: {
        redirectName,
        redirectNumber
      }
    };
    onSave(rule);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
       <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
             <h3 className="font-bold text-lg dark:text-white">{initialRule ? 'Edit Rule' : 'New Routing Rule'}</h3>
             <button onClick={onClose}><XCircle className="w-6 h-6 text-slate-400" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Rule Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Target Role</label>
                   <select value={targetRole} onChange={e => setTargetRole(e.target.value as any)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                      <option value="any">Any</option>
                      <option value="staff">Staff</option>
                      <option value="contractor">Contractor</option>
                      <option value="guest">Guest</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Target Status</label>
                   <select value={targetStatus} onChange={e => setTargetStatus(e.target.value as any)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                      <option value="any">Any</option>
                      <option value="available">Available</option>
                      <option value="busy">Busy</option>
                      <option value="offline">Offline</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Location</label>
                   <select value={locationState} onChange={e => setLocationState(e.target.value as any)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                      <option value="any">Any</option>
                      <option value="on-site">On Site</option>
                      <option value="off-site">Off Site</option>
                   </select>
                </div>
             </div>

             <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-sm mb-3 dark:text-white">Action: Redirect To</h4>
                <div className="space-y-3">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Redirect Name</label>
                      <input type="text" value={redirectName} onChange={e => setRedirectName(e.target.value)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Redirect Number</label>
                      <input type="text" value={redirectNumber} onChange={e => setRedirectNumber(e.target.value)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                   </div>
                </div>
             </div>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
             <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Cancel</button>
             <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">Save Rule</button>
          </div>
       </div>
    </div>
  );
};

const AdminView = ({ 
  setGeneratedQrToken, 
  generatedQrToken,
  routingRules, 
  setRoutingRules,
  systemConfig,
  setSystemConfig
}: { 
  setGeneratedQrToken: (s: string | null) => void, 
  generatedQrToken: string | null,
  routingRules: RoutingRule[], 
  setRoutingRules: React.Dispatch<React.SetStateAction<RoutingRule[]>>,
  systemConfig: SystemConfig,
  setSystemConfig: React.Dispatch<React.SetStateAction<SystemConfig>>
}) => {
  const [selectedMapUsers, setSelectedMapUsers] = useState<Contact[]>(MOCK_CONTACTS);
  const [showMapModal, setShowMapModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'routing' | 'system'>('map');
  const [editingRuleId, setEditingRuleId] = useState<string | 'new' | null>(null);

  // Local state for system form to avoid excessive re-renders/writes
  const [localSysConfig, setLocalSysConfig] = useState<SystemConfig>(systemConfig);

  const handleSystemSave = () => {
    setSystemConfig(localSysConfig);
    // Visual feedback handled by App toast in real scenario, here just updated state
  };

  const handleProvision = (contact: Contact) => {
    const tokenPayload = `staff_id_${contact.id}`;
    // Use full href as base
    const baseUrl = window.location.href.split('?')[0]; 
    setGeneratedQrToken(`${baseUrl}?setup_token=${tokenPayload}`);
  };

  const handleLocate = (contact: Contact) => {
    setSelectedMapUsers([contact]);
    setShowMapModal(true);
  };

  const toggleRule = (id: string) => {
    setRoutingRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const deleteRule = (id: string) => {
    setRoutingRules(prev => prev.filter(r => r.id !== id));
  };

  const saveRule = (rule: RoutingRule) => {
    setRoutingRules(prev => {
       const exists = prev.find(r => r.id === rule.id);
       if (exists) return prev.map(r => r.id === rule.id ? rule : r);
       return [...prev, rule];
    });
  };

  // MEMOIZED filtered contacts to prevent map flickering on parent re-renders
  const filteredContacts = useMemo(() => 
    MOCK_CONTACTS.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm]
  );

  const stats = useMemo(() => ({
     active: MOCK_CONTACTS.filter(c => c.status === 'available').length,
     busy: MOCK_CONTACTS.filter(c => c.status === 'busy').length,
     total: MOCK_CONTACTS.length
  }), []);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 animate-in slide-in-from-right-4 duration-300 relative">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
             <Shield className="w-5 h-5 text-indigo-500" /> Admin Console
           </h2>
           <p className="text-sm text-slate-500">Manage provisioning, routing, and monitor staff.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto flex-nowrap scrollbar-none">
         <button 
           onClick={() => setActiveTab('map')}
           className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'map' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <Globe className="w-4 h-4" /> Live Operations
         </button>
         <button 
           onClick={() => setActiveTab('routing')}
           className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'routing' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <GitBranch className="w-4 h-4" /> Call Routing
         </button>
         <button 
           onClick={() => setActiveTab('system')}
           className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'system' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <Server className="w-4 h-4" /> System Config
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         
         {activeTab === 'map' && (
           <>
             {/* Stats Row */}
             <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                   <p className="text-xs text-slate-400 font-bold uppercase">Online</p>
                   <p className="text-xl sm:text-2xl font-bold text-emerald-500">{stats.active}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                   <p className="text-xs text-slate-400 font-bold uppercase">Busy</p>
                   <p className="text-xl sm:text-2xl font-bold text-rose-500">{stats.busy}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                   <p className="text-xs text-slate-400 font-bold uppercase">Total Staff</p>
                   <p className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-white">{stats.total}</p>
                </div>
             </div>

             {/* Main Map Dashboard */}
             <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden h-64 relative">
                 <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    Live Operations Map
                 </div>
                 {/* Pass filteredContacts here so map updates with search */}
                 <UserMap users={filteredContacts} center={{lat: systemConfig.siteLat, lng: systemConfig.siteLng}} zoom={16} />
             </div>

             {/* Staff List */}
             <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                   <h3 className="font-bold text-slate-900 dark:text-white">Staff Provisioning</h3>
                   <div className="relative">
                     <Search className="w-4 h-4 absolute left-2 top-2 text-slate-400" />
                     <input 
                       type="text" 
                       placeholder="Filter staff & map..." 
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="pl-8 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg border-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm" 
                     />
                   </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                   {filteredContacts.map(contact => (
                      <div key={contact.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 relative">
                               {contact.avatar}
                               <div className="absolute -bottom-1 -right-1">
                                  <StatusIndicator status={contact.status} />
                               </div>
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-900 dark:text-white">{contact.name}</p>
                               <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> 
                                  {contact.location ? `${contact.location.lat.toFixed(4)}, ${contact.location.lng.toFixed(4)}` : 'No Location'}
                               </p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleLocate(contact)}
                              className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              title="Locate on Map"
                            >
                               <LocateFixed className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleProvision(contact)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                            >
                               <QrCode className="w-3 h-3" /> Provision
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           </>
         )}

         {/* ... other tabs ... */}
         {activeTab === 'routing' && (
            <div className="space-y-6">
               <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 rounded-xl flex gap-3">
                  <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-indigo-900 dark:text-indigo-200">
                     <p className="font-bold mb-1">How Routing Works</p>
                     <p className="opacity-80">Rules are evaluated from top to bottom. The first rule that matches both the target's status and the caller's context will automatically redirect the call.</p>
                  </div>
               </div>

               <div className="space-y-4">
                  {routingRules.map(rule => (
                     <div key={rule.id} className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all p-5 ${rule.isActive ? 'border-indigo-500 ring-1 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>
                        <div className="flex items-start justify-between mb-4">
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${rule.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                 <GitBranch className="w-5 h-5" />
                              </div>
                              <div>
                                 <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {rule.name}
                                    <button onClick={() => setEditingRuleId(rule.id)} className="text-[10px] text-indigo-500 hover:underline">Edit</button>
                                 </h3>
                                 <div className="flex flex-wrap gap-2 text-xs mt-1">
                                    {rule.criteria.targetRole && rule.criteria.targetRole !== 'any' && <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">Target: {rule.criteria.targetRole}</span>}
                                    {rule.criteria.targetStatus && rule.criteria.targetStatus !== 'any' && <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">Status: {rule.criteria.targetStatus}</span>}
                                    {rule.criteria.locationState && rule.criteria.locationState !== 'any' && <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">Loc: {rule.criteria.locationState}</span>}
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <button onClick={() => deleteRule(rule.id)} className="text-slate-300 hover:text-rose-500 p-1">
                                 <Trash2 className="w-5 h-5" />
                              </button>
                              <button onClick={() => toggleRule(rule.id)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                 {rule.isActive ? <ToggleRight className="w-8 h-8 text-indigo-500" /> : <ToggleLeft className="w-8 h-8" />}
                              </button>
                           </div>
                        </div>
                        
                        <p className="text-sm text-slate-500 mb-4">{rule.description}</p>
                        
                        <div className="flex items-center gap-3 text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                           <span className="font-bold text-slate-700 dark:text-slate-300">Action:</span>
                           <div className="flex items-center gap-2 text-slate-500">
                              <span>Redirect to</span>
                              <ArrowRight className="w-4 h-4" />
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{rule.action.redirectName}</span>
                              <span className="text-xs font-mono">({rule.action.redirectNumber})</span>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>

               <button 
                  onClick={() => setEditingRuleId('new')}
                  className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-400 font-bold hover:border-indigo-500 hover:text-indigo-500 transition-colors"
               >
                  <Plus className="w-5 h-5" /> Configure New Rule
               </button>
            </div>
         )}

         {activeTab === 'system' && (
           <div className="space-y-6">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                 <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-500" /> Site Configuration
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Site Name</label>
                       <input 
                         type="text" 
                         value={localSysConfig.siteName}
                         onChange={e => setLocalSysConfig({...localSysConfig, siteName: e.target.value})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Emergency Number</label>
                       <input 
                         type="text" 
                         value={localSysConfig.emergencyNumber}
                         onChange={e => setLocalSysConfig({...localSysConfig, emergencyNumber: e.target.value})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Latitude</label>
                       <input 
                         type="number" 
                         step="0.000001"
                         value={localSysConfig.siteLat}
                         onChange={e => setLocalSysConfig({...localSysConfig, siteLat: parseFloat(e.target.value)})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Longitude</label>
                       <input 
                         type="number" 
                         step="0.000001"
                         value={localSysConfig.siteLng}
                         onChange={e => setLocalSysConfig({...localSysConfig, siteLng: parseFloat(e.target.value)})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Geofence Radius (meters)</label>
                       <input 
                         type="number" 
                         value={localSysConfig.radiusMeters}
                         onChange={e => setLocalSysConfig({...localSysConfig, radiusMeters: parseInt(e.target.value)})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                       />
                    </div>
                 </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                 <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-500" /> Twilio Backend
                 </h3>
                 <div className="space-y-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Token Generation Endpoint</label>
                       <input 
                         type="text" 
                         value={localSysConfig.tokenEndpoint}
                         onChange={e => setLocalSysConfig({...localSysConfig, tokenEndpoint: e.target.value})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-sm"
                       />
                       <p className="text-[10px] text-slate-400 mt-1">URL to fetch access tokens from (GET request with ?identity=...)</p>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Voice TwiML Endpoint</label>
                       <input 
                         type="text" 
                         value={localSysConfig.voiceUrl}
                         onChange={e => setLocalSysConfig({...localSysConfig, voiceUrl: e.target.value})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-sm"
                       />
                       <p className="text-[10px] text-slate-400 mt-1">The Voice URL configured in your TwiML App (Reference only)</p>
                    </div>
                 </div>
              </div>

              {/* AI Agent Configuration Card */}
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                 <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-500" /> AI Voice Agent
                 </h3>
                 <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2">Agent Name</label>
                         <input 
                           type="text" 
                           value={localSysConfig.aiAgentName}
                           onChange={e => setLocalSysConfig({...localSysConfig, aiAgentName: e.target.value})}
                           className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                           placeholder="e.g. Concierge AI"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2">Model Provider</label>
                         <select 
                           value={localSysConfig.aiModelProvider}
                           onChange={e => setLocalSysConfig({...localSysConfig, aiModelProvider: e.target.value as any})}
                           className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                         >
                           <option value="ultravox">Ultravox (Default)</option>
                           <option value="twilio">Twilio Intelligence</option>
                           <option value="custom">Custom Endpoint</option>
                         </select>
                      </div>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">Service Endpoint</label>
                       <input 
                         type="text" 
                         value={localSysConfig.aiEndpoint}
                         onChange={e => setLocalSysConfig({...localSysConfig, aiEndpoint: e.target.value})}
                         className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-sm"
                         placeholder="wss://api.ultravox.ai/v1/connect"
                       />
                       <p className="text-[10px] text-slate-400 mt-1">WebSocket or REST Endpoint for the AI service</p>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">API Key</label>
                       <div className="relative">
                         <input 
                           type="password" 
                           value={localSysConfig.aiApiKey}
                           onChange={e => setLocalSysConfig({...localSysConfig, aiApiKey: e.target.value})}
                           className="w-full p-2 pr-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-sm"
                           placeholder="sk-..."
                         />
                         <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex justify-end">
                 <button onClick={handleSystemSave} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2">
                    <Save className="w-5 h-5" /> Save Configuration
                 </button>
              </div>
           </div>
         )}
      </div>

      {/* Editing Modal */}
      {editingRuleId && (
         <RuleEditorModal 
            initialRule={editingRuleId === 'new' ? undefined : routingRules.find(r => r.id === editingRuleId)}
            contacts={MOCK_CONTACTS}
            onClose={() => setEditingRuleId(null)}
            onSave={saveRule}
         />
      )}

      {/* Map Modal Popup */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2">
                    <LocateFixed className="w-4 h-4 text-indigo-500" />
                    Locating: {selectedMapUsers.length === 1 ? selectedMapUsers[0].name : 'Multiple Users'}
                 </h3>
                 <button onClick={() => setShowMapModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <XCircle className="w-6 h-6 text-slate-400" />
                 </button>
              </div>
              <div className="flex-1 relative">
                 <UserMap 
                    users={selectedMapUsers} 
                    center={selectedMapUsers[0]?.location || {lat: systemConfig.siteLat, lng: systemConfig.siteLng}}
                    zoom={18}
                 />
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 flex justify-between">
                  <span>Last Seen: {selectedMapUsers[0]?.lastSeen || 'Unknown'}</span>
                  <span>Lat/Lng: {selectedMapUsers[0]?.location?.lat.toFixed(5)}, {selectedMapUsers[0]?.location?.lng.toFixed(5)}</span>
              </div>
           </div>
        </div>
      )}

      {/* QR Provisioning Modal - Added to fix button issue */}
      {generatedQrToken && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center space-y-6 animate-in zoom-in duration-300 border border-slate-100 w-full max-w-sm">
              <div className="w-full aspect-square bg-slate-100 rounded-lg flex items-center justify-center relative overflow-hidden group">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedQrToken)}`} 
                   alt="Scan to Login"
                   className="w-full h-full object-cover mix-blend-multiply"
                 />
              </div>
              <div className="text-center space-y-2">
                <p className="font-bold text-slate-900 text-lg flex items-center justify-center gap-2">
                   <Lock className="w-4 h-4 text-emerald-500" />
                   Provisioning Token Ready
                </p>
                <p className="text-slate-500 text-xs text-center px-4">
                  Scan with the target device to auto-configure.
                </p>
              </div>
              <button 
                onClick={() => setGeneratedQrToken(null)} 
                className="text-sm font-bold text-slate-500 hover:text-slate-900 w-full py-3 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Done
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick, mobile }: { icon: any, label: string, active: boolean, onClick: () => void, mobile?: boolean }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all ${active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'} ${mobile ? 'w-full' : 'w-12 h-12'}`}
  >
     <Icon className={mobile ? "w-6 h-6" : "w-6 h-6"} />
     {mobile && <span className="text-[10px] font-bold">{label}</span>}
  </button>
);

const App = () => {
  const [activeView, setActiveView] = useState<View>('dialer');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(MOCK_ADMIN_USER);
  const [dialString, setDialString] = useState('');
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(DEFAULT_ROUTING_RULES);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [generatedQrToken, setGeneratedQrToken] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [status, setStatus] = useState<UserStatus>('available');

  // Toasts
  const [toast, setToast] = useState<{msg:string, type:'success'|'info'|'error'} | null>(null);
  const showToast = (msg: string, type: 'success'|'info'|'error' = 'info') => {
      setToast({msg, type});
      setTimeout(() => setToast(null), 3000);
  };

  // Hooks
  const { location, isWithinFence } = useGeolocationHeartbeat(systemConfig, currentUser, setStatus, showToast);
  const { 
    deviceReady, 
    callState, 
    callDuration,
    makeCall, 
    endCall,
    acceptCall,
    rejectCall,
    incomingConnection
  } = useTwilioVoice(currentUser?.token || null);

  // Handlers
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

  const clearHistory = () => setCallHistory([]);

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex overflow-hidden font-sans select-none">
       {/* Sidebar Navigation (Desktop) */}
       <aside className="hidden sm:flex flex-col items-center w-20 py-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-20">
          <div className="mb-8 p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30">
             <Radio className="w-8 h-8 text-white animate-pulse" />
          </div>
          
          <nav className="flex-1 flex flex-col gap-4 w-full px-2">
             <NavButton icon={Phone} label="Dialer" active={activeView === 'dialer'} onClick={() => setActiveView('dialer')} />
             <NavButton icon={Users} label="Contacts" active={activeView === 'contacts'} onClick={() => setActiveView('contacts')} />
             <NavButton icon={Shield} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
             <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} />
          </nav>

          <div className="mt-auto flex flex-col gap-4 items-center">
             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs relative group cursor-pointer">
                {currentUser?.avatar}
                <div className="absolute bottom-0 right-0">
                   <StatusIndicator status={status} />
                </div>
             </div>
             <button className="text-slate-400 hover:text-rose-500 transition-colors">
                <LogOut className="w-6 h-6" />
             </button>
          </div>
       </aside>

       {/* Main Content Area */}
       <main className="flex-1 flex flex-col relative overflow-hidden">
          
          {/* Header (Mobile Only) */}
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

          {/* Active View Container */}
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
                />
             )}
             
             {activeView === 'contacts' && (
                <div className="p-6 h-full overflow-y-auto">
                   <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-500"/> Contacts</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {MOCK_CONTACTS.map(contact => (
                         <div key={contact.id} onClick={() => { setDialString(contact.phone); setActiveView('dialer'); }} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer group transition-all shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-lg text-slate-600 dark:text-slate-300 relative">
                                  {contact.avatar}
                                  <div className="absolute bottom-0 right-0">
                                     <StatusIndicator status={contact.status} />
                                  </div>
                               </div>
                               <div>
                                  <h3 className="font-bold text-slate-900 dark:text-white">{contact.name}</h3>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{contact.role}</p>
                               </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-slate-400 text-sm">
                               <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</span>
                               <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
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
             
             {/* Fallback for other views */}
             {(activeView === 'settings' || activeView === 'setup') && (
                <div className="flex items-center justify-center h-full text-slate-400">
                   <div className="text-center">
                      <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Settings View Placeholder</p>
                   </div>
                </div>
             )}
          </div>

          {/* Incoming Call Modal Overlay */}
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

          {/* Active Call Overlay */}
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

          {/* Bottom Nav (Mobile) */}
          <nav className="sm:hidden h-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-20">
             <NavButton icon={Phone} label="Keypad" active={activeView === 'dialer'} onClick={() => setActiveView('dialer')} mobile />
             <NavButton icon={Users} label="Contacts" active={activeView === 'contacts'} onClick={() => setActiveView('contacts')} mobile />
             <NavButton icon={Shield} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} mobile />
             <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} mobile />
          </nav>
          
          {/* Toast Notification */}
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
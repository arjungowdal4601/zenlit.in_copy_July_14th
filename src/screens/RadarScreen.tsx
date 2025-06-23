import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RadarUserCard } from '../components/radar/RadarUserCard';
import { LocationPermissionModal } from '../components/radar/LocationPermissionModal';
import { User, UserLocation, LocationPermissionStatus } from '../types';
import { MapPinIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { transformProfileToUser } from '../../lib/utils';
import { 
  getNearbyUsers, 
  checkLocationPermission,
  isGeolocationSupported,
  isSecureContext
} from '../lib/location';
import { locationToggleManager } from '../lib/locationToggle';

interface Props {
  userGender: 'male' | 'female';
  onNavigate: (tab: string) => void;
  onViewProfile: (user: User) => void;
  onMessageUser?: (user: User) => void;
}

export const RadarScreen: React.FC<Props> = ({ 
  userGender, 
  onNavigate, 
  onViewProfile, 
  onMessageUser 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionStatus>({
    granted: false,
    denied: false,
    pending: true
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // NEW: Location toggle state
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isTogglingLocation, setIsTogglingLocation] = useState(false);

  // Refs for cleanup
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    initializeRadar();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      locationToggleManager.cleanup();
    };
  }, []);

  const initializeRadar = async () => {
    try {
      console.log('🚀 RADAR DEBUG: Initializing radar screen');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('🚀 RADAR DEBUG: User not found:', userError);
        setIsLoading(false);
        return;
      }

      console.log('🚀 RADAR DEBUG: Current user found:', user.id);

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('🚀 RADAR DEBUG: Profile not found:', profileError);
        setIsLoading(false);
        return;
      }

      console.log('🚀 RADAR DEBUG: User profile loaded:', {
        id: profile.id,
        name: profile.name,
        hasLocation: !!(profile.latitude && profile.longitude),
        latitude: profile.latitude,
        longitude: profile.longitude
      });

      setCurrentUser(profile);

      // Initialize location toggle manager
      locationToggleManager.initialize(
        user.id,
        handleLocationUpdate,
        handleLocationError
      );

      // Check if user has location data (but don't auto-enable toggle)
      if (profile.latitude && profile.longitude) {
        console.log('🚀 RADAR DEBUG: User has existing location data, but toggle starts OFF');
        const userLocation: UserLocation = {
          latitude: profile.latitude,
          longitude: profile.longitude,
          timestamp: Date.now()
        };
        setCurrentLocation(userLocation);
        setLocationPermission({ granted: true, denied: false, pending: false });
        // Note: Toggle remains OFF by default, users must manually turn it ON
      } else {
        console.log('🚀 RADAR DEBUG: User has no location data');
        const permissionStatus = await checkLocationPermission();
        setLocationPermission(permissionStatus);
      }

      // Always start with empty users array since toggle is OFF by default
      setUsers([]);

    } catch (error) {
      console.error('🚀 RADAR DEBUG: Error initializing radar:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle location updates from toggle manager
  const handleLocationUpdate = useCallback(async (location: UserLocation | null) => {
    if (!mountedRef.current) return;

    setCurrentLocation(location);
    
    if (location && currentUser && isLocationEnabled) {
      // Load nearby users only if toggle is ON
      await loadNearbyUsers(currentUser.id, location);
    } else {
      // Clear users if location is null or toggle is OFF
      setUsers([]);
    }
  }, [currentUser, isLocationEnabled]);

  // Handle location errors from toggle manager
  const handleLocationError = useCallback((error: string) => {
    if (!mountedRef.current) return;
    
    console.error('Location error:', error);
    setLocationError(error);
  }, []);

  // Load users with exact coordinate match
  const loadNearbyUsers = async (currentUserId: string, location: UserLocation) => {
    if (!isLocationEnabled) {
      // Don't load users if toggle is OFF
      setUsers([]);
      return;
    }

    try {
      console.log('🔄 RADAR DEBUG: Loading users with exact coordinate match');
      
      setIsRefreshing(true);

      // Use the updated getNearbyUsers function with coordinate matching
      const result = await getNearbyUsers(currentUserId, location, 20);

      if (!result.success) {
        console.error('Error loading nearby users:', result.error);
        if (mountedRef.current) {
          setUsers([]);
        }
        return;
      }

      // Transform profiles to User type
      const transformedUsers: User[] = (result.users || []).map(profile => {
        const user = transformProfileToUser(profile);
        user.distance = 0; // All users in same bucket have distance 0
        return user;
      });

      console.log('🔄 RADAR DEBUG: Final users in same location bucket:', transformedUsers);

      if (mountedRef.current) {
        setUsers(transformedUsers);
        console.log(`🔄 RADAR DEBUG: Set ${transformedUsers.length} users in same location bucket`);
      }
    } catch (error) {
      console.error('🔄 RADAR DEBUG: Error in loadNearbyUsers:', error);
      if (mountedRef.current) {
        setUsers([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  // Handle location toggle change
  const handleLocationToggle = async (enabled: boolean) => {
    if (isTogglingLocation) return;

    setIsTogglingLocation(true);
    setLocationError(null);

    try {
      if (enabled) {
        console.log('🔄 Turning location toggle ON');
        
        // Set state immediately to ensure proper timing
        setIsLocationEnabled(true);
        
        // Turn ON location tracking
        const result = await locationToggleManager.turnOn();
        
        if (result.success) {
          console.log('✅ Location toggle turned ON successfully');
          
          // Explicitly load nearby users after successful toggle
          const managerState = locationToggleManager.getState();
          if (currentUser && managerState.currentLocation) {
            await loadNearbyUsers(currentUser.id, managerState.currentLocation);
          }
        } else {
          console.error('❌ Failed to turn ON location toggle:', result.error);
          setLocationError(result.error || 'Failed to enable location');
          setIsLocationEnabled(false);
        }
      } else {
        console.log('🔄 Turning location toggle OFF');
        
        // Turn OFF location tracking
        const result = await locationToggleManager.turnOff();
        
        if (result.success) {
          setIsLocationEnabled(false);
          setCurrentLocation(null);
          setUsers([]); // Clear users immediately
          console.log('✅ Location toggle turned OFF successfully');
        } else {
          console.error('❌ Failed to turn OFF location toggle:', result.error);
          setLocationError(result.error || 'Failed to disable location');
        }
      }
    } catch (error) {
      console.error('Location toggle error:', error);
      setLocationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsTogglingLocation(false);
    }
  };

  const handleViewProfile = (user: User) => {
    onViewProfile(user);
    onNavigate('profile');
  };

  const handleMessage = (user: User) => {
    if (onMessageUser) {
      onMessageUser(user);
    }
    onNavigate('messages');
  };

  const handleEnablePreciseLocation = () => {
    setShowLocationModal(true);
  };

  const handleRequestLocation = async () => {
    setIsRequestingLocation(true);
    setLocationError(null);

    try {
      // This will trigger the location toggle ON
      await handleLocationToggle(true);
      setShowLocationModal(false);
    } catch (error) {
      console.error('Location request error:', error);
      setLocationError('Failed to enable location');
    } finally {
      setIsRequestingLocation(false);
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    if (isRefreshing || !currentUser || !isLocationEnabled) return;
    
    setIsRefreshing(true);
    setLocationError(null);
    
    try {
      // Refresh location if toggle is ON
      const result = await locationToggleManager.refreshLocation();
      
      if (!result.success) {
        setLocationError(result.error || 'Failed to refresh location');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      setLocationError('Failed to refresh. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading radar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Title and Location Status */}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">People Nearby</h1>
              <div className="flex items-center gap-2 mt-1">
                {/* Location status */}
                <div className="flex items-center gap-1">
                  {isLocationEnabled ? (
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                  ) : (
                    <MapPinIcon className="w-4 h-4 text-gray-500" />
                  )}
                  <span className={`text-xs ${
                    isLocationEnabled ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {isLocationEnabled ? 'Location tracking active' : 'Location tracking off'}
                  </span>
                </div>
                
                {/* Update indicator */}
                {(isRefreshing || isTogglingLocation) && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-blue-400">
                      {isTogglingLocation ? 'Updating...' : 'Refreshing...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right side - Location Toggle and Refresh */}
            <div className="flex flex-col items-end gap-1 ml-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Show Nearby</span>
                <input
                  type="checkbox"
                  className="relative w-10 h-5 rounded-full appearance-none bg-gray-700 checked:bg-blue-600 transition-colors cursor-pointer before:absolute before:left-1 before:top-1 before:w-3 before:h-3 before:bg-white before:rounded-full before:transition-transform checked:before:translate-x-5 disabled:opacity-50 disabled:cursor-not-allowed"
                  checked={isLocationEnabled}
                  onChange={(e) => handleLocationToggle(e.target.checked)}
                  disabled={isTogglingLocation}
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={!isLocationEnabled || isRefreshing}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Location Status Info */}
      {!isLocationEnabled && (
        <div className="px-4 py-3 bg-blue-900/20 border-b border-blue-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-500" />
              <div>
                <span className="text-sm text-blue-400 font-medium">Location Tracking Off</span>
                <p className="text-xs text-blue-300">
                  Turn on &quot;Show Nearby&quot; to find people around you
                </p>
              </div>
            </div>
            {isGeolocationSupported() && isSecureContext() && (
              <button
                onClick={() => handleLocationToggle(true)}
                disabled={isTogglingLocation}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isTogglingLocation ? 'Enabling...' : 'Enable'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {locationError && (
        <div className="px-4 py-3 bg-red-900/20 border-b border-red-700/30">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-400">{locationError}</span>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="px-4 py-4 space-y-4 pb-20 overflow-y-auto">
        {isLocationEnabled ? (
          currentLocation ? (
            users.length > 0 ? (
              users.map((user) => (
                <RadarUserCard
                  key={user.id}
                  user={user}
                  onMessage={handleMessage}
                  onViewProfile={() => handleViewProfile(user)}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPinIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-400 mb-2">No one nearby right now</p>
                <p className="text-gray-500 text-sm">
                  Move around or check back later to find people nearby!
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-400 mb-2">Getting your location...</p>
              <p className="text-gray-500 text-sm mb-4">
                Please allow location access to find people nearby
              </p>
              <button
                onClick={handleEnablePreciseLocation}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
              >
                Enable Location
              </button>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPinIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-400 mb-2">Location tracking is off</p>
            <p className="text-gray-500 text-sm mb-4">
              Turn on &quot;Show Nearby&quot; to see people around you
            </p>
            <button
              onClick={() => handleLocationToggle(true)}
              disabled={isTogglingLocation}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {isTogglingLocation ? 'Enabling...' : 'Turn On Location'}
            </button>
          </div>
        )}
      </div>

      {/* Location Permission Modal */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onRequestLocation={handleRequestLocation}
        isRequesting={isRequestingLocation}
        error={locationError || undefined}
      />
    </div>
  );
};

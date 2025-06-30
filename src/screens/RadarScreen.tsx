import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RadarUserCard } from '../components/radar/RadarUserCard';
import { LocationPermissionModal } from '../components/radar/LocationPermissionModal';
import { UserProfile } from '../components/profile/UserProfile';
import { PostsGalleryScreen } from './PostsGalleryScreen';
import { User, UserLocation, LocationPermissionStatus, Post } from '../types';
import { MapPinIcon, ExclamationTriangleIcon, ArrowPathIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { transformProfileToUser } from '../../lib/utils';
import { getUserPosts } from '../lib/posts';
import { 
  getNearbyUsers, 
  getUsersByExactCoordinates, // NEW: Import the new function
  checkLocationPermission,
  isGeolocationSupported,
  isSecureContext
} from '../lib/location';
import { locationToggleManager } from '../lib/locationToggle';
import { BoltBadge } from '../components/common/BoltBadge';
import { isDemoUser } from '../utils/demo';

interface Props {
  userGender: 'male' | 'female';
  currentUser: any;
  onMessageUser?: (user: User) => void;
}

export const RadarScreen: React.FC<Props> = ({ 
  userGender, 
  currentUser,
  onMessageUser 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Demo user detection
  const isDemo = isDemoUser(currentUser?.email);
  
  // Location toggle state - get from persistent manager
  const [isLocationEnabled, setIsLocationEnabled] = useState(locationToggleManager.isEnabled());
  const [isTogglingLocation, setIsTogglingLocation] = useState(false);

  // Profile viewing state
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [selectedProfileUserPosts, setSelectedProfileUserPosts] = useState<Post[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showPostsGallery, setShowPostsGallery] = useState(false);

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Load users with exact coordinate match - MODIFIED for demo users
  const loadNearbyUsers = useCallback(async (currentUserId: string, location: UserLocation) => {
    if (!isLocationEnabled && !isDemo) {
      // Don't load users if toggle is OFF (unless it's a demo user)
      setUsers([]);
      return;
    }

    try {
      console.log('🔄 RADAR DEBUG: Loading users for demo user:', isDemo);
      
      setIsRefreshing(true);

      let allUsers: any[] = [];

      if (isDemo) {
        console.log('🔄 DEMO DEBUG: Loading users for demo user');
        
        // For demo users, get both nearby users AND users with coordinates 99, 99
        const [nearbyResult, demoUsersResult] = await Promise.all([
          // Get users in the same location bucket as the demo user
          getNearbyUsers(currentUserId, location, 20),
          // Get users with exact coordinates 99, 99
          getUsersByExactCoordinates(currentUserId, 99, 99, 20)
        ]);

        console.log('🔄 DEMO DEBUG: Nearby users result:', nearbyResult);
        console.log('🔄 DEMO DEBUG: Demo users (99,99) result:', demoUsersResult);

        // Combine users from both sources
        const nearbyUsers = nearbyResult.success ? (nearbyResult.users || []) : [];
        const demoUsers = demoUsersResult.success ? (demoUsersResult.users || []) : [];

        console.log('🔄 DEMO DEBUG: Nearby users count:', nearbyUsers.length);
        console.log('🔄 DEMO DEBUG: Demo users count:', demoUsers.length);

        // Combine and deduplicate users by ID
        const combinedUsers = [...nearbyUsers, ...demoUsers];
        const uniqueUsers = combinedUsers.filter((user, index, self) => 
          index === self.findIndex(u => u.id === user.id)
        );

        console.log('🔄 DEMO DEBUG: Combined unique users count:', uniqueUsers.length);
        allUsers = uniqueUsers;

      } else {
        // For regular users, use the existing logic
        const result = await getNearbyUsers(currentUserId, location, 20);

        if (!result.success) {
          console.error('Error loading nearby users:', result.error);
          if (mountedRef.current) {
            setUsers([]);
          }
          return;
        }

        allUsers = result.users || [];
      }

      // Transform profiles to User type
      const transformedUsers: User[] = allUsers.map(profile => {
        const user = transformProfileToUser(profile);
        user.distance = 0; // All users in same bucket have distance 0
        return user;
      });

      console.log('🔄 RADAR DEBUG: Final users for display:', transformedUsers);

      if (mountedRef.current) {
        setUsers(transformedUsers);
        console.log(`🔄 RADAR DEBUG: Set ${transformedUsers.length} users for display`);
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
  }, [isLocationEnabled, isDemo]);

  // Sync the location for all demo accounts to the current demo user's location
  const syncDemoLocations = useCallback(
    async (location: UserLocation) => {
      if (!isDemo || !currentUser) return;

      try {
        await supabase
          .from('profiles')
          .update({
            latitude: location.latitude,
            longitude: location.longitude,
            location_last_updated_at: new Date().toISOString()
          })
          .like('username', 'demo%')
          .neq('id', currentUser.id);
      } catch (error) {
        console.error('Error syncing demo locations:', error);
      }
    },
    [isDemo, currentUser]
  );


  const initializeRadar = useCallback(async () => {
    try {
      console.log('🚀 RADAR DEBUG: Initializing radar screen');

      if (!currentUser) {
        console.error('🚀 RADAR DEBUG: No current user provided');
        setIsLoading(false);
        return;
      }

      console.log('🚀 RADAR DEBUG: Current user found:', currentUser.id);
      console.log('🚀 RADAR DEBUG: Is demo user:', isDemo);

      if (isDemo && currentUser.latitude && currentUser.longitude) {
        await syncDemoLocations({
          latitude: currentUser.latitude,
          longitude: currentUser.longitude,
          timestamp: Date.now()
        });
      }

      // Initialize location toggle manager with current user
      locationToggleManager.initialize(
        currentUser.id,
        handleLocationUpdate,
        handleLocationError
      );

      // Get the current toggle state from the manager
      const toggleState = locationToggleManager.getState();
      setIsLocationEnabled(toggleState.isEnabled);

      console.log('🚀 RADAR DEBUG: Location toggle state:', {
        isEnabled: toggleState.isEnabled,
        isTracking: toggleState.isTracking,
        hasCurrentLocation: !!toggleState.currentLocation
      });

      // For demo users, always load users regardless of toggle state
      if (isDemo) {
        console.log('🚀 RADAR DEBUG: Demo user - loading users regardless of toggle state');
        
        // Use current user's location or default demo location
        const demoLocation: UserLocation = {
          latitude: currentUser.latitude || 99,
          longitude: currentUser.longitude || 99,
          timestamp: Date.now()
        };
        
        setCurrentLocation(demoLocation);
        await loadNearbyUsers(currentUser.id, demoLocation);
        setLocationPermission({ granted: true, denied: false, pending: false });
        
      } else {
        // Regular user logic
        if (toggleState.isEnabled && toggleState.currentLocation) {
          setCurrentLocation(toggleState.currentLocation);
          await loadNearbyUsers(currentUser.id, toggleState.currentLocation);
        } else if (currentUser.latitude && currentUser.longitude) {
          // User has location data but toggle is OFF
          console.log('🚀 RADAR DEBUG: User has location data but toggle is OFF');
          const userLocation: UserLocation = {
            latitude: currentUser.latitude,
            longitude: currentUser.longitude,
            timestamp: Date.now()
          };
          setCurrentLocation(userLocation);
          setLocationPermission({ granted: true, denied: false, pending: false });
          // Don't load users since toggle is OFF
          setUsers([]);
        } else {
          console.log('🚀 RADAR DEBUG: User has no location data');
          const permissionStatus = await checkLocationPermission();
          setLocationPermission(permissionStatus);
          setUsers([]);
        }
      }

    } catch (error) {
      console.error('🚀 RADAR DEBUG: Error initializing radar:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, loadNearbyUsers, syncDemoLocations, isDemo]);


  useEffect(() => {
    mountedRef.current = true;
    initializeRadar();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      locationToggleManager.cleanup();
    };
  }, [initializeRadar]);

  // Handle location updates from toggle manager
  const handleLocationUpdate = useCallback(async (location: UserLocation | null) => {
    if (!mountedRef.current) return;

    console.log('📍 RADAR: Location update received:', location);
    setCurrentLocation(location);
    
    if (location && currentUser && (isLocationEnabled || isDemo)) {
      if (isDemo) {
        await syncDemoLocations(location);
      }
      // Load nearby users if toggle is ON or if it's a demo user
      await loadNearbyUsers(currentUser.id, location);
    } else if (!isDemo) {
      // Clear users if location is null or toggle is OFF (but not for demo users)
      setUsers([]);
    }
  }, [currentUser, isLocationEnabled, isDemo, loadNearbyUsers, syncDemoLocations]);

  // Handle location errors from toggle manager
  const handleLocationError = useCallback((error: string) => {
    if (!mountedRef.current) return;

    console.error('Location error:', error);
    setLocationError(error);
  }, []);

  // Keep callbacks in sync with manager
  useEffect(() => {
    locationToggleManager.setCallbacks(handleLocationUpdate, handleLocationError);
  }, [handleLocationUpdate, handleLocationError]);

  // Handle location toggle change
  const handleLocationToggle = async (enabled: boolean) => {
    if (isTogglingLocation) return;

    setIsTogglingLocation(true);
    setLocationError(null);

    try {
      if (enabled) {
        console.log('🔄 Turning location toggle ON');
        
        // Turn ON location tracking
        const result = await locationToggleManager.turnOn();
        
        if (result.success) {
          setIsLocationEnabled(true);
          console.log('✅ Location toggle turned ON successfully');

          // Load nearby users after successful toggle
          const managerState = locationToggleManager.getState();
          if (managerState.currentLocation) {
            setCurrentLocation(managerState.currentLocation);
            if (currentUser) {
              await loadNearbyUsers(currentUser.id, managerState.currentLocation);
            }
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
          if (!isDemo) {
            setUsers([]); // Clear users immediately (but not for demo users)
          }
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

  const handleViewProfile = async (user: User) => {
    setIsLoadingProfile(true);
    try {
      console.log('Loading user profile for userId:', user.id);
      
      // Get user profile from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !profile) {
        console.error('Error loading user profile:', error);
        setIsLoadingProfile(false);
        return;
      }

      console.log('Profile loaded:', profile);

      // Transform database profile to User type
      const transformedUser: User = transformProfileToUser(profile);
      
      console.log('Transformed user:', transformedUser);

      // Load user's posts
      const userPosts = await getUserPosts(user.id);
      console.log('User posts loaded:', userPosts.length);

      setSelectedProfileUser(transformedUser);
      setSelectedProfileUserPosts(userPosts);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleMessage = (user: User) => {
    if (onMessageUser) {
      onMessageUser(user);
    }
  };

  const handleBackFromProfile = () => {
    setSelectedProfileUser(null);
    setSelectedProfileUserPosts([]);
    setShowPostsGallery(false);
  };

  const handlePostClick = () => {
    setShowPostsGallery(true);
  };

  const handleBackFromGallery = () => {
    setShowPostsGallery(false);
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
    if (isRefreshing || !currentUser) return;
    if (!isDemo && !isLocationEnabled) return;
    
    setIsRefreshing(true);
    setLocationError(null);
    
    try {
      if (isDemo) {
        // For demo users, refresh with current location
        const demoLocation: UserLocation = {
          latitude: currentUser.latitude || 99,
          longitude: currentUser.longitude || 99,
          timestamp: Date.now()
        };
        
        await syncDemoLocations(demoLocation);
        await loadNearbyUsers(currentUser.id, demoLocation);
        setCurrentLocation(demoLocation);
        
      } else {
        // Refresh location if toggle is ON
        const result = await locationToggleManager.refreshLocation();

        if (result.success) {
          const state = locationToggleManager.getState();
          if (state.currentLocation && currentUser) {
            await loadNearbyUsers(currentUser.id, state.currentLocation);
            setCurrentLocation(state.currentLocation);
          }
        } else {
          setLocationError(result.error || 'Failed to refresh location');
        }
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

  // Show profile screen if a user is selected
  if (selectedProfileUser) {
    if (showPostsGallery) {
      return (
        <PostsGalleryScreen
          user={selectedProfileUser}
          posts={selectedProfileUserPosts}
          onBack={handleBackFromGallery}
          onUserClick={() => {}}
        />
      );
    }

    return (
      <div className="min-h-full bg-black">
        <button
          onClick={handleBackFromProfile}
          className="fixed top-4 left-4 z-50 bg-gray-900/80 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <ChevronLeftIcon className="w-5 h-5 text-white" />
        </button>
        {isLoadingProfile ? (
          <div className="min-h-full bg-black flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading profile...</p>
            </div>
          </div>
        ) : (
          <UserProfile
            user={selectedProfileUser}
            posts={selectedProfileUserPosts}
            onPostClick={handlePostClick}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full bg-black flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - People Nearby and Location Tracking */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">People Nearby</h1>
              <div className="flex items-center gap-2">
                {(isLocationEnabled || isDemo) ? (
                  <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                ) : (
                  <MapPinIcon className="w-4 h-4 text-gray-500" />
                )}
                <span className={`text-xs ${
                  (isLocationEnabled || isDemo) ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {isDemo ? 'Demo mode active' : 
                   isLocationEnabled ? 'Location tracking active' : 'Location tracking off'}
                </span>
                
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
            
            {/* Right side - Bolt Badge */}
            <BoltBadge />
          </div>
        </div>
        
        {/* Show Nearby Toggle and Refresh Controls - Hide for demo users */}
        {!isDemo && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between">
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
        )}

        {/* Demo user info */}
        {isDemo && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400">Demo Mode</span>
                <span className="text-xs text-gray-400">Showing all nearby users + demo users</span>
              </div>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Location Status Info - Hide for demo users */}
      {!isDemo && !isLocationEnabled && (
        <div className="flex-shrink-0 px-4 py-3 bg-blue-900/20 border-b border-blue-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-500" />
              <div>
                <span className="text-sm text-blue-400 font-medium">Location Tracking Off</span>
                <p className="text-xs text-blue-300">
                  Turn on "Show Nearby" to find people around you
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

      {/* Error Message - Hide for demo users */}
      {!isDemo && locationError && (
        <div className="flex-shrink-0 px-4 py-3 bg-red-900/20 border-b border-red-700/30">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-400">{locationError}</span>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {users.length > 0 ? (
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
              {isDemo ? 
                "Demo users and nearby people will appear here!" :
                !isLocationEnabled ? 
                  "Turn on location tracking to see people around you!" :
                  "Move around or check back later to find people nearby!"
              }
            </p>
          </div>
        )}
      </div>

      {/* Location Permission Modal - Hide for demo users */}
      {!isDemo && (
        <LocationPermissionModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onRequestLocation={handleRequestLocation}
          isRequesting={isRequestingLocation}
          error={locationError || undefined}
        />
      )}
    </div>
  );
};